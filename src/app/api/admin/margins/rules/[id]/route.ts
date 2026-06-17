import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { recomputeAndWritePrices } from '@/lib/margins-db';

// Recalcule + écrit les prix après une modif de règle (sans bloquer si ça plante).
async function autoApply(): Promise<number> {
  try { return (await recomputeAndWritePrices()).updated; } catch { return -1; }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin();
  if (response) return response;
  const { id } = await params;
  const body = await request.json();
  const db = createAdminClient();
  const { data, error } = await db
    .from('margin_rules')
    .update({
      margin_type: body.margin_type,
      margin_percent: body.margin_percent ?? null,
      margin_fixed: body.margin_fixed ?? null,
      rounding: body.rounding ?? 'cent',
      grade: body.grade ?? null,
      strike_enabled: !!body.strike_enabled,
      strike_type: body.strike_type ?? null,
      strike_value: body.strike_value ?? null,
      strike_rounding: body.strike_rounding ?? 'ends_99',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const pricesUpdated = await autoApply();
  return NextResponse.json({ rule: data, pricesUpdated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin();
  if (response) return response;
  const { id } = await params;
  const db = createAdminClient();
  const { error } = await db.from('margin_rules').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const pricesUpdated = await autoApply();
  return NextResponse.json({ ok: true, pricesUpdated });
}
