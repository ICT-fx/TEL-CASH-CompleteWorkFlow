import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { buildOrderNumberMap } from '@/lib/orderNumber';
import { stripPickupCodeSecrets } from '@/lib/pickupCode';
import { deltaPct, fetchAll, isCountedSale, loadSales, summarize } from '@/lib/admin/sales';
import { parisDayKey, parisStartOfDay } from '@/lib/admin/parisTime';

const DAY = 24 * 60 * 60 * 1000;

// GET /api/admin/today — écran « Aujourd'hui » du back-office.
// Répond à « qu'est-ce que je dois faire maintenant ? » : actions en attente,
// chiffres de la semaine (même définition du CA que partout : lib/admin/sales)
// et alertes. Lecture seule.
export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;
    const db = createAdminClient();

    const now = new Date();
    // Jours au sens de Paris (le serveur tourne en UTC).
    const since7 = parisStartOfDay(now, -6);   // 7 jours, aujourd'hui inclus
    const since14 = parisStartOfDay(now, -13);
    const since30 = new Date(now.getTime() - 30 * DAY);

    // ── Actions en attente ────────────────────────────────────────
    const [toPrepareQ, waitingSupplierQ, pickupsQ, returnsQ, cartsQ] = await Promise.all([
      db.from('orders').select('id, delivery_method').eq('status', 'paid'),
      db.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'supplier_ordered'),
      db.from('orders').select('id', { count: 'exact', head: true })
        .eq('status', 'shipped').eq('delivery_method', 'pickup'),
      db.from('return_requests').select('id', { count: 'exact', head: true })
        .in('status', ['requested', 'received', 'inspecting']),
      db.from('orders').select('total_amount').eq('status', 'pending')
        .gte('created_at', new Date(now.getTime() - 7 * DAY).toISOString()),
    ]);
    const toPrepareRows = toPrepareQ.data ?? [];
    const cartRows = cartsQ.data ?? [];

    // ── Chiffres de la semaine (7 derniers jours vs les 7 d'avant) ──
    const { orders: sales, excludedTestOrders } = await loadSales(db, { since: since30 });
    const week = summarize(sales, since7);
    const prevWeek = summarize(sales, since14, since7);

    const weekIds = new Set(sales.filter((o) => o.createdAt >= since7 && isCountedSale(o)).map((o) => o.id));
    // Lignes des ventes des 30 derniers jours, par paquets d'ids (URL courte).
    type Item = {
      order_id: string; quantity: number | null;
      price_at_purchase: number | string | null; cost_at_purchase: number | string | null;
      product: unknown;
    };
    const saleIds = sales.filter(isCountedSale).map((o) => o.id);
    const items30: Item[] = [];
    for (let i = 0; i < saleIds.length; i += 150) {
      const chunk = saleIds.slice(i, i + 150);
      const rows = await fetchAll<Item>((from, to) => db
        .from('order_items')
        .select('order_id, quantity, price_at_purchase, cost_at_purchase, product:products(brand, model)')
        .in('order_id', chunk)
        .range(from, to));
      items30.push(...rows);
    }

    let marginWeek = 0;
    let marginKnown = true;
    const soldByModel = new Map<string, number>();
    for (const it of items30) {
      const qty = it.quantity || 1;
      const raw = it.product as { brand?: string | null; model?: string | null } | { brand?: string | null; model?: string | null }[] | null;
      const p = Array.isArray(raw) ? raw[0] : raw;
      const model = [p?.brand, p?.model].filter(Boolean).join(' ').trim();
      if (model) soldByModel.set(model, (soldByModel.get(model) ?? 0) + qty);
      if (!weekIds.has(it.order_id)) continue;
      if (it.cost_at_purchase == null) { marginKnown = false; continue; }
      marginWeek += (Number(it.price_at_purchase) - Number(it.cost_at_purchase)) * qty;
    }

    const days = Array.from({ length: 7 }, (_, i) => ({ date: parisDayKey(parisStartOfDay(now, i - 6)), total: 0 }));
    const dayIndex = new Map(days.map((d, i) => [d.date, i]));
    for (const o of sales) {
      if (o.createdAt < since7) continue;
      const idx = dayIndex.get(parisDayKey(o.createdAt));
      if (idx != null) days[idx].total += o.net;
    }

    // ── Alertes : modèle qui se vend bien et presque épuisé ─────────
    const { data: lowStock } = await db
      .from('products')
      .select('id, brand, model, stock, storage_capacity, grade, color')
      .eq('is_active', true)
      .lte('stock', 1)
      .order('stock', { ascending: true })
      .limit(200);
    const bestSellersLow = (lowStock ?? [])
      .map((p) => {
        const model = [p.brand, p.model].filter(Boolean).join(' ').trim();
        return { ...p, sold30: soldByModel.get(model) ?? 0 };
      })
      .filter((p) => p.sold30 >= 2)
      .sort((a, b) => b.sold30 - a.sold30)
      .slice(0, 5);

    // ── Dernières commandes ─────────────────────────────────────────
    const [{ data: recentRaw }, allOrdersRefs] = await Promise.all([
      db.from('orders')
        .select('*, profile:profiles(email, full_name)')
        .neq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(6),
      fetchAll<{ id: string; created_at: string }>((from, to) =>
        db.from('orders').select('id, created_at').range(from, to)),
    ]);
    const numberMap = buildOrderNumberMap(allOrdersRefs);
    const recentOrders = (recentRaw ?? []).map((o) => ({
      ...stripPickupCodeSecrets(o),
      order_number: numberMap.get(o.id) ?? null,
    }));

    return NextResponse.json({
      actions: {
        toPrepare: toPrepareRows.length,
        toPreparePickup: toPrepareRows.filter((o) => o.delivery_method === 'pickup').length,
        waitingSupplier: waitingSupplierQ.count ?? 0,
        pickupsReady: pickupsQ.count ?? 0,
        returnsToHandle: returnsQ.count ?? 0,
        cartsOpen: cartRows.length,
        cartsValue: Math.round(cartRows.reduce((s, c) => s + (Number(c.total_amount) || 0), 0)),
      },
      week: {
        net: week.net,
        netDelta: deltaPct(week.net, prevWeek.net),
        orders: week.orders,
        ordersDiff: week.orders - prevWeek.orders,
        avgBasket: week.avgBasket,
        avgBasketDelta: deltaPct(week.avgBasket, prevWeek.avgBasket),
        refunded: week.refunded,
        margin: Math.round(marginWeek * 100) / 100,
        marginKnown,
        days,
      },
      alerts: { bestSellersLow, excludedTestOrders },
      recentOrders,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
