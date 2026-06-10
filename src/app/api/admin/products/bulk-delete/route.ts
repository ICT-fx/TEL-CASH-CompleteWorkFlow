import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// POST /api/admin/products/bulk-delete
// Body: { ids: string[] }
//
// Hard-deletes every product whose id is in `ids`. Products referenced in past
// orders can be deleted safely: order_items keeps a frozen snapshot
// (product_name / product_sku / price_at_purchase) and its product_id FK is
// ON DELETE SET NULL, so the order history is preserved.

// Supabase encodes `.in(col, ids)` into the request URL. Past a few hundred
// UUIDs the URL overflows the gateway's URI limit and the request silently
// affects 0 rows — which is why "select all" appeared to delete but didn't
// persist. Chunking keeps every request well under the limit.
const CHUNK = 100;
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(request: Request) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    const ids: unknown = body?.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Aucun produit sélectionné' }, { status: 400 });
    }

    const cleanIds = ids.filter((x): x is string => typeof x === 'string' && x.length > 0);
    if (cleanIds.length === 0) {
      return NextResponse.json({ error: 'Identifiants invalides' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Hard-delete in chunks, summing the REAL row counts so the response
    // reflects what was actually removed — never a faked total.
    let deletedCount = 0;
    for (const part of chunk(cleanIds, CHUNK)) {
      const { error: delErr, count } = await supabase
        .from('products')
        .delete({ count: 'exact' })
        .in('id', part);

      if (delErr) {
        return NextResponse.json(
          { error: delErr.message || 'Erreur de suppression', deletedCount },
          { status: 400 }
        );
      }
      deletedCount += count ?? 0;
    }

    return NextResponse.json({
      deletedCount,
      // Kept for backward-compat with the client, now always empty/zero since
      // order-referenced products are deletable.
      deactivatedCount: 0,
      blocked: [],
      message: `${deletedCount} produit(s) supprimé(s)`,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
