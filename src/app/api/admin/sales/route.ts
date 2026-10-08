import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { deltaPct, fetchAll, isCountedSale, loadSales, summarize } from '@/lib/admin/sales';
import { loadSupplierCostIndex, orderMargin, type MarginItem } from '@/lib/admin/orderMargin';
import { parisDayKey, parisMidnight, parisMonthKey, parisStartOfDay } from '@/lib/admin/parisTime';

const DAY = 24 * 60 * 60 * 1000;

// GET /api/admin/sales?period=7|30|365 — écran « Ventes et marge ».
// CA net (même définition partout : lib/admin/sales), marge par jour et par
// modèle (même calcul que la liste des commandes : lib/admin/orderMargin).
// Lecture seule.
export async function GET(request: Request) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;
    const db = createAdminClient();

    const p = new URL(request.url).searchParams.get('period');
    const days = p === '7' ? 7 : p === '365' ? 365 : 30;
    const monthly = days === 365;
    const now = new Date();
    // Jours et mois au sens de Paris (le serveur tourne en UTC).
    const [py, pm] = parisDayKey(now).split('-').map(Number);
    const monthStart = (offset: number) => {
      const d = new Date(Date.UTC(py, pm - 1 + offset, 1));
      return parisMidnight(d.toISOString().slice(0, 10));
    };
    const since = monthly ? monthStart(-11) : parisStartOfDay(now, -(days - 1));
    const prevSince = monthly ? monthStart(-23) : parisStartOfDay(now, -(2 * days - 1));

    const { orders: all } = await loadSales(db, { since: prevSince });
    const cur = summarize(all, since);
    const prev = summarize(all, prevSince, since);
    const sales = all.filter((o) => o.createdAt >= since && isCountedSale(o));

    // Lignes de commande + clés de variante, par paquets.
    type Row = { order_id: string; quantity: number | null; price_at_purchase: number | string | null; cost_at_purchase: number | string | null; product_name: string | null; product: unknown };
    const ids = sales.map((o) => o.id);
    const rows: Row[] = [];
    for (let i = 0; i < ids.length; i += 150) {
      rows.push(...await fetchAll<Row>((from, to) => db
        .from('order_items')
        .select('order_id, quantity, price_at_purchase, cost_at_purchase, product_name, product:products(brand, model, storage_capacity, grade, brand_k, model_k, storage_k, grade_k, color_k)')
        .in('order_id', ids.slice(i, i + 150))
        .range(from, to)));
    }
    type P = { brand?: string | null; model?: string | null; storage_capacity?: string | null; grade?: string | null; brand_k?: string | null; model_k?: string | null; storage_k?: string | null; grade_k?: string | null; color_k?: string | null };
    const prodOf = (r: Row) => (Array.isArray(r.product) ? r.product[0] : r.product) as P | null;
    const index = await loadSupplierCostIndex(db, rows.map((r) => prodOf(r)?.model_k));
    // Remises (parrainage) par commande : déduites de la marge.
    const discountOf = new Map<string, number>();
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await db.from('orders').select('id, discount_amount').in('id', ids.slice(i, i + 150));
      for (const d of data ?? []) discountOf.set(d.id as string, Number(d.discount_amount) || 0);
    }

    const toItem = (r: Row): MarginItem => {
      const pr = prodOf(r);
      return {
        quantity: r.quantity ?? 1,
        price: Number(r.price_at_purchase) || 0,
        costAtPurchase: r.cost_at_purchase == null ? null : Number(r.cost_at_purchase),
        keys: pr ? { brand_k: pr.brand_k ?? null, model_k: pr.model_k ?? null, storage_k: pr.storage_k ?? null, grade_k: pr.grade_k ?? null, color_k: pr.color_k ?? null } : null,
      };
    };

    // Marge par commande (au prorata de ce qui reste encaissé si remboursement partiel).
    const byOrder = new Map<string, Row[]>();
    for (const r of rows) byOrder.set(r.order_id, [...(byOrder.get(r.order_id) ?? []), r]);
    let marginTotal = 0, marginRevenue = 0, estimatedOrders = 0, unknownOrders = 0;
    const marginOf = new Map<string, number>();
    for (const o of sales) {
      const m = orderMargin((byOrder.get(o.id) ?? []).map(toItem), index.lookup, discountOf.get(o.id) ?? 0);
      if (m.amount == null) { unknownOrders += 1; continue; }
      const ratio = o.gross > 0 ? o.net / o.gross : 1;
      const amt = m.amount * ratio;
      marginOf.set(o.id, amt);
      marginTotal += amt;
      marginRevenue += o.net;
      if (m.estimated) estimatedOrders += 1;
    }

    // Série par jour (ou par mois sur 12 mois).
    const buckets: { key: string; label: string; net: number; margin: number }[] = [];
    const keyOf = (d: Date) => (monthly ? parisMonthKey(d) : parisDayKey(d));
    if (monthly) {
      for (let i = 0; i < 12; i++) {
        const d = new Date(Date.UTC(py, pm - 1 - 11 + i, 15));
        buckets.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' }), net: 0, margin: 0 });
      }
    } else {
      for (let i = 0; i < days; i++) {
        const d = parisStartOfDay(now, i - (days - 1));
        buckets.push({ key: parisDayKey(d), label: new Date(d.getTime() + 12 * 3600_000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }), net: 0, margin: 0 });
      }
    }
    const bIndex = new Map(buckets.map((b, i) => [b.key, i]));
    for (const o of sales) {
      const i = bIndex.get(keyOf(o.createdAt));
      if (i == null) continue;
      buckets[i].net += o.net;
      buckets[i].margin += marginOf.get(o.id) ?? 0;
    }

    // Par modèle (marque + modèle + stockage + grade).
    const models = new Map<string, { label: string; qty: number; revenue: number; margin: number; known: number; estimated: boolean }>();
    for (const r of rows) {
      const pr = prodOf(r);
      const label = pr ? [[pr.brand, pr.model].filter(Boolean).join(' '), pr.storage_capacity, pr.grade ? `grade ${pr.grade}` : null].filter(Boolean).join(' · ') : (r.product_name || 'Produit');
      const it = toItem(r);
      const m = orderMargin([it], index.lookup);
      const cur2 = models.get(label) ?? { label, qty: 0, revenue: 0, margin: 0, known: 0, estimated: false };
      cur2.qty += it.quantity;
      cur2.revenue += it.price * it.quantity;
      if (m.amount != null) { cur2.margin += m.amount; cur2.known += it.price * it.quantity; cur2.estimated ||= m.estimated; }
      models.set(label, cur2);
    }
    const byModel = Array.from(models.values())
      .map((m) => ({ ...m, revenue: Math.round(m.revenue), margin: Math.round(m.margin), pct: m.known > 0 ? Math.round((m.margin / m.known) * 1000) / 10 : null }))
      .sort((a, b) => b.margin - a.margin);

    return NextResponse.json({
      period: days,
      granularity: monthly ? 'month' : 'day',
      kpis: {
        net: cur.net, netDelta: deltaPct(cur.net, prev.net),
        orders: cur.orders, ordersDiff: cur.orders - prev.orders,
        avgBasket: cur.avgBasket, refunded: cur.refunded,
        margin: Math.round(marginTotal), marginPct: marginRevenue > 0 ? Math.round((marginTotal / marginRevenue) * 1000) / 10 : null,
        estimatedOrders, unknownOrders,
      },
      series: buckets.map((b) => ({ ...b, net: Math.round(b.net), margin: Math.round(b.margin) })),
      byModel,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
