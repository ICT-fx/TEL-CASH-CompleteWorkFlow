import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase-admin';
import Stripe from 'stripe';

// Disable body parsing — Stripe needs raw body
export const runtime = 'nodejs';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: handle a successful payment for a checkout session
// Used by both checkout.session.completed and checkout.session.async_payment_succeeded
// ─────────────────────────────────────────────────────────────────────────────
async function handleSuccessfulPayment(
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof import('@/lib/supabase-admin').createAdminClient>
) {
  const orderId = session.metadata?.order_id;
  const userId = session.metadata?.user_id;

  if (!orderId) {
    console.error('No order_id in session metadata');
    return;
  }

  // 1. Update order status to 'paid'
  await supabase
    .from('orders')
    .update({
      status: 'paid',
      stripe_payment_intent: session.payment_intent as string,
    })
    .eq('id', orderId);

  // 2. Decrement stock for each ordered item
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('product_id, quantity')
    .eq('order_id', orderId);

  if (orderItems) {
    for (const item of orderItems) {
      const { data: product } = await supabase
        .from('products')
        .select('stock')
        .eq('id', item.product_id)
        .single();

      if (product) {
        const newStock = Math.max(0, product.stock - item.quantity);
        await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', item.product_id);
      }
    }
  }

  if (userId) {
    // 3. Clear user's cart
    await supabase.from('cart_items').delete().eq('user_id', userId);

    // 4. Award loyalty points (1 point per euro spent)
    const pointsEarned = Math.floor(
      parseFloat(session.amount_total?.toString() || '0') / 100
    );
    if (pointsEarned > 0) {
      await supabase.from('loyalty_points').insert({
        user_id: userId,
        points: pointsEarned,
        reason: `Achat — Commande #${orderId.slice(0, 8)}`,
        order_id: orderId,
      });
    }

    // 5. If referral code was used, increment usage
    const { data: order } = await supabase
      .from('orders')
      .select('referral_code_used')
      .eq('id', orderId)
      .single();

    if (order?.referral_code_used) {
      const { data: code } = await supabase
        .from('referral_codes')
        .select('id, times_used, max_uses')
        .eq('code', order.referral_code_used)
        .single();

      if (code) {
        await supabase
          .from('referral_codes')
          .update({
            times_used: code.times_used + 1,
            is_active: code.times_used + 1 < code.max_uses,
          })
          .eq('id', code.id);
      }
    }
  }

  console.log(`✅ Order ${orderId} paid successfully`);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/stripe — Handle Stripe webhook events
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const sig = headersList.get('stripe-signature');

    if (!sig) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const supabase = createAdminClient();

    switch (event.type) {

      // ── 1. Paiement immédiat confirmé ──────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        // Only process synchronous payments here.
        // Async (e.g. bank transfer) payments are handled by async_payment_succeeded.
        if (session.payment_status === 'paid') {
          await handleSuccessfulPayment(session, supabase);
        } else {
          // Mark order as awaiting async payment
          const orderId = session.metadata?.order_id;
          if (orderId) {
            await supabase
              .from('orders')
              .update({ status: 'awaiting_payment' })
              .eq('id', orderId);
            console.log(`⏳ Order ${orderId} awaiting async payment`);
          }
        }
        break;
      }

      // ── 2. Session expirée ────────────────────────────────────────────────
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        if (orderId) {
          await supabase
            .from('orders')
            .update({ status: 'cancelled' })
            .eq('id', orderId);
          console.log(`❌ Order ${orderId} cancelled (session expired)`);
        }
        break;
      }

      // ── 3. Paiement différé accepté (ex: virement) ────────────────────────
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleSuccessfulPayment(session, supabase);
        break;
      }

      // ── 4. Paiement différé échoué ────────────────────────────────────────
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        if (orderId) {
          await supabase
            .from('orders')
            .update({ status: 'failed' })
            .eq('id', orderId);
          console.log(`❌ Order ${orderId} failed (async payment failed)`);
        }
        break;
      }

      // ── 5. PaymentIntent réussi (filet de sécurité) ───────────────────────
      // Triggered regardless of checkout session. Marks order paid if not already.
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const { data: order } = await supabase
          .from('orders')
          .select('id, status')
          .eq('stripe_payment_intent', intent.id)
          .maybeSingle();

        if (order && order.status !== 'paid') {
          await supabase
            .from('orders')
            .update({ status: 'paid' })
            .eq('id', order.id);
          console.log(`✅ Order ${order.id} paid via payment_intent.succeeded`);
        }
        break;
      }

      // ── 6. PaymentIntent échoué ───────────────────────────────────────────
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const failureMessage = intent.last_payment_error?.message ?? 'Unknown error';

        const { data: order } = await supabase
          .from('orders')
          .select('id')
          .eq('stripe_payment_intent', intent.id)
          .maybeSingle();

        if (order) {
          await supabase
            .from('orders')
            .update({ status: 'failed' })
            .eq('id', order.id);
          console.log(`❌ Order ${order.id} failed: ${failureMessage}`);
        }
        break;
      }

      // ── 7. Remboursement ──────────────────────────────────────────────────
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;

        if (paymentIntentId) {
          const { data: order } = await supabase
            .from('orders')
            .select('id')
            .eq('stripe_payment_intent', paymentIntentId)
            .maybeSingle();

          if (order) {
            await supabase
              .from('orders')
              .update({ status: 'refunded' })
              .eq('id', order.id);
            console.log(`💸 Order ${order.id} refunded`);
          }
        }
        break;
      }

      // ── 8. Litige ouvert ──────────────────────────────────────────────────
      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId = dispute.charge as string;

        // Find the order via the charge's payment intent
        let orderId: string | null = null;
        try {
          const charge = await stripe.charges.retrieve(chargeId);
          const paymentIntentId = charge.payment_intent as string;

          if (paymentIntentId) {
            const { data: order } = await supabase
              .from('orders')
              .select('id')
              .eq('stripe_payment_intent', paymentIntentId)
              .maybeSingle();

            if (order) {
              orderId = order.id;
              await supabase
                .from('orders')
                .update({ status: 'disputed' })
                .eq('id', order.id);
            }
          }
        } catch (err) {
          console.error('Could not retrieve charge for dispute:', err);
        }

        // Insert dispute record
        await supabase.from('disputes').insert({
          order_id: orderId,
          stripe_dispute_id: dispute.id,
          stripe_charge_id: chargeId,
          amount: dispute.amount / 100,
          currency: dispute.currency,
          reason: dispute.reason,
          status: dispute.status,
        });

        console.log(`⚠️  Dispute ${dispute.id} created — Order ${orderId ?? 'unknown'}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}
