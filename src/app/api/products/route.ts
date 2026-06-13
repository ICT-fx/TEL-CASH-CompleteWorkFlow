import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { isAllowedPhone } from '@/lib/catalogModels';

// Toujours dynamique + non mis en cache : un produit supprimé/désactivé côté
// admin doit disparaître de la boutique au prochain chargement, sans servir
// une réponse périmée (cache navigateur / CDN).
export const dynamic = 'force-dynamic';

// Hardcoded legacy-slug ↔ category_id map (from migration 004).
// Lets us match products that use only the new category_id without breaking the
// ones still using the old `category` text column.
const CATEGORY_SLUG_TO_ID: Record<string, string> = {
  telephones: 'a0000000-0000-0000-0000-000000000001',
  accessoires: 'a0000000-0000-0000-0000-000000000002',
};

// Jeu de colonnes minimal pour les cartes catalogue (groupSkusByModel) :
// on évite de rapatrier les gros champs texte (condition_description, tags…)
// pour ~4,6k lignes à chaque chargement. `?fields=card` active ce mode léger.
const CARD_COLUMNS =
  'id,brand,model,storage_capacity,color,grade,price,compare_at_price,stock,is_active,images,category,product_type';

// GET /api/products — List products with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const brand = searchParams.get('brand');
    const model = searchParams.get('model');
    const grade = searchParams.get('grade');
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');

    // limit=all  or  limit=-1  → no pagination (full result set)
    // anything else parsed as int, default 100
    const rawLimit = searchParams.get('limit');
    const noPagination = rawLimit === 'all' || rawLimit === '-1';
    const limit = noPagination ? 0 : parseInt(rawLimit || '100');
    const offset = (page - 1) * (limit || 1);

    // `?fields=card` → colonnes minimales pour le catalogue. Sinon `*`.
    const columns = searchParams.get('fields') === 'card' ? CARD_COLUMNS : '*';

    const supabase = createAdminClient();

    // On ne demande le count exact que pour le chemin paginé : sur le chemin
    // « tout » il forçait un COUNT complet à chaque chunk de 1000 lignes.
    let query = (noPagination
      ? supabase.from('products').select(columns)
      : supabase.from('products').select(columns, { count: 'exact' })
    ).eq('is_active', true);

    // Apply filters
    if (category) {
      // Tolerant match: legacy text column OR new category_id (mapped from slug).
      const mappedId = CATEGORY_SLUG_TO_ID[category];
      if (mappedId) {
        query = query.or(`category.eq.${category},category_id.eq.${mappedId}`);
      } else {
        query = query.eq('category', category);
      }
    }
    // When ?model= is supplied, scope brand+model to EXACT match (used by the
    // product detail page to fetch siblings of a specific SKU). Otherwise keep
    // the legacy ILIKE behaviour so ?brand=apple still works partially.
    if (model) {
      if (brand) query = query.eq('brand', brand);
      query = query.eq('model', model);
    } else if (brand) {
      query = query.ilike('brand', `%${brand}%`);
    }
    if (grade) query = query.eq('grade', grade);
    if (minPrice) query = query.gte('price', parseFloat(minPrice));
    if (maxPrice) query = query.lte('price', parseFloat(maxPrice));
    if (search) {
      query = query.or(`brand.ilike.%${search}%,model.ilike.%${search}%`);
    }

    // Apply sorting
    const ascending = sortOrder === 'asc';
    query = query.order(sortBy, { ascending });

    let products: unknown[] = [];
    let count: number | null = 0;
    let error: { message: string } | null = null;

    if (!noPagination) {
      const r = await query.range(offset, offset + limit - 1);
      products = r.data ?? [];
      count    = r.count ?? 0;
      error    = r.error;
    } else {
      // Supabase Postgrest caps each request at `db.max_rows` (usually 1000),
      // so for `limit=all` we paginate server-side in 1k chunks and concatenate.
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const r = await query.range(from, from + PAGE - 1);
        if (r.error) { error = r.error; break; }
        const chunk = r.data ?? [];
        products.push(...chunk);
        if (chunk.length < PAGE) break;        // last page reached
        from += PAGE;
        if (from > 50_000) break;              // safety net — never loop forever
      }
      count = products.length;                 // pas de count exact sur ce chemin
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Storefront : on retire les iPhone antérieurs au 11 (filtre d'affichage à la
    // source, cf. catalogModels.ts). Les autres marques/modèles passent tous.
    products = products.filter((p) => {
      const row = p as { brand?: string | null; model?: string | null };
      return isAllowedPhone(row.brand, row.model);
    });
    count = products.length;

    return NextResponse.json(
      {
        products,
        pagination: {
          page,
          limit: noPagination ? (count || 0) : limit,
          total: count || 0,
          totalPages: noPagination ? 1 : Math.ceil((count || 0) / limit),
        },
      },
      {
        headers: {
          // Cache court côté CDN : le catalogue se sert quasi instantanément aux
          // visites suivantes, tout en restant frais. `stale-while-revalidate`
          // sert l'ancienne réponse pendant qu'une nouvelle se régénère en fond,
          // donc une modif admin apparaît au pire ~30 s plus tard (jamais figée).
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        },
      }
    );
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
