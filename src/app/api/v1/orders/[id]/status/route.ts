import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../../../_lib/fluxitron-auth';
import { createAdminClient } from '@/lib/supabase-admin';

// PUT /api/v1/orders/:id/status — Update order fulfillment status
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { fulfillmentStatus } = body;

    if (!fulfillmentStatus) {
      return NextResponse.json(
        { error: 'fulfillmentStatus is required' },
        { status: 400 }
      );
    }

    const validStatuses = ['unfulfilled', 'partial', 'fulfilled', 'cancelled'];
    if (!validStatuses.includes(fulfillmentStatus)) {
      return NextResponse.json(
        { error: `Invalid fulfillmentStatus. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const updateData: Record<string, any> = {
      fulfillment_status: fulfillmentStatus,
    };

    // Also update the main status field for our admin panel compatibility
    if (fulfillmentStatus === 'fulfilled') {
      updateData.status = 'delivered';
    } else if (fulfillmentStatus === 'cancelled') {
      updateData.status = 'cancelled';
    } else if (fulfillmentStatus === 'partial') {
      updateData.status = 'shipped';
    }

    const { data: order, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !order) {
      return NextResponse.json(
        { error: 'Not found', details: `No order with ID ${id} exists` },
        { status: 404 }
      );
    }

    const res = NextResponse.json({ success: true });
    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error updating order status:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
