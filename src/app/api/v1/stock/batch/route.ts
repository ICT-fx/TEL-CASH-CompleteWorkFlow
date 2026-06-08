import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../../_lib/fluxitron-auth';
import { createAdminClient } from '@/lib/supabase-admin';

// POST /api/v1/stock/batch — Batch stock update
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

    const results = await Promise.all(
      updates.map(async (update) => {
        const { productId, variantId, quantity } = update;
        // In our system, variantId = productId (1 product = 1 variant)
        const targetId = variantId || productId;

        if (!targetId || quantity === undefined) {
          return {
            ok: false,
            id: variantId || productId || 'unknown',
            error: 'productId and quantity are required',
          };
        }

        // Quantities are absolute values, not deltas
        const { error } = await supabase
          .from('products')
          .update({ stock: Math.max(0, quantity) })
          .eq('id', targetId);

        if (error) return { ok: false, id: targetId, error: error.message };
        return { ok: true, id: targetId };
      })
    );

    for (const r of results) {
      if (r.ok) success++;
      else {
        failed++;
        errors.push({ id: r.id, error: r.error! });
      }
    }

    const res = NextResponse.json({ success, failed, errors });
    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error in batch stock update:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
