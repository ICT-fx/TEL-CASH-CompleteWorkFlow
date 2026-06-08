import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../../../_lib/fluxitron-auth';
import { createAdminClient } from '@/lib/supabase-admin';

// POST /api/v1/orders/:id/tracking — Add tracking information
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { number, company, url } = body;

    if (!number) {
      return NextResponse.json(
        { error: 'tracking number is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Build tracking info string
    const trackingParts = [number];
    if (company) trackingParts.unshift(company);

    const updateData: Record<string, any> = {
      tracking_number: number,
    };

    // Also append tracking info to notes
    let noteText = `Suivi: ${trackingParts.join(' — ')}`;
    if (url) noteText += ` | ${url}`;

    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('notes, fulfillment_status')
      .eq('id', id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json(
        { error: 'Not found', details: `No order with ID ${id} exists` },
        { status: 404 }
      );
    }

    // Append tracking note
    const timestamp = new Date().toISOString();
    const existingNotes = order.notes || '';
    updateData.notes = existingNotes
      ? `${existingNotes}\n[${timestamp}] ${noteText}`
      : `[${timestamp}] ${noteText}`;

    // Auto-update status to shipped if currently unfulfilled
    if (!order.fulfillment_status || order.fulfillment_status === 'unfulfilled') {
      updateData.fulfillment_status = 'partial';
      updateData.status = 'shipped';
    }

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const res = NextResponse.json({ success: true });
    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error adding tracking:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
