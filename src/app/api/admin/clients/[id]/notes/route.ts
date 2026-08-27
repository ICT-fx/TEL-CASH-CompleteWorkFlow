import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/clients/[id]/notes — Liste des notes internes (fil partagé
// entre admins), les plus récentes en premier.
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { response } = await requireAdmin();
    if (response) return response;

    const supabase = createAdminClient();
    const { data: notes, error } = await supabase
      .from('client_notes')
      .select('id, content, created_at, author:profiles(full_name, email)')
      .eq('client_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ notes: notes || [] });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/admin/clients/[id]/notes — Ajoute une note, attribuée à l'admin connecté.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const body = await request.json();
    const content = (body.content || '').trim();
    if (!content) {
      return NextResponse.json({ error: 'Note vide' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: note, error } = await supabase
      .from('client_notes')
      .insert({ client_id: id, author_id: profile!.id, content })
      .select('id, content, created_at, author:profiles(full_name, email)')
      .single();

    if (error || !note) {
      return NextResponse.json({ error: error?.message || 'Erreur' }, { status: 400 });
    }

    return NextResponse.json({ note });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
