import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendFluxitronWebhook } from '@/lib/fluxitron-webhook';
import { toFluxitronOrder } from '@/app/api/v1/_lib/mappers';
import { sendOrderConfirmationEmail, sendNewOrderMerchantEmail, sendOrderRefundedEmail } from '@/lib/email';
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

  // 1. Enregistre le payment_intent dès maintenant (nécessaire pour un éventuel
  //    remboursement automatique ci-dessous). Le passage en 'paid' est différé :
  //    on ne valide la commande QUE si tout le stock a pu être décrémenté.
  await supabase
    .from('orders')
    .update({ stripe_payment_intent: session.payment_intent as string })
    .eq('id', orderId);

  // 2. Décrément de stock ATOMIQUE — et détection de SUR-VENTE.
  // decrement_stock(p_product_id, p_qty) fait `UPDATE … WHERE stock >= qty` sous
  // verrou de ligne : deux paiements concurrents sur le dernier exemplaire ne
  // peuvent pas réussir tous les deux. Retour -1 = stock insuffisant.
  //
  // Notre stock est un MIROIR de Foxway (push Fluxitron), il peut être périmé.
  // Si, au moment réel du paiement, ce miroir dit qu'un article n'est plus
  // disponible → SUR-VENTE : on ne peut pas honorer la commande. On la traite
  // alors par REMBOURSEMENT AUTOMATIQUE (voir handleOversoldOrder ci-dessous)
  // plutôt que d'encaisser un produit introuvable.
  // Repli : si la fonction SQL n'existe pas (migration 018 non appliquée), on
  // retombe sur read-then-write pour ne rien casser.
  const oversold: { name: string; requested: number }[] = [];
  const decremented: { productId: string; qty: number }[] = []; // pour restauration si annulation
  const { data: stockItems } = await supabase
    .from('order_items')
    .select('product_id, quantity, product_name')
    .eq('order_id', orderId);

  if (stockItems) {
    for (const item of stockItems) {
      if (!item.product_id) continue; // produit supprimé (snapshot conservé)
      const { data: remaining, error: rpcError } = await supabase.rpc('decrement_stock', {
        p_product_id: item.product_id,
        p_qty: item.quantity,
      });

      if (rpcError) {
        // Fonction absente / indisponible → repli non-atomique (comportement historique).
        console.warn(`decrement_stock RPC indisponible, repli read-then-write: ${rpcError.message}`);
        const { data: product } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.product_id)
          .single();
        if (product) {
          if (product.stock < item.quantity) {
            // Sur-vente détectée aussi en mode repli.
            oversold.push({ name: item.product_name || item.product_id, requested: item.quantity });
          } else {
            await supabase.from('products').update({ stock: product.stock - item.quantity }).eq('id', item.product_id);
            decremented.push({ productId: item.product_id, qty: item.quantity });
          }
        }
      } else if (remaining === -1) {
        // Stock insuffisant au moment du paiement : aucun décrément effectué.
        console.error(`⚠️ Stock insuffisant pour ${item.product_id} (qté ${item.quantity}) — commande ${orderId}`);
        oversold.push({ name: item.product_name || item.product_id, requested: item.quantity });
      } else {
        decremented.push({ productId: item.product_id, qty: item.quantity });
      }
    }
  }

  // ── SUR-VENTE → remboursement automatique + alertes, on n'encaisse pas ──────
  if (oversold.length > 0) {
    await handleOversoldOrder(session, supabase, { orderId, decremented, oversold });
    return; // stop : pas de passage en 'paid', pas d'email de confirmation, etc.
  }

  // 3. Tout le stock est honoré → la commande est définitivement payée.
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
      oversold: oversold.length ? oversold : undefined,
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
// Helper: une commande payée ne peut PAS être honorée (article indisponible au
// moment réel du paiement — miroir de stock périmé vs Foxway). On la rattrape
// proprement et automatiquement :
//   1. on restaure le stock qu'on avait décrémenté pour les autres articles ;
//   2. on rembourse intégralement le client via Stripe ;
//   3. on passe la commande en 'refunded' ;
//   4. on prévient le client (produit indisponible, remboursé) ;
//   5. on prévient le marchand (alerte sur-vente) ;
//   6. on annule la commande côté Fluxitron Hub.
// Aucune étape ne fait échouer le webhook : un échec partiel est loggué, jamais
// rejoué en boucle (l'event Stripe reste marqué traité par idempotence).
// ─────────────────────────────────────────────────────────────────────────────
async function handleOversoldOrder(
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof import('@/lib/supabase-admin').createAdminClient>,
  ctx: {
    orderId: string;
    decremented: { productId: string; qty: number }[];
    oversold: { name: string; requested: number }[];
  }
) {
  const { orderId, decremented, oversold } = ctx;
  console.error(
    `⛔ Commande ${orderId} non honorable (sur-vente: ${oversold
      .map((o) => o.name)
      .join(', ')}) — remboursement automatique.`
  );

  // 1. Restaurer le stock décrémenté pour les autres articles (on annule tout).
  for (const d of decremented) {
    const { error: rpcError } = await supabase.rpc('increment_stock', {
      p_product_id: d.productId,
      p_qty: d.qty,
    });
    if (rpcError) {
      // Repli read-then-write si la fonction n'existe pas (migration 019 non appliquée).
      const { data: product } = await supabase
        .from('products')
        .select('stock')
        .eq('id', d.productId)
        .single();
      if (product) {
        await supabase.from('products').update({ stock: product.stock + d.qty }).eq('id', d.productId);
      }
    }
  }

  // 2. Rembourser intégralement le paiement.
  const paymentIntentId = session.payment_intent as string | null;
  let refundOk = false;
  if (paymentIntentId) {
    try {
      await stripe.refunds.create({
        payment_intent: paymentIntentId,
        reason: 'requested_by_customer',
        metadata: { order_id: orderId, motif: 'stock_indisponible' },
      });
      refundOk = true;
    } catch (refundErr) {
      console.error(`❌ Échec remboursement automatique commande ${orderId}:`, refundErr);
    }
  } else {
    console.error(`❌ Pas de payment_intent pour rembourser la commande ${orderId}`);
  }

  // 3. Statut commande : 'refunded' si le remboursement est passé, sinon 'cancelled'
  //    (le marchand devra rembourser à la main — il est alerté ci-dessous).
  await supabase
    .from('orders')
    .update({ status: refundOk ? 'refunded' : 'cancelled' })
    .eq('id', orderId);

  // Charge la commande + lignes (emails client/marchand + webhook Fluxitron).
  const { data: fullOrder } = await supabase
    .from('orders')
    .select('*, profile:profiles(email, full_name, phone)')
    .eq('id', orderId)
    .single();
  const { data: fullItems } = await supabase
    .from('order_items')
    .select('*, product:products(brand, model, sku, images)')
    .eq('order_id', orderId);

  const orderNumber = fullOrder?.order_number || `TC-${orderId.slice(0, 8).toUpperCase()}`;
  const total = Number(fullOrder?.total_amount) || 0;
  const customerEmail = fullOrder?.profile?.email || (session.customer_details?.email ?? null);
  const customerName = fullOrder?.profile?.full_name ?? session.customer_details?.name ?? null;
  const lines = (fullItems || []).map((it: any) => ({
    name:
      it.product_name ||
      [it.product?.brand, it.product?.model].filter(Boolean).join(' ') ||
      'Article',
    quantity: it.quantity,
    unitPrice: Number(it.price_at_purchase) || 0,
  }));

  // 4. Email client : produit indisponible + remboursement.
  try {
    if (customerEmail) {
      const r = await sendOrderRefundedEmail({
        to: customerEmail,
        customerName,
        orderNumber,
        unavailable: oversold.map((o) => o.name),
        total,
        refunded: refundOk,
      });
      if (!r.sent) console.warn(`Email remboursement client non envoyé: ${r.reason}`);
    }
  } catch (e) {
    console.error('Erreur email remboursement client:', e);
  }

  // 5. Email marchand : alerte sur-vente + statut du remboursement automatique.
  try {
    const r2 = await sendNewOrderMerchantEmail({
      orderNumber,
      orderId,
      customerName,
      customerEmail,
      lines,
      total,
      shippingMethod: fullOrder?.shipping_method ?? null,
      oversold,
      autoRefunded: refundOk,
    });
    if (!r2.sent) console.warn(`Email alerte marchand non envoyé: ${r2.reason}`);
  } catch (e) {
    console.error('Erreur email alerte marchand:', e);
  }

  // 6. Annuler la commande côté Fluxitron Hub.
  try {
    if (fullOrder) {
      await sendFluxitronWebhook({
        topic: 'orders/cancel',
        data: toFluxitronOrder(fullOrder, fullItems || []),
      });
    }
  } catch (webhookErr) {
    console.error('Fluxitron webhook error (cancel oversold):', webhookErr);
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
