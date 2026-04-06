import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/products
// Params: ?source=manual|fluxitron  ?category=telephones|accessoires
export async function GET(request: Request) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;
    const source = searchParams.get('source');       // 'manual' | 'fluxitron' | null (all)
    const category = searchParams.get('category');   // 'telephones' | 'accessoires' | null (all)

    const supabase = createAdminClient();

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (source) query = query.eq('source', source);
    if (category) query = query.eq('category', category);

    const { data: products, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      products: products || [],
      pagination: { page, limit, total: count || 0 },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/admin/products — Create a manual product
export async function POST(request: Request) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const body = await request.json();
    const {
      brand, model, storage_capacity, color, imei, warranty,
      condition_description, grade, battery_health, price,
      compare_at_price, stock, images, category, is_active,
    } = body;

    if (!brand || !model || !price || !category) {
      return NextResponse.json(
        { error: 'brand, model, price et category sont requis' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        brand, model, storage_capacity, color, imei, warranty,
        condition_description, grade, battery_health,
        price: parseFloat(price),
        compare_at_price: compare_at_price ? parseFloat(compare_at_price) : null,
        stock: stock || 1,
        images: images || [],
        category,
        is_active: is_active !== false,
        source: 'manual', // Always manual when created via admin
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
