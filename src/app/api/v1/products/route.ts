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

    if (!body.title || !body.variants || body.variants.length === 0) {
      return NextResponse.json(
        { error: 'title and at least one variant are required' },
        { status: 400 }
      );
    }

    const insertData = fromFluxitronProductCreate(body);

    // Ensure required fields have defaults
    if (!insertData.category) insertData.category = 'telephones';
    if (insertData.is_active === undefined) insertData.is_active = true;
    if (!insertData.stock && insertData.stock !== 0) insertData.stock = 0;

    const supabase = createAdminClient();

    const { data: product, error } = await supabase
      .from('products')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const res = NextResponse.json(toFluxitronProduct(product), { status: 201 });
    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error creating product:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
