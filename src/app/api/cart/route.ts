import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requireAuth } from '@/lib/auth';

// GET /api/cart — Get user's cart with product details
export async function GET() {
  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    const supabase = await createServerSupabaseClient();
    const { data: items, error } = await supabase
      .from('cart_items')
      .select('*, product:products(*)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const total = items?.reduce((sum, item) => {
      return sum + (parseFloat(item.product.price) * item.quantity);
    }, 0) || 0;

    return NextResponse.json({ items, total });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/cart — Add item to cart
export async function POST(request: Request) {
  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    const { product_id, quantity = 1 } = await request.json();

    if (!product_id) {
      return NextResponse.json({ error: 'product_id requis' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // Check product exists and has stock
    const { data: product } = await supabase
      .from('products')
      .select('id, stock')
      .eq('id', product_id)
      .eq('is_active', true)
      .single();

    if (!product) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }

    if (product.stock < quantity) {
      return NextResponse.json({ error: 'Stock insuffisant' }, { status: 400 });
    }

    // Upsert — increment quantity if already in cart
    const { data: existing } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', user!.id)
      .eq('product_id', product_id)
      .single();

    let item;
    if (existing) {
      const { data, error } = await supabase
        .from('cart_items')
        .update({ quantity: existing.quantity + quantity })
        .eq('id', existing.id)
        .select('*, product:products(*)')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      item = data;
    } else {
      const { data, error } = await supabase
        .from('cart_items')
        .insert({ user_id: user!.id, product_id, quantity })
        .select('*, product:products(*)')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      item = data;
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
