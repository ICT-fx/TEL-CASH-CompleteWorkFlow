import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../_lib/fluxitron-auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { toFluxitronOrder } from '../_lib/mappers';

// GET /api/v1/orders — Paginated list of orders
export async function GET(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 250);
    const cursor = searchParams.get('cursor');
    const statusFilter = searchParams.get('status');

    const supabase = createAdminClient();

    let query = supabase
      .from('orders')
      .select('*, profile:profiles(email, full_name, phone)')
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    // Cursor-based pagination
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const cursorData = JSON.parse(decoded);
        if (cursorData.created_at) {
          query = query.lt('created_at', cursorData.created_at);
        }
      } catch {
        return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
      }
    }

    // Filter by financial status — map Fluxitron status to our status values
    if (statusFilter) {
      const statusMap: Record<string, string[]> = {
        pending: ['pending', 'awaiting_payment'],
        paid: ['paid', 'shipped', 'delivered'],
        partially_paid: [], // Not used in our system
        refunded: ['refunded'],
        partially_refunded: [], // Not used
        voided: ['cancelled', 'failed'],
      };

      const dbStatuses = statusMap[statusFilter];
      if (dbStatuses && dbStatuses.length > 0) {
        query = query.in('status', dbStatuses);
      }
    }

    const { data: orders, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const hasMore = (orders?.length || 0) > limit;
    const pageOrders = (orders || []).slice(0, limit);

    // Build next cursor
    let nextCursor: string | undefined;
    if (hasMore && pageOrders.length > 0) {
      const lastOrder = pageOrders[pageOrders.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({ created_at: lastOrder.created_at })
      ).toString('base64');
    }

    // Fetch order items for each order
    const orderIds = pageOrders.map((o: any) => o.id);
    const { data: allItems } = await supabase
      .from('order_items')
      .select('*, product:products(brand, model, sku, images)')
      .in('order_id', orderIds);

    // Group items by order_id
    const itemsByOrder: Record<string, any[]> = {};
    for (const item of allItems || []) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    }

    const fluxOrders = pageOrders.map((order: any) =>
      toFluxitronOrder(order, itemsByOrder[order.id] || [])
    );

    const res = NextResponse.json({
      orders: fluxOrders,
      cursor: nextCursor,
      hasMore,
    });

    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error listing orders:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
