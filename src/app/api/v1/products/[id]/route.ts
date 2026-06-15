import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../../_lib/fluxitron-auth';
import { createAdminClient } from '@/lib/supabase-admin';
import {
  toFluxitronProduct,
  fromFluxitronProductUpdate,
} from '../../_lib/mappers';

// GET /api/v1/products/:id — Get a single product
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const supabase = createAdminClient();

    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !product) {
      return NextResponse.json(
        { error: 'Not found', details: `No product with ID ${id} exists` },
        { status: 404 }
      );
    }

    // Notre boutique est mono-variante, mais Fluxitron pousse des produits
    // multi-variantes éclatés en N lignes sœurs partageant un `fluxitron_group_id`
    // (= l'id du parent enregistré par Fluxitron). On renvoie TOUTES les variantes
    // du groupe sous l'id demandé pour que le contrôle de dérive de Fluxitron
    // retrouve la variante qu'il a enregistrée (sinon : 97 % skippedNoVariant).
    const groupId = product.fluxitron_group_id || product.id;
    const { data: members } = await supabase
      .from('products')
      .select('*')
      .eq('fluxitron_group_id', groupId)
      .order('created_at', { ascending: true });

    const groupRows = members && members.length > 0 ? members : [product];
    // Les champs niveau produit (titre, images, description) viennent de la ligne
    // demandée → product.id reste l'id demandé (stable pour Fluxitron).
    const base = toFluxitronProduct(product);
    const grouped = {
      ...base,
      variants: groupRows.map((m) => toFluxitronProduct(m).variants[0]),
    };

    const res = NextResponse.json(grouped);
    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error getting product:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT /api/v1/products/:id — Partial update
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const updateData = fromFluxitronProductUpdate(body);

    // [FLX-DIAG] Diagnostic temporaire — capture ce que Fluxitron envoie sur
    // une mise à jour produit (notamment l'activation/désactivation). À retirer
    // une fois le comportement de désactivation confirmé.
    console.log('[FLX-DIAG] PUT /products', JSON.stringify({
      id,
      bodyKeys: Object.keys(body || {}),
      status: body?.status ?? '(absent)',
      bodyActiveLike: {
        active: body?.active,
        published: body?.published,
        isActive: body?.isActive,
        available: body?.available,
        visible: body?.visible,
      },
      derived_is_active: 'is_active' in updateData ? updateData.is_active : '(non modifié)',
    }));

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: product, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !product) {
      return NextResponse.json(
        { error: 'Not found', details: `No product with ID ${id} exists` },
        { status: 404 }
      );
    }

    // Recalcule le prix de vente si le coût a changé.
    {
      const { recomputeAndWritePrices } = await import('@/lib/margins-db');
      await recomputeAndWritePrices({ productIds: [id] });
    }

    const res = NextResponse.json(toFluxitronProduct(product));
    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error updating product:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/v1/products/:id — Delete product and all its variants
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    // [FLX-DIAG] Diagnostic temporaire — capture les désactivations via DELETE.
    console.log('[FLX-DIAG] DELETE /products', JSON.stringify({ id }));
    const supabase = createAdminClient();

    // Soft delete: set is_active = false
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: 'Not found', details: `No product with ID ${id} exists` },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('Error deleting product:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
