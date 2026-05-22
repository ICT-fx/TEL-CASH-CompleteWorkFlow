import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAuth } from '@/lib/auth';

// POST /api/orders/[id]/return — client creates a return request
//
// Eligibility:
//   - order belongs to caller
//   - order status is 'delivered' OR 'shipped' (still en route → block? we allow)
//   - delivered <= 14 days ago (French legal retraction window — extend in body if you want a longer policy)
//   - no existing pending return for this order
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await context.params;
    const { user, response } = await requireAuth();
    if (response) return response;

    const body = await request.json();
    const { reason, description, photos } = body as {
      reason: string;
      description?: string;
      photos?: string[];
    };

    const ALLOWED_REASONS = ['retractation', 'defective', 'not_as_described', 'wrong_item', 'other'];
    if (!reason || !ALLOWED_REASONS.includes(reason)) {
      return NextResponse.json({ error: 'Motif de retour invalide' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // Verify order ownership + status.
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, user_id, status, created_at, updated_at, total_amount')
      .eq('id', orderId)
      .eq('user_id', user!.id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    if (!['shipped', 'delivered'].includes(order.status)) {
      return NextResponse.json(
        { error: 'Seules les commandes expédiées ou livrées peuvent être retournées' },
        { status: 400 }
      );
    }

    // 14-day legal retraction window (count from delivery / last status change).
    // For 'defective' / 'not_as_described' we keep a longer 30-day window.
    const deliveredAt = new Date(order.updated_at || order.created_at);
    const daysSince = (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24);
    const maxDays = reason === 'retractation' ? 14 : 30;
    if (daysSince > maxDays) {
      return NextResponse.json(
        { error: `Délai de retour dépassé (${Math.floor(daysSince)} jours, max ${maxDays}j pour ce motif)` },
        { status: 400 }
      );
    }

    // Block duplicate pending returns.
    const { data: existing } = await supabase
      .from('return_requests')
      .select('id, status')
      .eq('order_id', orderId)
      .not('status', 'in', '(refunded,rejected)')
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Une demande de retour existe déjà pour cette commande' },
        { status: 409 }
      );
    }

    // Generate RMA via DB function + insert.
    const adminDb = createAdminClient();
    const { data: rmaRow } = await adminDb.rpc('generate_rma_number');
    const rmaNumber = (rmaRow as unknown as string) || `RMA-${Date.now()}`;

    const { data: returnReq, error: insertErr } = await adminDb
      .from('return_requests')
      .insert({
        order_id: orderId,
        user_id: user!.id,
        rma_number: rmaNumber,
        reason,
        description: description || null,
        photos: photos || [],
        status: 'requested',
      })
      .select()
      .single();

    if (insertErr || !returnReq) {
      return NextResponse.json({ error: insertErr?.message || 'Erreur création retour' }, { status: 500 });
    }

    return NextResponse.json({ return_request: returnReq });
  } catch (err) {
    console.error('Return create error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// GET /api/orders/[id]/return — fetch existing return for this order (if any)
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await context.params;
    const { user, response } = await requireAuth();
    if (response) return response;

    const supabase = await createServerSupabaseClient();

    const { data } = await supabase
      .from('return_requests')
      .select('*')
      .eq('order_id', orderId)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ return_request: data });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
