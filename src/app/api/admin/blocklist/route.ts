import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/blocklist — list entries
export async function GET() {
  const { profile, response } = await requireAdmin();
  if (response) return response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('fraud_blocklist')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data || [] });
}

// POST /api/admin/blocklist — add entry
export async function POST(request: Request) {
  const { profile, response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();
  const { type, value, reason } = body;

  if (!['email', 'ip', 'imei', 'phone', 'user_id'].includes(type)) {
    return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
  }
  if (!value || !reason) {
    return NextResponse.json({ error: 'Valeur et motif requis' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('fraud_blocklist')
    .insert({
      type,
      value: type === 'email' ? value.toLowerCase().trim() : value.trim(),
      reason,
      created_by: profile!.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ entry: data });
}

// DELETE /api/admin/blocklist?id=... — remove entry
export async function DELETE(request: Request) {
  const { profile, response } = await requireAdmin();
  if (response) return response;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from('fraud_blocklist').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
