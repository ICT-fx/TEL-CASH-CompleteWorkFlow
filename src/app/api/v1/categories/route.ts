import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../_lib/fluxitron-auth';
import { createAdminClient } from '@/lib/supabase-admin';

// GET /api/v1/categories — List all categories
export async function GET(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const supabase = createAdminClient();

    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Map to Fluxitron format
    const result = (categories || []).map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      parentId: cat.parent_id || null,
    }));

    const res = NextResponse.json(result);
    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error listing categories:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/v1/categories — Create a category
export async function POST(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name, parentId } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const insertData: Record<string, any> = { name };
    if (parentId) insertData.parent_id = parentId;

    const { data: category, error } = await supabase
      .from('categories')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const res = NextResponse.json(
      {
        id: category.id,
        name: category.name,
        parentId: category.parent_id || null,
      },
      { status: 201 }
    );
    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error creating category:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
