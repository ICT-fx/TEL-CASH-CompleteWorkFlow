import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendFluxitronWebhook } from '@/lib/fluxitron-webhook';
import { toFluxitronOrder } from '@/app/api/v1/_lib/mappers';
import { sendOrderConfirmationEmail, sendNewOrderMerchantEmail } from '@/lib/email';
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

  // 1. Enregistre le payment_intent (utilisé pour relier les événements Stripe
  //    ultérieurs : charge.refunded après un remboursement MANUEL par l'admin,
  //    payment_intent.succeeded, litiges).
  await supabase
    .from('orders')
    .update({ stripe_payment_intent: session.payment_intent as string })
    .eq('id', orderId);

  // 2. Vérification INFORMATIVE de la disponibilité fournisseur.
  // Modèle vente-à-la-commande : le stock interne (products.stock) ne
  // conditionne PAS l'encaissement. La disponibilité client est gérée en amont
  // par le grisage catalogue (v_catalog_products.greyed_by_supplier : vendable
  // seulement si le miroir Fluxitron est frais avec stock > 0 — migrations
  // 022/029). Ici on ne fait qu'ALERTER le marchand si, au moment du paiement,
  // le miroir n'indique plus de stock pour un article. AUCUN remboursement
  // automatique : la commande est encaissée, et c'est l'admin qui rembourse
  // manuellement (dashboard Stripe) si elle ne peut pas être honorée — le
  // handler charge.refunded passera alors la commande en 'refunded'.
  let supplierUnavailable: { name: string; requested: number }[] = [];
  try {
    const { data: stockItems } = await supabase
      .from('order_items')
      .select('product_id, quantity, product_name')
      .eq('order_id', orderId);
    const productIds = (stockItems || [])
      .map((i) => i.product_id)
      .filter(Boolean);
    if (productIds.length > 0) {
      const { data: catalog } = await supabase
        .from('v_catalog_products')
        .select('id, greyed_by_supplier')
        .in('id', productIds);
      const greyed = new Set(
        (catalog || []).filter((c) => c.greyed_by_supplier).map((c) => c.id)
      );
      supplierUnavailable = (stockItems || [])
        .filter((i) => i.product_id && greyed.has(i.product_id))
        .map((i) => ({ name: i.product_name || i.product_id, requested: i.quantity }));
      if (supplierUnavailable.length > 0) {
        console.warn(
          `⚠️ Dispo fournisseur à vérifier — commande ${orderId}: ${supplierUnavailable
            .map((o) => o.name)
            .join(', ')} (pas de remboursement automatique, décision admin)`
        );
      }
    }
  } catch (availErr) {
    // Purement informatif : ne bloque jamais l'encaissement.
    console.warn('Vérification dispo fournisseur impossible:', availErr);
  }

  // 3. Paiement reçu → la commande est définitivement payée.
  await supabase
    .from('orders')
    .update({ status: 'paid' })
    .eq('id', orderId);

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

  // On charge la commande complète + ses lignes une seule fois, réutilisé pour
  // les emails (client + marchand) ET le webhook Fluxitron.
  const { data: fullOrder } = await supabase
    .from('orders')
    .select('*, profile:profiles(email, full_name, phone)')
    .eq('id', orderId)
    .single();

  const { data: fullItems } = await supabase
    .from('order_items')
    .select('*, product:products(brand, model, sku, images)')
    .eq('order_id', orderId);

  // ── Emails transactionnels ────────────────────────────────────────────────
  // Idempotents par construction : tout handleSuccessfulPayment est gardé par la
  // table stripe_events (un même event Stripe n'est traité qu'une fois), donc
  // ces emails ne partent qu'une seule fois par commande.
  try {
    const lines = (fullItems || []).map((it: any) => ({
      name:
        it.product_name ||
        [it.product?.brand, it.product?.model].filter(Boolean).join(' ') ||
        'Article',
      quantity: it.quantity,
      unitPrice: Number(it.price_at_purchase) || 0,
    }));
    const orderNumber = fullOrder?.order_number || `TC-${orderId.slice(0, 8).toUpperCase()}`;
    const total = Number(fullOrder?.total_amount) || 0;
    const customerEmail = fullOrder?.profile?.email || (session.customer_details?.email ?? null);
    const customerName = fullOrder?.profile?.full_name ?? session.customer_details?.name ?? null;

    // 1. Confirmation client (la facture PDF est envoyée séparément par Stripe).
    if (customerEmail) {
      const r = await sendOrderConfirmationEmail({
        to: customerEmail,
        customerName,
        orderNumber,
        lines,
        total,
        deliveryMethod: fullOrder?.delivery_method ?? null,
      });
      if (!r.sent) console.warn(`Email confirmation client non envoyé: ${r.reason}`);
    }

    // 2. Notification marchand (toujours, même si l'email client manque).
    const r2 = await sendNewOrderMerchantEmail({
      orderNumber,
      orderId,
      customerName,
      customerEmail,
      lines,
      total,
      shippingMethod: fullOrder?.shipping_method ?? null,
      deliveryMethod: fullOrder?.delivery_method ?? null,
      supplierUnavailable: supplierUnavailable.length ? supplierUnavailable : undefined,
    });
    if (!r2.sent) console.warn(`Email notification marchand non envoyé: ${r2.reason}`);
  } catch (emailErr) {
    console.error('Erreur envoi emails commande:', emailErr);
    // Ne jamais faire échouer le webhook à cause d'un email.
  }

  // ── Notify Fluxitron Hub ──────────────────────────────────────────────────
  try {
    if (fullOrder) {
      await sendFluxitronWebhook({
        topic: 'orders/create',
        data: toFluxitronOrder(fullOrder, fullItems || []),
      });
    }
  } catch (webhookErr) {
    console.error('Fluxitron webhook error:', webhookErr);
    // Don't fail the main flow for webhook errors
  }
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

    // ── Garde d'IDEMPOTENCE ───────────────────────────────────────────────────
    // Stripe peut livrer le MÊME événement plusieurs fois (retry après timeout,
    // double-delivery). On enregistre event.id AVANT de traiter : la 2ᵉ tentative
    // échoue sur la clé primaire et on sort sans rejouer (pas de 2ᵉ commande, pas
    // de double décrément de stock, pas d'email en double).
    // Repli : si la table stripe_events n'existe pas encore (migration 018 non
    // appliquée), on log et on continue → comportement historique, rien de cassé.
    const { error: idemError } = await supabase
      .from('stripe_events')
      .insert({ id: event.id, type: event.type });

    if (idemError) {
      // 23505 = violation de clé primaire → événement déjà traité.
      if (idemError.code === '23505') {
        console.log(`↩️  Event ${event.id} déjà traité — ignoré (idempotence)`);
        return NextResponse.json({ received: true, duplicate: true });
      }
      // 42P01 = table absente (migration non appliquée) ou autre erreur : on log
      // et on poursuit le traitement pour ne pas perdre l'événement.
      console.warn(`Idempotence indisponible (${idemError.code}): ${idemError.message}`);
    }

    // Si le traitement échoue après avoir posé le marqueur, on le retire pour que
    // Stripe puisse rejouer l'événement (sinon il serait perdu définitivement).
    const rollbackIdempotency = async () => {
      try {
        await supabase.from('stripe_events').delete().eq('id', event.id);
      } catch {
        /* best-effort */
      }
    };

    try {
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

          // Notify Fluxitron Hub
          try {
            const { data: cancelledOrder } = await supabase
              .from('orders')
              .select('*, profile:profiles(email, full_name, phone)')
              .eq('id', orderId)
              .single();

            const { data: cancelledItems } = await supabase
              .from('order_items')
              .select('*, product:products(brand, model, sku, images)')
              .eq('order_id', orderId);

            if (cancelledOrder) {
              await sendFluxitronWebhook({
                topic: 'orders/cancel',
                data: toFluxitronOrder(cancelledOrder, cancelledItems || []),
              });
            }
          } catch (webhookErr) {
            console.error('Fluxitron webhook error:', webhookErr);
          }
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
      // Allowlist : ne promeut que les statuts « en attente de paiement ». Ne
      // touche jamais à refunded/cancelled (remboursement manuel admin) ni aux
      // statuts de préparation/expédition (livraison des events non ordonnée).
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const { data: order } = await supabase
          .from('orders')
          .select('id, status')
          .eq('stripe_payment_intent', intent.id)
          .maybeSingle();

        if (order && ['pending', 'awaiting_payment', 'failed'].includes(order.status)) {
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
            .select('id, status')
            .eq('stripe_payment_intent', paymentIntentId)
            .maybeSingle();

          // Ne pas écraser une annulation admin (cancelled) ni un état déjà
          // remboursé. Couvre encore les remboursements faits depuis le
          // dashboard Stripe sur une commande non annulée.
          if (order && order.status !== 'cancelled' && order.status !== 'refunded') {
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

      // ── 9. Litige mis à jour / clôturé — rafraîchit le statut ──────────────
      case 'charge.dispute.updated':
      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute;
        // Met à jour la ligne créée par charge.dispute.created. La livraison des
        // webhooks Stripe n'est pas ordonnée : si 'updated' précède 'created',
        // aucune ligne ne matche — on le signale au lieu de logguer un faux succès.
        const { error: disputeUpdateError, count } = await supabase
          .from('disputes')
          .update({ status: dispute.status }, { count: 'exact' })
          .eq('stripe_dispute_id', dispute.id);
        if (disputeUpdateError) {
          console.error(`Dispute update error for ${dispute.id}:`, disputeUpdateError);
        } else if (count === 0) {
          console.warn(`⚖️  Dispute ${dispute.id} absent en base — mise à jour ignorée (${dispute.status})`);
        } else {
          console.log(`⚖️  Dispute ${dispute.id} → ${dispute.status}`);
        }
        // Décision produit : on NE change PAS le statut de la commande même si
        // dispute.status === 'lost'. L'admin décide d'un éventuel passage en refunded.
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    } catch (handlerErr) {
      // Le traitement a échoué APRÈS la pose du marqueur d'idempotence : on le
      // retire pour que la nouvelle tentative de Stripe puisse rejouer l'event.
      await rollbackIdempotency();
      throw handlerErr;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}
