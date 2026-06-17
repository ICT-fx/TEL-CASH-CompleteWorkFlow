import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { recomputeAndWritePrices } from '@/lib/margins-db';

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;
  const db = createAdminClient();
  const { data } = await db.from('margin_settings').select('*').eq('id', 1).single();
  return NextResponse.json({
    settings: data ?? { coherence_enabled: false, coherence_min_gap_percent: 5 },
  });
}

export async function PUT(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;
  const body = await request.json();
  const db = createAdminClient();
  const { data, error } = await db
    .from('margin_settings')
    .update({
      coherence_enabled: !!body.coherence_enabled,
      coherence_min_gap_percent: Number(body.coherence_min_gap_percent) || 5,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  // La cohérence A>B>C change des prix → on réapplique tout de suite.
  let pricesUpdated = -1;
  try { pricesUpdated = (await recomputeAndWritePrices()).updated; } catch { /* filet : bouton Appliquer */ }
  return NextResponse.json({ settings: data, pricesUpdated });
}
