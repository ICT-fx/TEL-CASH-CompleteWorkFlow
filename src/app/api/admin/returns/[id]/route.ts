import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

// GET /api/admin/returns/[id] — get a single return with order + items
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const supabase = createAdminClient();

    const { data: returnReq, error } = await supabase
      .from('return_requests')
      .select('*, profile:profiles(email, full_name, phone)')
      .eq('id', id)
      .single();

    if (error || !returnReq) {
      return NextResponse.json({ error: 'Retour introuvable' }, { status: 404 });
    }

    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', returnReq.order_id)
      .single();

    const { data: items } = await supabase
      .from('order_items')
      .select('*, product:products(brand, model, imei, storage_capacity, color, grade, images)')
      .eq('order_id', returnReq.order_id);

    return NextResponse.json({ return_request: returnReq, order, items });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/admin/returns/[id] — update return (status, notes, tracking, inspection, refund)
//
// Special "action" payloads:
//   action='approve' → status='approved'
//   action='label_sent' + return_tracking_number → status='label_sent'
//   action='received' → status='received'
//   action='inspect' + inspection_imei_matches/condition_ok/factory_reset → status='inspecting'
//   action='refund' + refund_amount → triggers Stripe refund + status='refunded'
//   action='reject' + rejection_reason → status='rejected'
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const body = await request.json();
    const { action } = body;

    const supabase = createAdminClient();

    const { data: returnReq } = await supabase
      .from('return_requests')
      .select('*')
      .eq('id', id)
      .single();
    if (!returnReq) {
      return NextResponse.json({ error: 'Retour introuvable' }, { status: 404 });
    }

    let update: Record<string, any> = {};

    if (action === 'approve') {
      update = { status: 'approved' };
    } else if (action === 'label_sent') {
      if (!body.return_tracking_number) {
        return NextResponse.json({ error: 'Numéro de suivi requis' }, { status: 400 });
      }
      update = { status: 'label_sent', return_tracking_number: body.return_tracking_number };
    } else if (action === 'received') {
      update = { status: 'received' };
    } else if (action === 'inspect') {
      update = {
        status: 'inspecting',
        inspection_imei_matches: body.inspection_imei_matches,
        inspection_condition_ok: body.inspection_condition_ok,
        inspection_factory_reset: body.inspection_factory_reset,
        admin_notes: body.admin_notes ?? returnReq.admin_notes,
      };
    } else if (action === 'reject') {
      if (!body.rejection_reason) {
        return NextResponse.json({ error: 'Motif de refus requis' }, { status: 400 });
      }
      update = { status: 'rejected', rejection_reason: body.rejection_reason };
    } else if (action === 'refund') {
      // Trigger Stripe refund.
      const { data: order } = await supabase
        .from('orders')
        .select('stripe_payment_intent, total_amount')
        .eq('id', returnReq.order_id)
        .single();

      if (!order?.stripe_payment_intent) {
        return NextResponse.json({ error: 'Payment Intent Stripe introuvable sur la commande' }, { status: 400 });
      }

      const refundAmount = body.refund_amount
        ? parseFloat(body.refund_amount)
        : parseFloat(order.total_amount as unknown as string);

      if (!refundAmount || refundAmount <= 0) {
        return NextResponse.json({ error: 'Montant de remboursement invalide' }, { status: 400 });
      }

      const refund = await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent,
        amount: Math.round(refundAmount * 100),
        reason: 'requested_by_customer',
        metadata: {
          return_request_id: id,
          rma: returnReq.rma_number,
        },
      });

      update = {
        status: 'refunded',
        refund_amount: refundAmount,
        stripe_refund_id: refund.id,
        refunded_at: new Date().toISOString(),
      };

      // Also mark the order as refunded.
      await supabase
        .from('orders')
        .update({
          status: 'refunded',
          stripe_refund_id: refund.id,
          refunded_at: new Date().toISOString(),
          refund_amount: refundAmount,
        })
        .eq('id', returnReq.order_id);
    } else {
      // Free-form field updates (admin_notes etc.).
      if (body.admin_notes !== undefined) update.admin_notes = body.admin_notes;
      if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'Aucune mise à jour' }, { status: 400 });
      }
    }

    const { data: updated, error: updErr } = await supabase
      .from('return_requests')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ return_request: updated });
  } catch (err: any) {
    console.error('Return update error:', err);
    return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 });
  }
}
