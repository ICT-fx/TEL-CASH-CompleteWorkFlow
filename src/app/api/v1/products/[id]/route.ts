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

    const res = NextResponse.json(toFluxitronProduct(product));
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
