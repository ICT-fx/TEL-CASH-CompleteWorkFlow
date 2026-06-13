import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAuth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { runFraudChecks } from '@/lib/fraud-guards';
import { coherentSkuPrice, type RawProduct } from '@/lib/productVariants';
import { SHIPPING_FEE_EUR, SHIPPING_LABEL } from '@/lib/shipping';

// Pied de page imprimé sur la facture PDF (mentions légales).
// Source : /mentions (PC ANGERS / enseigne Tel and Cash).
const INVOICE_FOOTER = [
  'PC ANGERS (enseigne Tel and Cash) — EURL au capital de 10 000 €',
  '10 rue Saint-Étienne, 49100 Angers, France',
  'RCS Angers 985 009 695 · TVA intracommunautaire FR48985009695',
  'Tél. 02 85 35 95 32 · contact@telandcash.fr',
  'Téléphones reconditionnés — garantie légale de conformité applicable.',
].join('\n');

// POST /api/checkout — Create Stripe Checkout session
export async function POST(request: Request) {
  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    const body = await request.json();
    const { shipping_method, shipping_address, referral_code } = body;

    if (!shipping_method) {
      return NextResponse.json({ error: 'Méthode de livraison requise' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // Get cart items
    const { data: cartItems, error: cartError } = await supabase
      .from('cart_items')
      .select('*, product:products(*)')
      .eq('user_id', user!.id);

    if (cartError || !cartItems || cartItems.length === 0) {
      return NextResponse.json({ error: 'Panier vide' }, { status: 400 });
    }

    // Verify stock for all items
    for (const item of cartItems) {
      if (item.product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Stock insuffisant pour ${item.product.brand} ${item.product.model}` },
          { status: 400 }
        );
      }
    }

    // Prix de vente COHÉRENT (Grade A ≥ B ≥ C), identique à l'affichage vitrine.
    // On recalcule ici pour garantir paiement == prix affiché (pas d'écart).
    const priceDb = createAdminClient();
    const sibCache = new Map<string, RawProduct[]>();
    const unitPrice = new Map<string, number>();
    for (const item of cartItems) {
      const p = item.product;
      const mk = `${p.brand}|${p.model}`;
      let sibs = sibCache.get(mk);
      if (!sibs) {
        const { data } = await priceDb
          .from('products')
          .select('id,brand,model,storage_capacity,color,grade,price,stock,is_active')
          .eq('is_active', true)
          .eq('brand', p.brand)
          .eq('model', p.model);
        sibs = (data && data.length ? data : [p]) as RawProduct[];
        sibCache.set(mk, sibs);
      }
      unitPrice.set(item.id, coherentSkuPrice(sibs, p as RawProduct));
    }
    const priceOf = (item: { id: string; product: { price: string | number } }) =>
      unitPrice.get(item.id) ?? (Number(item.product.price) || 0);

    // Calculate discount if referral code provided
    let discountAmount = 0;
    if (referral_code) {
      const adminDb = createAdminClient();
      const { data: code } = await adminDb
        .from('referral_codes')
        .select('*')
        .eq('code', referral_code)
        .eq('is_active', true)
        .single();

      if (code && code.times_used < code.max_uses) {
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

    // Build Stripe line items
    const lineItems = cartItems.map((item) => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: `${item.product.brand} ${item.product.model}`,
          description: item.product.condition_description || undefined,
          images: item.product.images?.length > 0 ? [item.product.images[0]] : undefined,
        },
        unit_amount: Math.round(priceOf(item) * 100), // cents (prix cohérent)
      },
      quantity: item.quantity,
    }));

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

    const fraudCheck = await runFraudChecks({
      userId: user!.id,
      email: user!.email || '',
      ip,
      totalAmount,
      productImeis: cartItems.map((i) => i.product.imei).filter(Boolean) as string[],
    });
    if (fraudCheck.blocked) {
      return NextResponse.json({ error: fraudCheck.reason }, { status: 403 });
    }

    const adminDb = createAdminClient();
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
      price_at_purchase: parseFloat(item.product.price),
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
