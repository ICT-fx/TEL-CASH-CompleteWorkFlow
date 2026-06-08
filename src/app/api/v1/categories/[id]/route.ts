import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../../_lib/fluxitron-auth';
import { createAdminClient } from '@/lib/supabase-admin';

// PUT /api/v1/categories/:id — Rename a category
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: category, error } = await supabase
      .from('categories')
      .update({ name })
      .eq('id', id)
      .select()
      .single();

    if (error || !category) {
      return NextResponse.json(
        { error: 'Not found', details: `No category with ID ${id} exists` },
        { status: 404 }
      );
    }

    const res = NextResponse.json({
      id: category.id,
      name: category.name,
      parentId: category.parent_id || null,
    });
    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error updating category:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/v1/categories/:id — Delete a category
// Products in this category are uncategorized (category_id set to null), not deleted.
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const supabase = createAdminClient();

    // Uncategorize all products in this category
    await supabase
      .from('products')
      .update({ category_id: null })
      .eq('category_id', id);

    // Delete the category
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: 'Not found', details: `No category with ID ${id} exists` },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('Error deleting category:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
