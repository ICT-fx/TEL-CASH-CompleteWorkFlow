import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// POST /api/admin/products/bulk-activate
// Body: { ids: string[], active: boolean }
//
// Flips is_active for every id in `ids`. Used by the admin catalog for batch
// publishing of Fluxitron drafts (and bulk hide).
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

    const { error, count } = await supabase
      .from('products')
      .update({ is_active: active }, { count: 'exact' })
      .in('id', cleanIds);

    if (error) {
      return NextResponse.json({ error: error.message || 'Erreur de mise à jour' }, { status: 400 });
    }

    return NextResponse.json({
      updatedCount: count || cleanIds.length,
      active,
      message: active
        ? `${count || cleanIds.length} produit(s) activé(s)`
        : `${count || cleanIds.length} produit(s) désactivé(s)`,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
