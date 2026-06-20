import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../../../_lib/fluxitron-auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { toFluxitronProduct, sanitizeGrade, pickVariantOption, foxwayGradeFromTitle } from '../../../_lib/mappers';

/**
 * POST /api/v1/products/:productId/variants — Create (or upsert) a variant.
 *
 * Multi-variant contract: a Fluxitron product = one PARENT row + N CHILD rows
 * sharing the same `fluxitron_group_id` (= the parent id). Creating a variant
 * INSERTS a new sibling row into the parent's group (it copies the parent's
 * product-level identity — brand/model/images/description — and carries its own
 * sku/price/stock/grade/colour). The new row keeps its own primary-key `id`,
 * which is the stable variant id returned here and echoed by every later GET.
 *
 * Idempotent: if a row with the same sku already exists, we update that row
 * instead of inserting a duplicate (sku is UNIQUE), so repeated pushes/syncs are
 * safe. This replaces the former single-variant behaviour that OVERWROTE the
 * parent on every variant create (which collapsed every variant onto one id and
 * left the rest "unmapped").
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

    // Parent row carries the product-level identity + the group id every sibling
    // must share. 404 if it doesn't exist (same contract as before).
    const { data: parent, error: parentErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (parentErr || !parent) {
      return NextResponse.json(
        { error: 'Not found', details: `No product with ID ${productId} exists` },
        { status: 404 }
      );
    }

    const groupId = parent.fluxitron_group_id || parent.id;

    // ── Variant-level fields from the request ────────────────────────────────
    const sku = body.sku
      ? (String(body.sku).startsWith('FLX-') ? String(body.sku) : `FLX-${body.sku}`)
      : undefined;

    const variantFields: Record<string, any> = {};
    if (body.price !== undefined) { variantFields.cost_price = body.price; variantFields.price = body.price; }
    if (body.compareAtPrice !== undefined) variantFields.compare_at_price = body.compareAtPrice;
    if (body.inventoryQuantity !== undefined) variantFields.stock = body.inventoryQuantity;

    // body.title is the VARIANT title (a grade label like "Grade A"), NOT the
    // product model — only ever used as a grade fallback (cf. update route).
    let rawGrade: string | undefined;
    if (body.options) {
      const opts = body.options as Record<string, string>;
      const gradeVal = pickVariantOption(opts, 'grade');
      if (gradeVal) rawGrade = gradeVal;
      const colorVal = pickVariantOption(opts, 'color');
      if (colorVal) variantFields.color = colorVal;
      const storageVal = pickVariantOption(opts, 'storage');
      if (storageVal) variantFields.storage_capacity = storageVal;
    }
    if (!rawGrade) rawGrade = foxwayGradeFromTitle(body.title);
    if (rawGrade) {
      const sanitized = sanitizeGrade(rawGrade);
      if (sanitized) {
        variantFields.grade = sanitized;
        // D/E never published (DB trigger also enforces this).
        if (sanitized === 'D' || sanitized === 'E') variantFields.is_active = false;
      }
    }

    let row: any | null = null;

    // Idempotency: an existing sku → update that row in place (no duplicate).
    if (sku) {
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('sku', sku)
        .maybeSingle();
      if (existing) {
        const { data, error } = await supabase
          .from('products')
          .update(variantFields)
          .eq('id', existing.id)
          .select()
          .single();
        if (error || !data) {
          return NextResponse.json({ error: error?.message || 'Variant update failed' }, { status: 400 });
        }
        row = data;
      }
    }

    // Otherwise INSERT a new sibling: parent identity + variant fields, attached
    // to the parent's group (explicit group id → not its own parent).
    if (!row) {
      const insertRow: Record<string, any> = {
        source: 'fluxitron',
        fluxitron_group_id: groupId,
        // Product-level identity, inherited from the parent.
        brand: parent.brand,
        model: parent.model,
        category: parent.category ?? 'telephones',
        category_id: parent.category_id ?? null,
        condition_description: parent.condition_description ?? null,
        vendor: parent.vendor ?? null,
        product_type: parent.product_type ?? null,
        tags: parent.tags ?? null,
        images: parent.images ?? null,
        // Variant-level fields (fallback to the parent's storage when absent).
        sku,
        storage_capacity: variantFields.storage_capacity ?? parent.storage_capacity ?? null,
        color: variantFields.color ?? null,
        grade: variantFields.grade ?? null,
        cost_price: variantFields.cost_price ?? 0,
        price: variantFields.price ?? variantFields.cost_price ?? 0,
        compare_at_price: variantFields.compare_at_price ?? null,
        stock: variantFields.stock ?? 0,
        is_active: variantFields.is_active ?? true,
        // handle is UNIQUE — leave it null on siblings (parent keeps the handle).
      };
      // A phone with no usable grade is never published (merchant re-checks).
      if (insertRow.category !== 'accessoires' && !insertRow.grade) insertRow.is_active = false;

      const { data, error } = await supabase
        .from('products')
        .insert(insertRow)
        .select()
        .single();
      if (error || !data) {
        return NextResponse.json({ error: error?.message || 'Variant insert failed' }, { status: 400 });
      }
      row = data;
    }

    // Supplier cost set → recompute the selling price (cost + margin) for the
    // family (loads the whole group so A>B>C coherence stays correct).
    {
      const { recomputeAndWritePrices } = await import('@/lib/margins-db');
      await recomputeAndWritePrices({ productIds: [row.id] });
    }

    const fluxProduct = toFluxitronProduct(row);
    const res = NextResponse.json(fluxProduct.variants[0], { status: 201 });
    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error creating variant:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
