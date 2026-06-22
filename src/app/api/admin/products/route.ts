import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// Catalogue magasin = sell-to-order : pas de gestion de quantité. La disponibilité
// repose sur is_active (variante active), pas sur le stock. On crée donc à stock 0
// (le panier/checkout ne bloquent plus à 0 depuis le pivot sell-to-order).
const MANUAL_DEFAULT_STOCK = 0;

// GET /api/admin/products
// Params: ?source=manual|fluxitron  ?category=telephones|accessoires
export async function GET(request: Request) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;
    const source = searchParams.get('source');       // 'manual' | 'fluxitron' | null (all)
    const category = searchParams.get('category');   // 'telephones' | 'accessoires' | null (all)

    const supabase = createAdminClient();

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (source) query = query.eq('source', source);
    if (category) query = query.eq('category', category);

    const { data: products, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      products: products || [],
      pagination: { page, limit, total: count || 0 },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/admin/products — Create a manual product
export async function POST(request: Request) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const body = await request.json();

    // ── Chemin « lot » : création de N variantes (storage × grade × couleur) ──
    if (Array.isArray(body.variants)) {
      const { brand, model, category, warranty, condition_description, images, specs, variants } = body;

      if (!brand || !model || !category) {
        return NextResponse.json(
          { error: 'brand, model et category sont requis' },
          { status: 400 }
        );
      }
      if (variants.length === 0) {
        return NextResponse.json({ error: 'Aucune variante à créer' }, { status: 400 });
      }
      for (const v of variants) {
        const price = parseFloat(v.price);
        if (!Number.isFinite(price) || price <= 0) {
          return NextResponse.json(
            { error: 'Chaque variante doit avoir un prix valide (> 0)' },
            { status: 400 }
          );
        }
      }

      const nullIfEmpty = (val: unknown) =>
        typeof val === 'string' && val.trim() === '' ? null : val;

      const supabase = createAdminClient();
      const rows = variants.map((v: any) => ({
        brand,
        model,
        category,
        storage_capacity: nullIfEmpty(v.storage_capacity),
        color: nullIfEmpty(v.color),
        grade: nullIfEmpty(v.grade),
        warranty: nullIfEmpty(warranty),
        condition_description: nullIfEmpty(condition_description),
        price: parseFloat(v.price),
        compare_at_price: v.compare_at_price ? parseFloat(v.compare_at_price) : null,
        stock: MANUAL_DEFAULT_STOCK,
        images: images || [],
        specs: specs ?? null,
        is_active: true,
        source: 'manual',
      }));

      const { data, error } = await supabase.from('products').insert(rows).select();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ products: data, count: data?.length ?? 0 }, { status: 201 });
    }
    // ── Chemin mono-produit (existant) ────────────────────────────────────────

    const {
      brand, model, storage_capacity, color, imei, warranty,
      condition_description, grade, battery_health, price,
      compare_at_price, stock, images, category, is_active,
    } = body;

    if (!brand || !model || !price || !category) {
      return NextResponse.json(
        { error: 'brand, model, price et category sont requis' },
        { status: 400 }
      );
    }

    // Chaîne vide → NULL pour les champs optionnels. Indispensable pour `imei`
    // qui porte une contrainte UNIQUE : plusieurs '' violeraient l'unicité,
    // alors que plusieurs NULL sont autorisés (un produit sans IMEI est normal).
    const nullIfEmpty = (v: unknown) =>
      typeof v === 'string' && v.trim() === '' ? null : v;

    const supabase = createAdminClient();

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        brand,
        model,
        storage_capacity: nullIfEmpty(storage_capacity),
        color: nullIfEmpty(color),
        imei: nullIfEmpty(imei),
        warranty: nullIfEmpty(warranty),
        condition_description: nullIfEmpty(condition_description),
        grade: nullIfEmpty(grade),
        battery_health,
        price: parseFloat(price),
        compare_at_price: compare_at_price ? parseFloat(compare_at_price) : null,
        stock: stock || 1,
        images: images || [],
        category,
        is_active: is_active !== false,
        source: 'manual', // Always manual when created via admin
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
