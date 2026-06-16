import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/margins/options — listes distinctes pour les sélecteurs de règles.
// Renvoie les marques et les modèles (groupes) disponibles dans le catalogue.
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;
  const db = createAdminClient();

  const { data } = await db.from('products').select('brand, model');

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
