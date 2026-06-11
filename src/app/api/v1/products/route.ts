import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../_lib/fluxitron-auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { toFluxitronProduct, fromFluxitronProductCreate } from '../_lib/mappers';

// GET /api/v1/products — Paginated list of all products with variants
export async function GET(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 250);
    const cursor = searchParams.get('cursor');

    const supabase = createAdminClient();

    let query = supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(limit + 1); // Fetch one extra to determine hasMore

    // Cursor-based pagination: cursor is the created_at of last item
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const cursorData = JSON.parse(decoded);
        if (cursorData.created_at) {
          query = query.gt('created_at', cursorData.created_at);
        }
      } catch {
        return NextResponse.json(
          { error: 'Invalid cursor' },
          { status: 400 }
        );
      }
    }

    const { data: products, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const hasMore = (products?.length || 0) > limit;
    const pageProducts = (products || []).slice(0, limit);

    // Build next cursor
    let nextCursor: string | undefined;
    if (hasMore && pageProducts.length > 0) {
      const lastProduct = pageProducts[pageProducts.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({ created_at: lastProduct.created_at })
      ).toString('base64');
    }

    const res = NextResponse.json({
      products: pageProducts.map(toFluxitronProduct),
      cursor: nextCursor,
      hasMore,
    });

    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error listing products:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/v1/products — Create a new product
export async function POST(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    if (!body.title || !Array.isArray(body.variants) || body.variants.length === 0) {
      return NextResponse.json(
        { error: 'title and at least one variant are required' },
        { status: 400 }
      );
    }

    const variants = body.variants as any[];

    // Our store is single-variant (1 product = 1 variant). A pushed product with
    // N variants becomes N products that share the parent identity (title →
    // brand/model/storage, images, description, tags) and differ by their own
    // sku / price / stock / grade / colour. We rebuild one insert row per variant
    // by reusing the same mapper on a single-variant body.
    const rows = variants.map((v, i) => {
      const row = fromFluxitronProductCreate({ ...body, variants: [v] });
      if (!row.category) row.category = 'telephones';
      if (row.is_active === undefined) row.is_active = true;
      if (!row.stock && row.stock !== 0) row.stock = 0;
      // `handle` carries a UNIQUE constraint — keep it distinct across the group.
      if (row.handle && variants.length > 1) row.handle = `${row.handle}-${i + 1}`;
      return row;
    });

    const supabase = createAdminClient();

    // [FLX-DIAG temporaire] capture le payload brut (options/grade par variante)
    // pour diagnostiquer le mapping des grades. À retirer après diagnostic.
    try {
      await supabase.from('flx_debug').insert({
        endpoint: 'POST /products',
        note: String(body.title || '').slice(0, 80),
        payload: {
          tags: body.tags,
          metafields: body.metafields,
          variants: variants.map((v: any) => ({
            sku: v?.sku, title: v?.title, options: v?.options, price: v?.price,
          })),
        },
      });
    } catch {}

    // Insert each row independently so one bad variant (duplicate SKU, invalid
    // grade…) doesn't abort the whole group.
    const results = await Promise.all(
      rows.map(async (row) => {
        const { data, error } = await supabase
          .from('products')
          .insert(row)
          .select()
          .single();
        return { data, error };
      })
    );

    const created = results.map(r => r.data).filter(Boolean) as any[];
    const firstError = results.find(r => r.error)?.error;

    if (created.length === 0) {
      return NextResponse.json(
        { error: firstError?.message || 'Insert failed' },
        { status: 400 }
      );
    }

    // Respond as one product carrying every created variant, so the caller can
    // map each pushed variant to the product id we created for it (each
    // variant.id is the id of its own product row).
    const base = toFluxitronProduct(created[0]);
    const responseProduct = {
      ...base,
      variants: created.map((p) => toFluxitronProduct(p).variants[0]),
    };

    const res = NextResponse.json(responseProduct, { status: 201 });
    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error creating product:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
