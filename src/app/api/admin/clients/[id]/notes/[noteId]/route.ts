import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// DELETE /api/admin/clients/[id]/notes/[noteId] — Supprime une note (erreur de saisie, etc.).
// N'importe quel admin peut supprimer n'importe quelle note du fil partagé —
// même logique que pour l'écriture, pas de notion de propriétaire exclusif.
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id, noteId } = await context.params;
    const { response } = await requireAdmin();
    if (response) return response;

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('client_notes')
      .delete()
      .eq('id', noteId)
      .eq('client_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
