import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAuth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { runFraudChecks } from '@/lib/fraud-guards';
import { SHIPPING_FEE_EUR, SHIPPING_LABEL } from '@/lib/shipping';
import { isReferralCodeUsable } from '@/lib/referral';

// Pied de page imprimé sur la facture PDF (mentions légales).
// Source : /mentions (PC ANGERS / enseigne Tel and Cash).
const INVOICE_FOOTER = [
  'PC ANGERS (enseigne Tel and Cash) — EURL au capital de 10 000 €',
  '10 rue Saint-Étienne, 49100 Angers, France',
  'RCS Angers 985 009 695 · TVA intracommunautaire FR48985009695',
  'Tél. 02 85 35 95 32 · infos@telandcash.fr',
  'Téléphones reconditionnés — garantie légale de conformité applicable.',
].join('\n');

// POST /api/checkout — Create Stripe Checkout session
export async function POST(request: Request) {
  try {
    // ⚠️ HOTFIX PROD : guest checkout TEMPORAIREMENT DÉSACTIVÉ, en attente de la
    // migration 033 (orders.guest_email + user_id nullable). Sans elle, tout
    // insert référençant guest_email échoue en 500 — y compris pour les clients
    // connectés. On revient donc au paiement RÉSERVÉ AUX COMPTES, sans jamais
    // toucher à la colonne guest_email. Le code invité complet est préservé sur
    // la branche feat/guest-checkout et se re-déploie dès la migration appliquée.
    const { user, response } = await requireAuth();
    if (response) return response;

    const supabase = await createServerSupabaseClient();
    const adminDb = createAdminClient();

    const body = await request.json();
    const { shipping_method, shipping_address, referral_code } = body;

    if (!shipping_method) {
      return NextResponse.json({ error: 'Méthode de livraison requise' }, { status: 400 });
    }

    // Panier serveur (source de vérité).
    const { data: cartData, error: cartError } = await supabase
      .from('cart_items')
      .select('*, product:products(*)')
      .eq('user_id', user!.id);
    if (cartError) {
      return NextResponse.json({ error: 'Panier indisponible' }, { status: 400 });
    }
    const cartItems: Array<{ product: any; quantity: number }> =
      (cartData || []).map((ci: any) => ({ product: ci.product, quantity: ci.quantity }));

    if (cartItems.length === 0) {
      return NextResponse.json({ error: 'Panier vide' }, { status: 400 });
    }

    // Garde-fou prix : on ne crée JAMAIS de commande / session Stripe avec un
    // article sans prix (0 ou non défini) ou désactivé entre-temps — sinon on
    // facturerait 0 €. Le client doit retirer ces lignes du panier.
    const invalidItems = cartItems.filter(
      (i) => !i.product || i.product.is_active === false || !(Number(i.product.price) > 0)
    );
    if (invalidItems.length > 0) {
      const names = invalidItems
        .map((i) => `${i.product?.brand ?? ''} ${i.product?.model ?? ''}`.trim())
        .filter(Boolean)
        .join(', ');
      return NextResponse.json(
        {
          error: `Certains articles ne sont plus disponibles à la vente${names ? ` : ${names}` : ''}. Merci de les retirer du panier.`,
        },
        { status: 409 }
      );
    }

    // Sell-to-order : pas de vérification de stock au checkout.
    // La disponibilité = is_active (filtré dans la query panier).
    // Le prix facturé = products.price stocké (prix manuel).

    // Prix manuels : on facture le products.price STOCKÉ de la ligne (source de
    // vérité). Plus de recalcul de cohérence runtime — la couleur ne change pas
    // le prix, le prix affiché en fiche == products.price == prix Stripe.
    const priceOf = (item: { product: { price: string | number } }) =>
      Number(item.product.price) || 0;

    // Calculate discount if referral code provided
    let discountAmount = 0;
    if (referral_code) {
      const { data: code } = await adminDb
        .from('referral_codes')
        .select('*')
        .eq('code', referral_code)
        .single();

      if (code && isReferralCodeUsable(code, new Date())) {
        if (code.discount_type === 'fixed') {
          discountAmount = parseFloat(code.discount_value as unknown as string);
        } else {
          const subtotal = cartItems.reduce(
            (sum, i) => sum + priceOf(i) * i.quantity, 0
          );
          discountAmount = subtotal * (parseFloat(code.discount_value as unknown as string) / 100);
        }
      }
    }

    // Frais de livraison : une seule option payante (Chronopost express).
    const shippingCost = SHIPPING_FEE_EUR;

    // Stripe exige des URLs d'images ABSOLUES (http/https). Les photos importées
    // en chemin relatif (« /images/… ») faisaient échouer la création de session
    // (StripeInvalidRequestError: url_invalid → 500). On préfixe avec l'URL du
    // site, et on omet l'image si aucune URL absolue n'est possible.
    const toStripeImage = (img: unknown): string | undefined => {
      if (typeof img !== 'string' || !img) return undefined;
      if (/^https?:\/\//i.test(img)) return img;
      const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
      if (/^https?:\/\//i.test(base) && img.startsWith('/')) return `${base}${img}`;
      return undefined;
    };

    // Build Stripe line items
    const lineItems = cartItems.map((item) => {
      const img = toStripeImage(item.product.images?.[0]);
      return {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${item.product.brand} ${item.product.model}`,
            description: item.product.condition_description || undefined,
            images: img ? [img] : undefined,
          },
          unit_amount: Math.round(priceOf(item) * 100), // cents (prix stocké)
        },
        quantity: item.quantity,
      };
    });

    // Add shipping as a line item
    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: {
          name: SHIPPING_LABEL,
          description: undefined,
          images: undefined,
        },
        unit_amount: Math.round(shippingCost * 100),
      },
      quantity: 1,
    });

    // Create pre-order in DB (status: pending)
    const subtotal = cartItems.reduce(
      (sum, i) => sum + priceOf(i) * i.quantity, 0
    );
    const totalAmount = subtotal + shippingCost - discountAmount;

    // ── Anti-fraud pre-checkout guards ─────────────────────────────────────
    // Blocks: blocklisted email/ip/user/imei, disposable email domains,
    //         new-account first-order amount cap.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || null;

    // Garde-fou anti-abus : on contrôle le montant MARCHANDISE (subtotal, hors
    // frais de port). userId null = invité → plafond à plat (cf. fraud-guards).
    const fraudCheck = await runFraudChecks({
      userId: user!.id,
      email: user!.email || '',
      ip,
      goodsAmount: subtotal,
      productImeis: cartItems.map((i) => i.product.imei).filter(Boolean) as string[],
    });
    if (fraudCheck.blocked) {
      return NextResponse.json({ error: fraudCheck.reason }, { status: 403 });
    }

    const { data: order, error: orderError } = await adminDb
      .from('orders')
      .insert({
        user_id: user!.id,
        total_amount: totalAmount,
        status: 'pending',
        shipping_method,
        shipping_address: shipping_address || null,
        referral_code_used: referral_code || null,
        discount_amount: discountAmount,
      })
      .select()
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Erreur création commande' }, { status: 500 });
    }

    // Create order items.
    // product_name / product_sku are snapshots frozen at purchase time so the
    // order keeps showing what was bought even after the product is deleted.
    const orderItems = cartItems.map((item) => ({
      order_id: order.id,
      product_id: item.product.id,
      quantity: item.quantity,
      // Prix RÉELLEMENT facturé = products.price stocké (prix manuel), identique
      // à l'affichage fiche et au montant Stripe.
      price_at_purchase: priceOf(item),
      cost_at_purchase:
        item.product.cost_price != null
          ? parseFloat(item.product.cost_price)
          : parseFloat(item.product.price),
      product_name: [item.product.brand, item.product.model, item.product.storage_capacity]
        .filter(Boolean)
        .join(' ') || null,
      product_sku: item.product.sku || null,
    }));

    await adminDb.from('order_items').insert(orderItems);

    // Create Stripe session
    // payment_method_types omis volontairement : Stripe affiche automatiquement
    // les moyens de paiement activés dans le dashboard (Apple Pay, Google Pay, cartes, etc.)
    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: 'payment',
      // Page Checkout en français (la facture suit la langue du client → A4 en FR).
      locale: 'fr',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cart`,
      customer_email: user!.email || undefined,
      // Adresse de facturation requise pour que la facture PDF soit complète.
      billing_address_collection: 'required',
      // Génère une vraie facture PDF (envoyée par mail) en plus du reçu.
      // Prérequis Dashboard : Réglages → E-mails clients → « Paiements réussis ».
      invoice_creation: {
        enabled: true,
        invoice_data: {
          footer: INVOICE_FOOTER,
          // Max 4 champs personnalisés affichés dans l'en-tête de la facture.
          custom_fields: [
            { name: 'N° de commande', value: order.id.slice(0, 8).toUpperCase() },
          ],
          metadata: {
            order_id: order.id,
          },
        },
      },
      metadata: {
        order_id: order.id,
        user_id: user!.id,
      },
      ...(discountAmount > 0 && {
        discounts: [],
      }),
    });

    // Update order with stripe session ID
    await adminDb
      .from('orders')
      .update({ stripe_session_id: session.id })
      .eq('id', order.id);

    return NextResponse.json({
      sessionId: session.id,
      sessionUrl: session.url,
      orderId: order.id,
    });
  } catch (err) {
    console.error('Checkout error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
