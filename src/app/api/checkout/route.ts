import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAuth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

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
            (sum, i) => sum + parseFloat(i.product.price) * i.quantity, 0
          );
          discountAmount = subtotal * (parseFloat(code.discount_value as unknown as string) / 100);
        }
      }
    }

    // Shipping costs
    const shippingCosts: Record<string, number> = {
      mondial_relay: 4.99,
      chronopost_domicile: 8.99,
      chronopost_relay: 6.99,
    };
    const shippingCost = shippingCosts[shipping_method] || 0;

    // Build Stripe line items
    const lineItems = cartItems.map((item) => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: `${item.product.brand} ${item.product.model}`,
          description: item.product.condition_description || undefined,
          images: item.product.images?.length > 0 ? [item.product.images[0]] : undefined,
        },
        unit_amount: Math.round(parseFloat(item.product.price) * 100), // cents
      },
      quantity: item.quantity,
    }));

    // Add shipping as a line item
    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: {
          name: `Livraison — ${shipping_method.replace('_', ' ')}`,
          description: undefined,
          images: undefined,
        },
        unit_amount: Math.round(shippingCost * 100),
      },
      quantity: 1,
    });

    // Create pre-order in DB (status: pending)
    const subtotal = cartItems.reduce(
      (sum, i) => sum + parseFloat(i.product.price) * i.quantity, 0
    );
    const totalAmount = subtotal + shippingCost - discountAmount;

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

    // Create order items
    const orderItems = cartItems.map((item) => ({
      order_id: order.id,
      product_id: item.product.id,
      quantity: item.quantity,
      price_at_purchase: parseFloat(item.product.price),
    }));

    await adminDb.from('order_items').insert(orderItems);

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cart`,
      customer_email: user!.email || undefined,
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
