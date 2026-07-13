import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// GET /api/products/[id] — Get product detail
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();

    // source='manual' : empêche de récupérer une ligne miroir Fluxitron par id.
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .eq('source', 'manual')
      .single();

    if (error || !product) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }

    // Champs internes jamais exposés au client : coût fournisseur et marqueurs
    // d'ajustement de prix (price_base / price_adjust_pct, gérés via /admin/prix).
    const { cost_price: _cost, price_base: _base, price_adjust_pct: _pct, ...publicProduct } = product;
    return NextResponse.json(publicProduct);
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
