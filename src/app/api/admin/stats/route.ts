import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { buildOrderNumberMap } from '@/lib/orderNumber';
import { stripPickupCodeSecrets } from '@/lib/pickupCode';
import { deltaPct, fetchAll, isCountedSale, loadSales, summarize } from '@/lib/admin/sales';

// GET /api/admin/stats — Dashboard statistics
export async function GET() {
  try {
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const supabase = createAdminClient();

    // ── Revenue + 30/60-day windows ────────────────────────────────
    const now = new Date();
    const since30 = new Date(now); since30.setDate(now.getDate() - 30);
    const since60 = new Date(now); since60.setDate(now.getDate() - 60);

    // CA : source unique (lib/admin/sales) — tests exclus, remboursements et
    // retours remboursés déduits, tous les statuts encaissés comptés.
    const { orders: sales, excludedTestOrders } = await loadSales(supabase);
    const all = summarize(sales);
    const totalRevenue = all.net;
    const paidOrdersTotal = all.orders;

    // Ventes nettes par jour sur 30 jours (zéro-remplies).
    const dayBuckets = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      dayBuckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const o of sales) {
      if (o.createdAt < since30) continue;
      const key = o.createdAt.toISOString().slice(0, 10);
      if (dayBuckets.has(key)) dayBuckets.set(key, (dayBuckets.get(key) || 0) + o.net);
    }
    const salesByDay = Array.from(dayBuckets, ([date, total]) => ({ date, total: Math.round(total * 100) / 100 }));
    const revenueCurrent = summarize(sales, since30).net;
    const revenuePrevious = summarize(sales, since60, since30).net;
    const revenueDelta = deltaPct(revenueCurrent, revenuePrevious);

    // ── Order counts by status ─────────────────────────────────────
    const { count: totalOrders } = await supabase
      .from('orders').select('*', { count: 'exact', head: true }).neq('status', 'pending');
    const { count: pendingOrders } = await supabase
      .from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    const { count: paidOrders } = await supabase
      .from('orders').select('*', { count: 'exact', head: true }).eq('status', 'paid');
    const { count: shippedOrders } = await supabase
      .from('orders').select('*', { count: 'exact', head: true }).eq('status', 'shipped');

    // ── Product stats ──────────────────────────────────────────────
    const { count: totalProducts } = await supabase
      .from('products').select('*', { count: 'exact', head: true }).eq('is_active', true);

    // Low stock — include the variant axes so the dashboard can show a
    // precise label ("iPhone 11 · 128 Go · Grade B · Noir").
    const { data: lowStock } = await supabase
      .from('products')
      .select('id, brand, model, stock, storage_capacity, color, grade')
      .eq('is_active', true)
      .lte('stock', 2)
      .order('stock', { ascending: true })
      .limit(12);

    // ── User count ─────────────────────────────────────────────────
    const { count: totalUsers } = await supabase
      .from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer');

    // ── Recent orders (with readable numbers) ──────────────────────
    const { data: recentOrdersRaw } = await supabase
      .from('orders')
      .select('*, profile:profiles(email, full_name)')
      .neq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(6);

    const { data: allOrders } = await supabase
      .from('orders').select('id, created_at');
    const numberMap = buildOrderNumberMap(allOrders || []);
    // Le code de retrait ne doit jamais atteindre le navigateur admin (cf.
    // lib/pickupCode.ts) — cette route faisait exception via son select('*').
    const recentOrders = (recentOrdersRaw || []).map((o) => ({
      ...stripPickupCodeSecrets(o),
      order_number: numberMap.get(o.id) ?? null,
    }));

    // ── Top sold models (over paid+ orders) ────────────────────────
    const paidIds = new Set(sales.filter(isCountedSale).map((o) => o.id));

    const orderItems = await fetchAll<{ quantity: number | null; order_id: string; product: unknown }>(
      (from, to) => supabase
        .from('order_items')
        .select('quantity, order_id, product:products(brand, model)')
        .range(from, to),
    );

    const tally = new Map<string, number>();
    for (const it of orderItems) {
      if (!paidIds.has(it.order_id)) continue;
      const prod = it.product as { brand?: string; model?: string } | null;
      const name = [prod?.brand, prod?.model].filter(Boolean).join(' ').trim();
      if (!name) continue;
      tally.set(name, (tally.get(name) || 0) + (it.quantity || 1));
    }
    const topModels = Array.from(tally, ([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return NextResponse.json({
      stats: {
        totalRevenue,
        totalOrders: totalOrders || 0,
        pendingOrders: pendingOrders || 0,
        paidOrders: paidOrders || 0,
        shippedOrders: shippedOrders || 0,
        totalProducts: totalProducts || 0,
        totalUsers: totalUsers || 0,
        paidOrdersTotal,
        revenueCurrent,
        revenueDelta,
        excludedTestOrders,
      },
      lowStock: lowStock || [],
      recentOrders,
      salesByDay,
      topModels,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
