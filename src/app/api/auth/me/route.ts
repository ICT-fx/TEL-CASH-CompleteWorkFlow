import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requireAuth } from '@/lib/auth';

// GET /api/auth/me — Get current user profile
export async function GET() {
  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    const supabase = await createServerSupabaseClient();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user!.id)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PUT /api/auth/me — Update current user profile
export async function PUT(request: Request) {
  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    const body = await request.json();
    const { full_name, phone } = body;

    const supabase = await createServerSupabaseClient();
    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ full_name, phone })
      .eq('id', user!.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ profile });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
