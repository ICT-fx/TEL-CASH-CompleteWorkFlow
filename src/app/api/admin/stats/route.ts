import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/stats — Dashboard statistics
export async function GET() {
  try {
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const supabase = createAdminClient();

    // Total revenue (paid orders)
    const { data: revenueData } = await supabase
      .from('orders')
      .select('total_amount')
      .in('status', ['paid', 'shipped', 'delivered']);

    const totalRevenue = revenueData?.reduce(
      (sum, o) => sum + parseFloat(o.total_amount as unknown as string), 0
    ) || 0;

    // Order counts by status
    const { count: totalOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    const { count: pendingOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: paidOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'paid');

    const { count: shippedOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'shipped');

    // Product stats
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const { data: lowStock } = await supabase
      .from('products')
      .select('id, brand, model, stock')
      .eq('is_active', true)
      .lte('stock', 2)
      .order('stock', { ascending: true })
      .limit(10);

    // User count
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'customer');

    // Recent orders
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('*, profile:profiles(email, full_name)')
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      stats: {
        totalRevenue,
        totalOrders: totalOrders || 0,
        pendingOrders: pendingOrders || 0,
        paidOrders: paidOrders || 0,
        shippedOrders: shippedOrders || 0,
        totalProducts: totalProducts || 0,
        totalUsers: totalUsers || 0,
      },
      lowStock: lowStock || [],
      recentOrders: recentOrders || [],
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
