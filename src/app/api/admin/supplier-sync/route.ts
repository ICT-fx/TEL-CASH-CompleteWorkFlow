import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-admin';

// GET /api/admin/supplier-sync — réglages du grisage fournisseur + santé du flux.
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const db = createAdminClient();
  const [{ data: settings }, { data: health, error: healthErr }] = await Promise.all([
    db.from('supplier_sync_settings').select('greying_enabled, freshness_hours, updated_at').eq('id', 1).single(),
    db.rpc('supplier_sync_health'),
  ]);

  if (healthErr) {
    return NextResponse.json({ error: healthErr.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      settings: settings ?? { greying_enabled: false, freshness_hours: 48 },
      health: health ?? {},
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

// PUT /api/admin/supplier-sync — bascule l'interrupteur et/ou le seuil de fraîcheur.
export async function PUT(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  let body: { greying_enabled?: unknown; freshness_hours?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const patch: { greying_enabled?: boolean; freshness_hours?: number } = {};

  if (typeof body.greying_enabled === 'boolean') {
    patch.greying_enabled = body.greying_enabled;
  }
  if (body.freshness_hours !== undefined) {
    const h = Number(body.freshness_hours);
    if (!Number.isInteger(h) || h <= 0 || h > 24 * 30) {
      return NextResponse.json(
        { error: 'freshness_hours doit être un entier entre 1 et 720 (heures).' },
        { status: 400 }
      );
    }
    patch.freshness_hours = h;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Aucun champ valide à mettre à jour.' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('supplier_sync_settings')
    .update(patch)
    .eq('id', 1)
    .select('greying_enabled, freshness_hours, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
}
