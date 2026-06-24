import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/margins/options — listes distinctes pour les sélecteurs de règles.
// Renvoie les marques et les modèles (groupes) disponibles dans le catalogue.
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;
  const db = createAdminClient();

  // PostgREST plafonne à ~1000 lignes/requête → on pagine pour couvrir TOUT le
  // catalogue, sinon des marques/modèles manquent dans les listes déroulantes.
  const PAGE = 1000;
  const data: { brand: string | null; model: string | null }[] = [];
  let from = 0;
  while (true) {
    const { data: chunk, error } = await db
      .from('products')
      .select('brand, model')
      .eq('source', 'manual') // catalogue magasin uniquement (pas le miroir Fluxitron)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !chunk) break;
    data.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
    if (from > 100_000) break;
  }

  const brandSet = new Set<string>();
  const modelMap = new Map<string, { brand: string; model: string; label: string }>();
  for (const p of data ?? []) {
    const brand = (p.brand ?? '').trim();
    const model = (p.model ?? '').trim();
    if (brand) brandSet.add(brand);
    if (brand && model) {
      const key = `${brand}|${model}`;
      if (!modelMap.has(key)) modelMap.set(key, { brand, model, label: `${brand} ${model}` });
    }
  }

  const brands = Array.from(brandSet).sort((a, b) => a.localeCompare(b, 'fr'));
  const models = Array.from(modelMap.values()).sort((a, b) => a.label.localeCompare(b.label, 'fr'));

  return NextResponse.json({ brands, models });
}
