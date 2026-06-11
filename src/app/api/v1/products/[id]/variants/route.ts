import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../../../_lib/fluxitron-auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { toFluxitronProduct, sanitizeGrade, pickVariantOption, foxwayGradeFromTitle } from '../../../_lib/mappers';

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

    // Update product with variant data (1 product = 1 variant).
    // We skip a separate existence check — the UPDATE ... .select().single()
    // below already returns no row (handled as 404) when the product is absent,
    // saving a DB round-trip per variant push.
    const updateData: Record<string, any> = {};
    // Prefix the SKU like POST /products does, to keep both ingestion paths
    // consistent and avoid collisions with manual products.
    if (body.sku) updateData.sku = body.sku.startsWith('FLX-') ? body.sku : `FLX-${body.sku}`;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.compareAtPrice !== undefined) updateData.compare_at_price = body.compareAtPrice;
    if (body.inventoryQuantity !== undefined) updateData.stock = body.inventoryQuantity;

    // IMPORTANT: body.title is the VARIANT title (a grade label like "Grade A"),
    // NOT the product model. It must never overwrite the product's model —
    // doing so produced garbage models ("Grade C+ / Other", "D", "E"). We only
    // use it as a fallback source for the grade.
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
    // Le grade est dans le title Foxway (dernier segment après "/") — on isole
    // ce segment pour éviter de matcher une lettre parasite ("B" de "Battery").
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
      .eq('id', productId)
      .select()
      .single();

    if (error || !product) {
      // PGRST116 = no row matched the id → treat as a missing product (404).
      if (!product || error?.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Not found', details: `No product with ID ${productId} exists` },
          { status: 404 }
        );
      }
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
