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

interface RuleTarget {
  brand?: string | null;
  model?: string | null;
  product_id?: string | null;
}

// POST /api/admin/margins/rules — crée/met à jour une ou plusieurs règles.
// Accepte un tableau `targets` (multi-sélection) : pour chaque cible on UPSERT
// (une règle existante pour la même cible + grade est MODIFIÉE, sinon créée).
// Compat : sans `targets`, on retombe sur une cible unique (brand/model/product_id).
export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;
  const body = await request.json();
  const db = createAdminClient();

  const base = {
    scope_level: body.scope_level as string,
    grade: (body.grade ?? null) as string | null,
    margin_type: body.margin_type as string,
    margin_percent: body.margin_percent ?? null,
    margin_fixed: body.margin_fixed ?? null,
    rounding: body.rounding ?? 'cent',
  };

  const targets: RuleTarget[] = Array.isArray(body.targets) && body.targets.length > 0
    ? body.targets
    : [{ brand: body.brand ?? null, model: body.model ?? null, product_id: body.product_id ?? null }];

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const t of targets) {
    const brand = t.brand ?? null;
    const model = t.model ?? null;
    const product_id = t.product_id ?? null;

    // Cherche une règle existante pour cette cible + grade (NULL-aware).
    let q = db.from('margin_rules').select('id').eq('scope_level', base.scope_level);
    q = base.grade ? q.eq('grade', base.grade) : q.is('grade', null);
    q = brand ? q.eq('brand', brand) : q.is('brand', null);
    q = model ? q.eq('model', model) : q.is('model', null);
    q = product_id ? q.eq('product_id', product_id) : q.is('product_id', null);
    const { data: existing } = await q.limit(1);

    if (existing && existing.length > 0) {
      const { error } = await db
        .from('margin_rules')
        .update({
          margin_type: base.margin_type,
          margin_percent: base.margin_percent,
          margin_fixed: base.margin_fixed,
          rounding: base.rounding,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing[0].id);
      if (error) errors.push(error.message);
      else updated++;
    } else {
      const { error } = await db.from('margin_rules').insert({
        scope_level: base.scope_level,
        brand, model, product_id,
        grade: base.grade,
        margin_type: base.margin_type,
        margin_percent: base.margin_percent,
        margin_fixed: base.margin_fixed,
        rounding: base.rounding,
      });
      if (error) errors.push(error.message);
      else created++;
    }
  }

  if (errors.length > 0 && created === 0 && updated === 0) {
    return NextResponse.json({ error: errors[0] }, { status: 400 });
  }
  return NextResponse.json({ created, updated, errors });
}
