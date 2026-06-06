import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/products/[id] — Get single product (admin view)
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const supabase = createAdminClient();

    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !product) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PUT /api/admin/products/[id] — Update a product
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const body = await request.json();
    const supabase = createAdminClient();

    const updateData: Record<string, any> = {};
    const allowedFields = [
      'brand', 'model', 'storage_capacity', 'color', 'imei', 'warranty',
      'condition_description', 'grade', 'battery_health', 'price',
      'compare_at_price', 'stock', 'images', 'category', 'is_active'
    ];

    // Chaîne vide → NULL pour les champs texte optionnels (cf. POST) : `imei`
    // est UNIQUE, donc plusieurs '' se heurteraient à la contrainte d'unicité.
    const nullableText = new Set([
      'storage_capacity', 'color', 'imei', 'warranty', 'condition_description', 'grade',
    ]);

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        const v = body[field];
        updateData[field] =
          nullableText.has(field) && typeof v === 'string' && v.trim() === '' ? null : v;
      }
    }

    if (updateData.price) updateData.price = parseFloat(updateData.price);
    if (updateData.compare_at_price) updateData.compare_at_price = parseFloat(updateData.compare_at_price);

    const { data: product, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !product) {
      return NextResponse.json({ error: error?.message || 'Produit introuvable' }, { status: 400 });
    }

    return NextResponse.json({ product });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE /api/admin/products/[id] — Delete a product
// ?mode=soft  → deactivate (set is_active = false)
// ?mode=hard  → permanently delete (default). Fails with 409 if referenced by past orders.
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') === 'soft' ? 'soft' : 'hard';

    const supabase = createAdminClient();

    if (mode === 'soft') {
      const { data: product, error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();

      if (error || !product) {
        return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
      }

      return NextResponse.json({ message: 'Produit désactivé', product });
    }

    // Hard delete — block if referenced in past orders
    const { count: orderRefs, error: countErr } = await supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id);

    if (countErr) {
      return NextResponse.json({ error: 'Erreur lors de la vérification des commandes' }, { status: 500 });
    }

    if ((orderRefs || 0) > 0) {
      return NextResponse.json(
        {
          error: 'Ce produit apparaît dans des commandes passées et ne peut pas être supprimé définitivement. Vous pouvez le désactiver à la place.',
          code: 'PRODUCT_HAS_ORDERS',
        },
        { status: 409 }
      );
    }

    const { error: deleteErr } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message || 'Erreur de suppression' }, { status: 400 });
    }

    return NextResponse.json({ message: 'Produit supprimé définitivement' });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
