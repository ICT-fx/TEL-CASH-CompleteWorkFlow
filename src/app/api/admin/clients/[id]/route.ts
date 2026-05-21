import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { buildOrderNumberMap } from '@/lib/orderNumber';

// GET /api/admin/clients/[id] — Get client detail with order history
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const supabase = createAdminClient();

    // Get client profile
    const { data: client, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });
    }

    // Get client orders with items
    const { data: orders } = await supabase
      .from('orders')
      .select('*, items:order_items(*, product:products(brand, model, images))')
      .eq('user_id', id)
      .order('created_at', { ascending: false });

    // Resolve readable order numbers (n°1, n°2…) from the full order set.
    const { data: allOrders } = await supabase
      .from('orders')
      .select('id, created_at');
    const numberMap = buildOrderNumberMap(allOrders || []);
    const numberedOrders = (orders || []).map((o) => ({
      ...o,
      order_number: numberMap.get(o.id) ?? null,
    }));

    // Get loyalty points
    const { data: loyaltyPoints } = await supabase
      .from('loyalty_points')
      .select('points')
      .eq('user_id', id);

    const totalPoints = loyaltyPoints?.reduce((sum, p) => sum + p.points, 0) || 0;

    return NextResponse.json({
      client,
      orders: numberedOrders,
      totalPoints,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
