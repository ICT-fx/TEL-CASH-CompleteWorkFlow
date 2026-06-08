import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../../_lib/fluxitron-auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { toFluxitronProduct, fromFluxitronProductCreate } from '../../_lib/mappers';

// POST /api/v1/products/batch — Create many products in a single request.
//
// Same per-product payload as POST /products (CreateProductRequest), but wrapped
// in a `products` array. Inserts run in parallel inside one function invocation,
// so a group push of N products costs ~1 round-trip's worth of latency instead
// of N sequential HTTP calls. Results preserve input order so the caller can map
// each source product to its created ID.
export async function POST(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const products = body.products;

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: 'products array is required and must not be empty' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const results = await Promise.all(
      products.map(async (item, index) => {
        if (!item?.title || !item?.variants || item.variants.length === 0) {
          return {
            index,
            ok: false as const,
            error: 'title and at least one variant are required',
          };
        }

        const insertData = fromFluxitronProductCreate(item);
        // Ensure required fields have defaults (same as single create)
        if (!insertData.category) insertData.category = 'telephones';
        if (insertData.is_active === undefined) insertData.is_active = true;
        if (!insertData.stock && insertData.stock !== 0) insertData.stock = 0;

        const { data: product, error } = await supabase
          .from('products')
          .insert(insertData)
          .select()
          .single();

        if (error || !product) {
          return { index, ok: false as const, error: error?.message || 'Insert failed' };
        }
        return { index, ok: true as const, product: toFluxitronProduct(product) };
      })
    );

    let success = 0;
    let failed = 0;
    const created: ReturnType<typeof toFluxitronProduct>[] = [];
    const errors: { index: number; error: string }[] = [];

    for (const r of results) {
      if (r.ok) {
        success++;
        created.push(r.product);
      } else {
        failed++;
        errors.push({ index: r.index, error: r.error });
      }
    }

    const res = NextResponse.json({ success, failed, products: created, errors });
    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error in batch product create:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
