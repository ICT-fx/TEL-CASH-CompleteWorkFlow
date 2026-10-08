import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { deltaPct, fetchAll, isCountedSale, loadSales, summarize } from '@/lib/admin/sales';

// Périodes autorisées (en jours). 365 → agrégation mensuelle pour rester lisible.
const PERIODS: Record<string, number> = { '7': 7, '30': 30, '90': 90, '365': 365 };

interface ProductRef {
  brand: string | null;
  model: string | null;
  storage_capacity: string | null;
  grade: string | null;
  color: string | null;
}

// GET /api/admin/stats/detailed?period=7|30|90|365
// Statistiques métier filtrées sur une période, avec comparaison vs la
// période précédente de même durée.
export async function GET(req: NextRequest) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const supabase = createAdminClient();

    const periodKey = req.nextUrl.searchParams.get('period') || '30';
    const days = PERIODS[periodKey] ?? 30;
    const monthly = days >= 365;

    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - days);
    const prevStart = new Date(now); prevStart.setDate(now.getDate() - days * 2);

    // ── Ventes sur les 2 périodes (source unique : lib/admin/sales) ──
    const { orders: sales } = await loadSales(supabase, { since: prevStart });

    // Buckets temporels (zéro-remplis) : jour si < 365 j, sinon mois.
    const buckets = new Map<string, number>();
    if (monthly) {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.set(d.toISOString().slice(0, 10), 0);
      }
    } else {
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now); d.setDate(now.getDate() - i);
        buckets.set(d.toISOString().slice(0, 10), 0);
      }
    }

    for (const o of sales) {
      if (o.createdAt < start) continue;
      const created = o.createdAt;
      const key = monthly
        ? new Date(created.getFullYear(), created.getMonth(), 1).toISOString().slice(0, 10)
        : created.toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + o.net);
    }
    const current = summarize(sales, start);
    const previous = summarize(sales, prevStart, start);
    const revenueCurrent = current.net;
    const revenuePrevious = previous.net;
    const ordersCurrent = current.orders;
    const buyersCurrent = { size: current.buyers };

    const salesByDay = Array.from(buckets, ([date, total]) => ({ date, total: Math.round(total * 100) / 100 }));
    const revenueDelta = deltaPct(revenueCurrent, revenuePrevious);
    const avgBasket = current.avgBasket;

    // ── Nouveaux clients inscrits sur la période ─────────────────────
    const { count: newCustomers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'customer')
      .gte('created_at', start.toISOString());

    // ── Top produits vendus sur la période (détaillé par variante) ───
    // 1) ids des commandes payées de la période
    const periodIds = new Set(sales.filter((o) => o.createdAt >= start && isCountedSale(o)).map((o) => o.id));

    // 2) lignes de commande correspondantes
    const items = await fetchAll<{
      quantity: number | null; price_at_purchase: number | string | null; order_id: string;
      product_name: string | null; product: unknown;
    }>((from, to) => supabase
      .from('order_items')
      .select('quantity, price_at_purchase, order_id, product_name, product:products(brand, model, storage_capacity, grade, color)')
      .range(from, to));

    const tally = new Map<string, {
      product: ProductRef | null; fallbackName: string | null; qty: number; revenue: number;
    }>();
    for (const it of items) {
      if (!periodIds.has(it.order_id)) continue;
      // Supabase type le join (relation 1-N) comme un tableau : on prend le 1er.
      const rawProduct = it.product as unknown as ProductRef | ProductRef[] | null;
      const product = Array.isArray(rawProduct) ? (rawProduct[0] || null) : (rawProduct || null);
      const fallbackName = (it.product_name as unknown as string) || null;
      const key = product
        ? [product.brand, product.model, product.storage_capacity, product.grade, product.color].join('|')
        : (fallbackName || 'inconnu');
      const qty = (it.quantity as unknown as number) || 1;
      const revenue = qty * (parseFloat(it.price_at_purchase as unknown as string) || 0);
      const cur = tally.get(key);
      if (cur) {
        cur.qty += qty; cur.revenue += revenue;
      } else {
        tally.set(key, { product, fallbackName, qty, revenue });
      }
    }
    const topProducts = Array.from(tally.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ── Trafic (tracking maison) ─────────────────────────────────────
    // Agrégé en une seule fonction SQL. Fail-safe : si la table/fonction
    // n'existe pas encore (migration 032 non appliquée), traffic reste null
    // et le reste du dashboard fonctionne normalement.
    let traffic: Record<string, unknown> | null = null;
    try {
      const { data: t, error: tErr } = await supabase.rpc('traffic_stats', {
        p_start: start.toISOString(),
        p_prev_start: prevStart.toISOString(),
        p_monthly: monthly,
      });
      if (!tErr && t) {
        const uniqueVisitors = Number(t.uniqueVisitors) || 0;
        const prevVisitors = Number(t.uniqueVisitorsPrev) || 0;
        const visitorsDelta = prevVisitors > 0
          ? ((uniqueVisitors - prevVisitors) / prevVisitors) * 100
          : null;
        // Taux de conversion = commandes payées / visiteurs uniques (sur la période).
        const conversionRate = uniqueVisitors > 0
          ? (ordersCurrent / uniqueVisitors) * 100
          : null;
        traffic = {
          uniqueVisitors,
          visitorsDelta,
          pageViews: Number(t.pageViews) || 0,
          sessions: Number(t.sessions) || 0,
          conversionRate,
          visitsByDay: Array.isArray(t.series) ? t.series : [],
          visitsByDayPrev: [] as number[],
          topPages: Array.isArray(t.topPages) ? t.topPages : [],
          sources: t.sources || { direct: 0, google: 0, social: 0, other: 0 },
          devices: t.devices || { mobile: 0, desktop: 0, tablet: 0, unknown: 0 },
        };
      }
    } catch {
      traffic = null; // tracking pas encore actif → section masquée côté UI
    }

    // Même courbe sur la période d'avant (pointillés sur l'écran Trafic).
    // La fonction SQL compte jusqu'à maintenant : on garde la partie avant `start`,
    // alignée sur la longueur de la période en cours.
    if (traffic && Array.isArray(traffic.visitsByDay)) {
      try {
        const { data: tp } = await supabase.rpc('traffic_stats', {
          p_start: prevStart.toISOString(),
          p_prev_start: prevStart.toISOString(),
          p_monthly: monthly,
        });
        const cur = traffic.visitsByDay as { date: string; total: number }[];
        // Même jour de la période d'avant : date − durée de la période (ou − 12 mois).
        const byDate = new Map<string, number>(
          (Array.isArray(tp?.series) ? tp.series : []).map((d: { date: string; total: number }) => [String(d.date).slice(0, 10), Number(d.total) || 0]));
        const shift = (iso: string) => {
          const [y, m, dd] = iso.slice(0, 10).split('-').map(Number);
          const d = monthly ? new Date(Date.UTC(y - 1, m - 1, dd)) : new Date(Date.UTC(y, m - 1, dd - days));
          return d.toISOString().slice(0, 10);
        };
        const aligned = cur.map((c) => byDate.get(shift(c.date)) ?? 0);
        traffic.visitsByDayPrev = aligned.some((v: number) => v > 0) ? aligned : [];
      } catch {
        // pas de période d'avant : la courbe s'affiche seule
      }
    }

    return NextResponse.json({
      period: periodKey,
      granularity: monthly ? 'month' : 'day',
      stats: {
        revenueCurrent,
        revenuePrevious,
        revenueDelta,
        ordersCurrent,
        avgBasket,
        uniqueBuyers: buyersCurrent.size,
        newCustomers: newCustomers || 0,
      },
      salesByDay,
      topProducts,
      traffic,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
