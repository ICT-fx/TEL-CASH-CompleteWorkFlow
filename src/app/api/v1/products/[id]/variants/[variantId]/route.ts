import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../../../../_lib/fluxitron-auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { toFluxitronProduct, sanitizeGrade, pickVariantOption, foxwayGradeFromTitle } from '../../../../_lib/mappers';

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
    if (body.sku) updateData.sku = body.sku.startsWith('FLX-') ? body.sku : `FLX-${body.sku}`;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.compareAtPrice !== undefined) updateData.compare_at_price = body.compareAtPrice;
    if (body.inventoryQuantity !== undefined) updateData.stock = body.inventoryQuantity;

    // body.title is the VARIANT title (a grade label like "Grade A"), never the
    // product model — only use it as a grade fallback (cf. POST variants).
    let rawGrade: string | undefined;
    if (body.options) {
      const opts = body.options as Record<string, string>;
      const gradeVal = pickVariantOption(opts, 'grade');
      if (gradeVal) rawGrade = gradeVal;
      const colorVal = pickVariantOption(opts, 'color');
      if (colorVal) updateData.color = colorVal;
      const storageVal = pickVariantOption(opts, 'storage');
      if (storageVal) updateData.storage_capacity = storageVal;
    }
    if (!rawGrade) rawGrade = foxwayGradeFromTitle(body.title);
    if (rawGrade) {
      const sanitized = sanitizeGrade(rawGrade);
      if (sanitized) {
        updateData.grade = sanitized;
        if (sanitized === 'D' || sanitized === 'E') updateData.is_active = false;
      }
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
