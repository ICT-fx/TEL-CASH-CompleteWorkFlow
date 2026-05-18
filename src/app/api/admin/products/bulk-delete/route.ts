import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// POST /api/admin/products/bulk-delete
// Body: { ids: string[], fallbackToSoft?: boolean }
//
// Hard-deletes every product whose id is in `ids` AND that is NOT referenced
// in `order_items` (past orders). Products referenced in orders are returned
// in `blocked` so the client can decide what to do. If `fallbackToSoft` is
// true, those blocked products are deactivated (is_active = false) instead.
export async function POST(request: Request) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    const ids: unknown = body?.ids;
    const fallbackToSoft: boolean = Boolean(body?.fallbackToSoft);

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Aucun produit sélectionné' }, { status: 400 });
    }

    const cleanIds = ids.filter((x): x is string => typeof x === 'string' && x.length > 0);
    if (cleanIds.length === 0) {
      return NextResponse.json({ error: 'Identifiants invalides' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Find which products are referenced in past orders
    const { data: refs, error: refsErr } = await supabase
      .from('order_items')
      .select('product_id')
      .in('product_id', cleanIds);

    if (refsErr) {
      return NextResponse.json({ error: 'Erreur lors de la vérification des commandes' }, { status: 500 });
    }

    const blocked = Array.from(new Set((refs || []).map((r: any) => r.product_id as string)));
    const deletable = cleanIds.filter(id => !blocked.includes(id));

    let deletedCount = 0;
    let deactivatedCount = 0;

    if (deletable.length > 0) {
      const { error: delErr, count } = await supabase
        .from('products')
        .delete({ count: 'exact' })
        .in('id', deletable);

      if (delErr) {
        return NextResponse.json({ error: delErr.message || 'Erreur de suppression' }, { status: 400 });
      }
      deletedCount = count || deletable.length;
    }

    if (fallbackToSoft && blocked.length > 0) {
      const { error: updErr, count } = await supabase
        .from('products')
        .update({ is_active: false }, { count: 'exact' })
        .in('id', blocked);

      if (updErr) {
        return NextResponse.json(
          {
            error: updErr.message || 'Erreur lors de la désactivation',
            deletedCount,
            blocked,
          },
          { status: 400 }
        );
      }
      deactivatedCount = count || blocked.length;
    }

    return NextResponse.json({
      deletedCount,
      deactivatedCount,
      blocked,
      message:
        deactivatedCount > 0
          ? `${deletedCount} supprimé(s), ${deactivatedCount} désactivé(s) car liés à des commandes`
          : blocked.length > 0
            ? `${deletedCount} supprimé(s), ${blocked.length} bloqué(s) car liés à des commandes`
            : `${deletedCount} produit(s) supprimé(s)`,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
