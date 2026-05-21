import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { buildOrderNumberMap } from '@/lib/orderNumber';

const PAID_STATUSES = ['paid', 'shipped', 'delivered'];

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

    const { data: revenueData } = await supabase
      .from('orders')
      .select('total_amount, created_at, status')
      .in('status', PAID_STATUSES);

    const totalRevenue = revenueData?.reduce(
      (sum, o) => sum + parseFloat(o.total_amount as unknown as string), 0
    ) || 0;

    // Sales per day over the last 30 days (zero-filled).
    const dayBuckets = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      dayBuckets.set(d.toISOString().slice(0, 10), 0);
    }
    let revenueCurrent = 0;  // last 30 days
    let revenuePrevious = 0; // 30–60 days ago
    for (const o of revenueData || []) {
      const created = new Date(o.created_at as unknown as string);
      const amount = parseFloat(o.total_amount as unknown as string) || 0;
      if (created >= since30) {
        revenueCurrent += amount;
        const key = created.toISOString().slice(0, 10);
        if (dayBuckets.has(key)) dayBuckets.set(key, (dayBuckets.get(key) || 0) + amount);
      } else if (created >= since60) {
        revenuePrevious += amount;
      }
    }
    const salesByDay = Array.from(dayBuckets, ([date, total]) => ({ date, total }));
    const revenueDelta = revenuePrevious > 0
      ? ((revenueCurrent - revenuePrevious) / revenuePrevious) * 100
      : null;

    // ── Order counts by status ─────────────────────────────────────
    const { count: totalOrders } = await supabase
      .from('orders').select('*', { count: 'exact', head: true });
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
      .order('created_at', { ascending: false })
      .limit(6);

    const { data: allOrders } = await supabase
      .from('orders').select('id, created_at');
    const numberMap = buildOrderNumberMap(allOrders || []);
    const recentOrders = (recentOrdersRaw || []).map((o) => ({
      ...o,
      order_number: numberMap.get(o.id) ?? null,
    }));

    // ── Top sold models (over paid+ orders) ────────────────────────
    const { data: paidOrderRows } = await supabase
      .from('orders').select('id').in('status', PAID_STATUSES);
    const paidIds = new Set((paidOrderRows || []).map((o) => o.id));

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('quantity, order_id, product:products(brand, model)');

    const tally = new Map<string, number>();
    for (const it of orderItems || []) {
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
        revenueCurrent,
        revenueDelta,
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
