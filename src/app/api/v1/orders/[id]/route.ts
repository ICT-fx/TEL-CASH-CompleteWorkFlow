import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../../_lib/fluxitron-auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { toFluxitronOrder } from '../../_lib/mappers';

// GET /api/v1/orders/:id — Get a single order with items
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const supabase = createAdminClient();

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, profile:profiles(email, full_name, phone)')
      .eq('id', id)
      .single();

    if (error || !order) {
      return NextResponse.json(
        { error: 'Not found', details: `No order with ID ${id} exists` },
        { status: 404 }
      );
    }

    // Fetch order items
    const { data: items } = await supabase
      .from('order_items')
      .select('*, product:products(brand, model, sku, images)')
      .eq('order_id', id);

    const res = NextResponse.json(toFluxitronOrder(order, items || []));
    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error getting order:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
