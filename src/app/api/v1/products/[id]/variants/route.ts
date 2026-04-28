import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../../../_lib/fluxitron-auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { toFluxitronProduct, sanitizeGrade } from '../../../_lib/mappers';

/**
 * POST /api/v1/products/:productId/variants — Create a variant.
 *
 * Since our store uses 1 product = 1 variant, creating a "variant" actually
 * updates the existing product's price/stock/options fields.
 * If you need true multi-variant support, a product_variants table would be needed.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { id: productId } = await context.params;
    const body = await request.json();

    const supabase = createAdminClient();

    // Verify product exists
    const { data: existing, error: findErr } = await supabase
      .from('products')
      .select('id')
      .eq('id', productId)
      .single();

    if (findErr || !existing) {
      return NextResponse.json(
        { error: 'Not found', details: `No product with ID ${productId} exists` },
        { status: 404 }
      );
    }

    // Update product with variant data (1 product = 1 variant)
    const updateData: Record<string, any> = {};
    if (body.sku) updateData.sku = body.sku;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.compareAtPrice !== undefined) updateData.compare_at_price = body.compareAtPrice;
    if (body.inventoryQuantity !== undefined) updateData.stock = body.inventoryQuantity;
    if (body.title) updateData.model = body.title; // Variant title → model
    if (body.options) {
      if (body.options.Grade) updateData.grade = sanitizeGrade(body.options.Grade);
      if (body.options.Couleur) updateData.color = body.options.Couleur;
    }

    const { data: product, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select()
      .single();

    if (error || !product) {
      return NextResponse.json({ error: error?.message || 'Update failed' }, { status: 400 });
    }

    // Return the variant from the updated product
    const fluxProduct = toFluxitronProduct(product);
    const res = NextResponse.json(fluxProduct.variants[0], { status: 201 });
    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error creating variant:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
