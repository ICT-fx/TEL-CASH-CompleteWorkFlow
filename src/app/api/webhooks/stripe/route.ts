import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase-admin';
import Stripe from 'stripe';

// Disable body parsing — Stripe needs raw body
export const runtime = 'nodejs';

// POST /api/webhooks/stripe — Handle Stripe webhook events
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
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        const userId = session.metadata?.user_id;

        if (!orderId) {
          console.error('No order_id in session metadata');
          break;
        }

        // 1. Update order status to 'paid'
        await supabase
          .from('orders')
          .update({
            status: 'paid',
            stripe_payment_intent: session.payment_intent as string,
          })
          .eq('id', orderId);

        // 2. Get order items and decrement stock
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

        // 3. Clear user's cart
        if (userId) {
          await supabase
            .from('cart_items')
            .delete()
            .eq('user_id', userId);

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
        break;
      }

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

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}
