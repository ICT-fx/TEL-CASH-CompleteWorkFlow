import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// POST /api/admin/products/bulk-activate
// Body: { ids: string[], active: boolean }
//
// Flips is_active for every id in `ids`. Used by the admin catalog for batch
// publishing of Fluxitron drafts (and bulk hide).

// Supabase encodes `.in(col, ids)` into the request URL; too many UUIDs overflow
// the gateway's URI limit and the update silently touches 0 rows. Chunk to stay
// safely under the limit and sum the real affected counts.
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
    const active = body?.active;

    if (typeof active !== 'boolean') {
      return NextResponse.json({ error: '`active` doit être un booléen' }, { status: 400 });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Aucun produit sélectionné' }, { status: 400 });
    }

    const cleanIds = ids.filter((x): x is string => typeof x === 'string' && x.length > 0);
    if (cleanIds.length === 0) {
      return NextResponse.json({ error: 'Identifiants invalides' }, { status: 400 });
    }

    const supabase = createAdminClient();

    let updatedCount = 0;
    for (const part of chunk(cleanIds, CHUNK)) {
      const { error, count } = await supabase
        .from('products')
        .update({ is_active: active }, { count: 'exact' })
        .in('id', part);

      if (error) {
        return NextResponse.json(
          { error: error.message || 'Erreur de mise à jour', updatedCount },
          { status: 400 }
        );
      }
      updatedCount += count ?? 0;
    }

    return NextResponse.json({
      updatedCount,
      active,
      message: active
        ? `${updatedCount} produit(s) activé(s)`
        : `${updatedCount} produit(s) désactivé(s)`,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
