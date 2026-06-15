import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;
  const db = createAdminClient();
  const { data, error } = await db
    .from('margin_rules')
    .select('*')
    .order('scope_level', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;
  const body = await request.json();
  const db = createAdminClient();
  const { data, error } = await db
    .from('margin_rules')
    .insert({
      scope_level: body.scope_level,
      brand: body.brand ?? null,
      model: body.model ?? null,
      product_id: body.product_id ?? null,
      grade: body.grade ?? null,
      margin_type: body.margin_type,
      margin_percent: body.margin_percent ?? null,
      margin_fixed: body.margin_fixed ?? null,
      rounding: body.rounding ?? 'cent',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ rule: data });
}
