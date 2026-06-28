import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { buildOrderNumberMap } from '@/lib/orderNumber';
import { sendOrderCancelledEmail } from '@/lib/email';
import { sendFluxitronWebhook } from '@/lib/fluxitron-webhook';
import { toFluxitronOrder } from '@/app/api/v1/_lib/mappers';

// Statuts depuis lesquels un admin peut annuler + rembourser (avant expédition).
const CANCELLABLE = ['paid', 'supplier_ordered'];

// POST /api/admin/orders/[id]/refund — Annule la commande + rembourse via Stripe.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const body = await request.json().catch(() => ({} as any));
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) {
      return NextResponse.json(
        { error: 'Le message au client (raison) est obligatoire.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, profile:profiles(email, full_name)')
      .eq('id', id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    // ── Garde-fous ────────────────────────────────────────────────────────
    if (!CANCELLABLE.includes(order.status)) {
      return NextResponse.json(
        { error: 'Cette commande ne peut plus être annulée à ce stade.' },
        { status: 409 }
      );
    }
    if (order.refunded_at || order.stripe_refund_id) {
      return NextResponse.json({ error: 'Commande déjà remboursée.' }, { status: 409 });
    }
    if (!order.stripe_payment_intent) {
      return NextResponse.json(
        { error: 'Paiement non capturé — remboursement impossible.' },
        { status: 400 }
      );
    }

    const total = parseFloat(order.total_amount || '0');
    const amount =
      body.amount === undefined || body.amount === null ? total : Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > total + 0.001) {
      return NextResponse.json(
        { error: `Montant invalide (entre 0,01 € et ${total.toFixed(2)} €).` },
        { status: 400 }
      );
    }
    const cents = Math.round(amount * 100);

    // ── Remboursement Stripe (avant toute mutation de la commande) ────────
    let refund: { id: string };
    try {
      refund = await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent,
        amount: cents,
        reason: 'requested_by_customer',
        metadata: { order_id: order.id, admin_id: profile.id },
      });
    } catch (e: any) {
      return NextResponse.json(
        { error: `Échec du remboursement Stripe : ${e?.message || 'erreur inconnue'}` },
        { status: 502 }
      );
    }

    // Reçu Stripe (page hébergée du paiement, qui reflète le remboursement) —
    // affiché au client comme preuve. Best-effort : un échec ici ne doit pas
    // bloquer la mise à jour de la commande (le remboursement est déjà parti).
    let receiptUrl: string | null = null;
    try {
      const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent, {
        expand: ['latest_charge'],
      });
      const charge = pi.latest_charge;
      if (charge && typeof charge !== 'string') {
        receiptUrl = charge.receipt_url ?? null;
      }
    } catch (e) {
      console.error('[refund] récupération du reçu Stripe échouée:', e);
    }

    // ── Mise à jour de la commande ────────────────────────────────────────
    const nowIso = new Date().toISOString();
    const stamp = new Date().toLocaleString('fr-FR');
    const noteLine = `[${stamp}] Annulée + remboursée (${amount.toFixed(2)} €) — ${reason}`;
    const newNotes = order.notes ? `${order.notes}\n${noteLine}` : noteLine;

    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        stripe_refund_id: refund.id,
        refund_amount: amount,
        refunded_at: nowIso,
        cancellation_reason: reason,
        stripe_receipt_url: receiptUrl,
        notes: newNotes,
      })
      .eq('id', order.id);

    if (updateErr) {
      // Cas critique : l'argent est parti (remboursement Stripe OK) mais la commande
      // n'a pas pu être mise à jour → divergence à réconcilier manuellement. Surtout
      // NE PAS réessayer : les marqueurs d'idempotence n'ont pas été écrits, un nouvel
      // appel relancerait un remboursement (double remboursement).
      console.error(
        `[refund] CRITIQUE: remboursement Stripe ${refund.id} effectué mais échec de ` +
          `mise à jour de la commande ${order.id}:`,
        updateErr
      );
      return NextResponse.json(
        {
          error:
            `Remboursement Stripe effectué (réf. ${refund.id}) mais la mise à jour de la ` +
            `commande a échoué. Ne relancez pas le remboursement — vérifiez la commande et ` +
            `contactez le support si besoin.`,
          refundId: refund.id,
        },
        { status: 500 }
      );
    }

    // Numéro de commande lisible (n°1, n°2…) pour l'email.
    const { data: allOrders } = await supabase.from('orders').select('id, created_at');
    const num = buildOrderNumberMap(allOrders || []).get(order.id);
    const orderNumber = num != null ? `n°${num}` : `#${order.id.slice(0, 8)}`;

    // ── Email client (best-effort) ────────────────────────────────────────
    let emailSent = false;
    const customerEmail = (order as any).profile?.email || null;
    if (customerEmail) {
      const r = await sendOrderCancelledEmail({
        to: customerEmail,
        customerName: (order as any).profile?.full_name,
        orderNumber,
        reason,
        refundAmount: amount,
      });
      emailSent = r.sent;
      if (!r.sent) console.error('[refund] email non envoyé:', r.reason);
    }

    // ── Webhook Fluxitron orders/cancel (fire-and-forget) ─────────────────
    try {
      const { data: cancelledOrder } = await supabase
        .from('orders').select('*').eq('id', order.id).single();
      const { data: cancelledItems } = await supabase
        .from('order_items')
        .select('*, product:products(brand, model, sku, images)')
        .eq('order_id', order.id);
      if (cancelledOrder) {
        await sendFluxitronWebhook({
          topic: 'orders/cancel',
          data: toFluxitronOrder(cancelledOrder, cancelledItems || []),
        });
      }
    } catch (webhookErr) {
      console.error('Fluxitron webhook error:', webhookErr);
    }

    return NextResponse.json({
      ok: true,
      refundId: refund.id,
      status: 'cancelled',
      emailSent,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
