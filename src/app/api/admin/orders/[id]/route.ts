import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { buildOrderNumberMap } from '@/lib/orderNumber';
import { isBoxtalConfigured } from '@/lib/boxtal';

// GET /api/admin/orders/[id] — Get order detail (admin)
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const supabase = createAdminClient();

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, profile:profiles(email, full_name, phone)')
      .eq('id', id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    const { data: items } = await supabase
      .from('order_items')
      .select('*, product:products(brand, model, images, imei, storage_capacity, color, grade)')
      .eq('order_id', id);

    // Readable order number (n°1, n°2…) derived from the full order set.
    const { data: allOrders } = await supabase
      .from('orders')
      .select('id, created_at');
    const numberMap = buildOrderNumberMap(allOrders || []);
    const numberedOrder = { ...order, order_number: numberMap.get(order.id) ?? null };

    return NextResponse.json({ order: numberedOrder, items, boxtalConfigured: isBoxtalConfigured() });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PUT /api/admin/orders/[id] — Update order status / tracking
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const body = await request.json();
    const updateData: Record<string, any> = {};

    if (body.status) updateData.status = body.status;
    if (body.tracking_number) updateData.tracking_number = body.tracking_number;
    if (body.tracking_url !== undefined) updateData.tracking_url = body.tracking_url;
    if (body.notes) updateData.notes = body.notes;

    const supabase = createAdminClient();

    const { data: order, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
