import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/margins/products-search?q=term — recherche produit pour cibler
// une règle de marge sur des produits précis. Limité à 50 résultats.
export async function GET(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ products: [] });

  const db = createAdminClient();
  // Recherche sur marque / modèle (les axes les plus parlants pour cibler).
  const { data } = await db
    .from('products')
    .select('id, brand, model, storage_capacity, grade, color')
    .or(`brand.ilike.%${q}%,model.ilike.%${q}%`)
    .order('brand', { ascending: true })
    .limit(50);

  const products = (data ?? []).map((p) => ({
    id: p.id,
    label: [p.brand, p.model, p.storage_capacity, p.grade ? `Grade ${p.grade}` : null, p.color]
      .filter(Boolean)
      .join(' · '),
  }));

  return NextResponse.json({ products });
}
