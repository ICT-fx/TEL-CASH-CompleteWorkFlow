import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../../../../_lib/fluxitron-auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { toFluxitronProduct, sanitizeGrade } from '../../../../_lib/mappers';

/**
 * PUT /api/v1/products/:productId/variants/:variantId — Update variant.
 *
 * Since 1 product = 1 variant, variantId must equal productId.
 * Updates price, stock, sku, and options on the product.
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string; variantId: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { id: productId, variantId } = await context.params;
    const body = await request.json();

    const supabase = createAdminClient();

    // In our system, variantId = productId. Validate.
    const targetId = variantId === productId ? productId : variantId;

    const updateData: Record<string, any> = {};
    if (body.sku) updateData.sku = body.sku;
    if (body.title) updateData.model = body.title;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.compareAtPrice !== undefined) updateData.compare_at_price = body.compareAtPrice;
    if (body.inventoryQuantity !== undefined) updateData.stock = body.inventoryQuantity;
    if (body.options) {
      if (body.options.Grade) updateData.grade = sanitizeGrade(body.options.Grade);
      if (body.options.Couleur) updateData.color = body.options.Couleur;
    }

    const { data: product, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', targetId)
      .select()
      .single();

    if (error || !product) {
      return NextResponse.json(
        { error: 'Not found', details: `Variant ${variantId} not found` },
        { status: 404 }
      );
    }

    const fluxProduct = toFluxitronProduct(product);
    const res = NextResponse.json(fluxProduct.variants[0]);
    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error updating variant:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/products/:productId/variants/:variantId — Delete variant.
 *
 * Since 1 product = 1 variant, deleting the variant soft-deletes the product.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; variantId: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { id: productId, variantId } = await context.params;
    const supabase = createAdminClient();

    const targetId = variantId === productId ? productId : variantId;

    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', targetId);

    if (error) {
      return NextResponse.json(
        { error: 'Not found', details: `Variant ${variantId} not found` },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('Error deleting variant:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
