import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../../../_lib/fluxitron-auth';
import { createAdminClient } from '@/lib/supabase-admin';

// POST /api/v1/orders/:id/notes — Add an internal note to an order
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { note } = body;

    if (!note) {
      return NextResponse.json(
        { error: 'note is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get existing notes and append
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('notes')
      .eq('id', id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json(
        { error: 'Not found', details: `No order with ID ${id} exists` },
        { status: 404 }
      );
    }

    // Append note with timestamp
    const timestamp = new Date().toISOString();
    const existingNotes = order.notes || '';
    const newNotes = existingNotes
      ? `${existingNotes}\n[${timestamp}] ${note}`
      : `[${timestamp}] ${note}`;

    const { error } = await supabase
      .from('orders')
      .update({ notes: newNotes })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const res = NextResponse.json({ success: true }, { status: 201 });
    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error adding order note:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
