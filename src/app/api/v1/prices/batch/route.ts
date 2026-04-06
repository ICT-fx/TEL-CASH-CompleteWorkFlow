import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../../_lib/fluxitron-auth';
import { createAdminClient } from '@/lib/supabase-admin';

// POST /api/v1/prices/batch — Batch price update
export async function POST(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const updates = body.updates;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'updates array is required and must not be empty' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    let success = 0;
    let failed = 0;
    const errors: { id: string; error: string }[] = [];

    for (const update of updates) {
      const { productId, variantId, price, compareAtPrice } = update;
      // In our system, variantId = productId (1 product = 1 variant)
      const targetId = variantId || productId;

      if (!targetId || price === undefined) {
        failed++;
        errors.push({
          id: variantId || productId || 'unknown',
          error: 'productId and price are required',
        });
        continue;
      }

      const updateData: Record<string, any> = { price };
      if (compareAtPrice !== undefined) {
        updateData.compare_at_price = compareAtPrice;
      }

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', targetId);

      if (error) {
        failed++;
        errors.push({ id: targetId, error: error.message });
      } else {
        success++;
      }
    }

    const res = NextResponse.json({ success, failed, errors });
    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error in batch price update:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
