import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// Hardcoded legacy-slug ↔ category_id map (from migration 004).
// Lets us match products that use only the new category_id without breaking the
// ones still using the old `category` text column.
const CATEGORY_SLUG_TO_ID: Record<string, string> = {
  telephones: 'a0000000-0000-0000-0000-000000000001',
  accessoires: 'a0000000-0000-0000-0000-000000000002',
};

// GET /api/products — List products with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const brand = searchParams.get('brand');
    const model = searchParams.get('model');
    const grade = searchParams.get('grade');
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');

    // limit=all  or  limit=-1  → no pagination (full result set)
    // anything else parsed as int, default 100
    const rawLimit = searchParams.get('limit');
    const noPagination = rawLimit === 'all' || rawLimit === '-1';
    const limit = noPagination ? 0 : parseInt(rawLimit || '100');
    const offset = (page - 1) * (limit || 1);

    const supabase = createAdminClient();

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    // Apply filters
    if (category) {
      // Tolerant match: legacy text column OR new category_id (mapped from slug).
      const mappedId = CATEGORY_SLUG_TO_ID[category];
      if (mappedId) {
        query = query.or(`category.eq.${category},category_id.eq.${mappedId}`);
      } else {
        query = query.eq('category', category);
      }
    }
    // When ?model= is supplied, scope brand+model to EXACT match (used by the
    // product detail page to fetch siblings of a specific SKU). Otherwise keep
    // the legacy ILIKE behaviour so ?brand=apple still works partially.
    if (model) {
      if (brand) query = query.eq('brand', brand);
      query = query.eq('model', model);
    } else if (brand) {
      query = query.ilike('brand', `%${brand}%`);
    }
    if (grade) query = query.eq('grade', grade);
    if (minPrice) query = query.gte('price', parseFloat(minPrice));
    if (maxPrice) query = query.lte('price', parseFloat(maxPrice));
    if (search) {
      query = query.or(`brand.ilike.%${search}%,model.ilike.%${search}%`);
    }

    // Apply sorting and pagination
    const ascending = sortOrder === 'asc';
    query = query.order(sortBy, { ascending });
    if (!noPagination) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data: products, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit: noPagination ? (count || 0) : limit,
        total: count || 0,
        totalPages: noPagination ? 1 : Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
