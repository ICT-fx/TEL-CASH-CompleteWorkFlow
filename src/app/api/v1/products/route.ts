import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../_lib/fluxitron-auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { toFluxitronProduct, fromFluxitronProductCreate } from '../_lib/mappers';

// GET /api/v1/products — Paginated list of all products with variants
export async function GET(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 250);
    const cursor = searchParams.get('cursor');

    const supabase = createAdminClient();

    // On pagine sur les seuls PARENTS de groupe (1 produit logique = 1 entrée).
    // Les variantes sœurs (produits Fluxitron multi-variantes éclatés en N lignes)
    // sont ensuite imbriquées dans variants[] — cohérent avec GET /products/:id.
    let query = supabase
      .from('products')
      .select('*')
      .eq('is_fluxitron_group_parent', true)
      .order('created_at', { ascending: true })
      .limit(limit + 1); // Fetch one extra to determine hasMore

    // Cursor-based pagination: cursor is the created_at of last item
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const cursorData = JSON.parse(decoded);
        if (cursorData.created_at) {
          query = query.gt('created_at', cursorData.created_at);
        }
      } catch {
        return NextResponse.json(
          { error: 'Invalid cursor' },
          { status: 400 }
        );
      }
    }

    const { data: parents, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const hasMore = (parents?.length || 0) > limit;
    const pageParents = (parents || []).slice(0, limit);

    // Récupère en un seul appel toutes les variantes des parents de la page, puis
    // regroupe par fluxitron_group_id pour assembler chaque produit.
    const parentIds = pageParents.map((p) => p.id);
    const variantsByGroup = new Map<string, any[]>();
    if (parentIds.length > 0) {
      const { data: allMembers } = await supabase
        .from('products')
        .select('*')
        .in('fluxitron_group_id', parentIds)
        .order('created_at', { ascending: true });
      for (const m of allMembers || []) {
        const gid = m.fluxitron_group_id || m.id;
        const arr = variantsByGroup.get(gid);
        if (arr) arr.push(m);
        else variantsByGroup.set(gid, [m]);
      }
    }

    const products = pageParents.map((parent) => {
      const members = variantsByGroup.get(parent.id) || [parent];
      const base = toFluxitronProduct(parent);
      return {
        ...base,
        variants: members.map((m) => toFluxitronProduct(m).variants[0]),
      };
    });

    // Build next cursor
    let nextCursor: string | undefined;
    if (hasMore && pageParents.length > 0) {
      const lastParent = pageParents[pageParents.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({ created_at: lastParent.created_at })
      ).toString('base64');
    }

    const res = NextResponse.json({
      products,
      cursor: nextCursor,
      hasMore,
    });

    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error listing products:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/v1/products — Create a new product
export async function POST(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    if (!body.title || !Array.isArray(body.variants) || body.variants.length === 0) {
      return NextResponse.json(
        { error: 'title and at least one variant are required' },
        { status: 400 }
      );
    }

    const variants = body.variants as any[];

    // Our store is single-variant (1 product = 1 variant). A pushed product with
    // N variants becomes N products that share the parent identity (title →
    // brand/model/storage, images, description, tags) and differ by their own
    // sku / price / stock / grade / colour. We rebuild one insert row per variant
    // by reusing the same mapper on a single-variant body.
    // En multi-variante, le grade doit venir de CHAQUE variante (title/options) :
    // on coupe les replis niveau parent (appearance/tags/description) qui sinon
    // collent le grade du parent (souvent « A+ ») aux variantes sans grade propre.
    const variantGradeOnly = variants.length > 1;

    // ── DIAG temporaire : où est le STOCKAGE par variante ? ───────────────────
    // Hub envoie tout le groupe d'un produit. On trace le titre produit, l'union
    // des clés d'options vues sur TOUTES les variantes, les métafields, et 2
    // variantes brutes complètes — pour voir si le stockage est porté quelque
    // part (clé d'option, champ dédié) ou seulement déductible du titre.
    {
      const allOptionKeys = new Set<string>();
      for (const v of variants) for (const k of Object.keys(v?.options ?? {})) allOptionKeys.add(k);
      console.log(`[POST /products][DIAG] title=${JSON.stringify(body.title)} variantCount=${variants.length} optionKeys=${JSON.stringify([...allOptionKeys])} metafields=${JSON.stringify(body.metafields ?? [])}`);
      console.log(`[POST /products][DIAG] rawVariantsSample=${JSON.stringify(variants.slice(0, 2))}`);
    }

    const rows = variants.map((v, i) => {
      const row = fromFluxitronProductCreate({ ...body, variants: [v] }, { variantGradeOnly });
      if (!row.category) row.category = 'telephones';
      if (row.is_active === undefined) row.is_active = true;
      if (!row.stock && row.stock !== 0) row.stock = 0;
      // `handle` carries a UNIQUE constraint — keep it distinct across the group.
      if (row.handle && variants.length > 1) row.handle = `${row.handle}-${i + 1}`;
      return row;
    });

    // ── Bug #1 : Hub répète parfois le même SKU dans la liste de variantes d'un
    // même produit. La colonne `sku` est UNIQUE → les doublons échouaient en
    // 23505 (ex. 49 variantes envoyées → 34 lignes insérées). On déduplique en
    // amont : même SKU = même unité physique (pas du stock en plus) → 1ʳᵉ gardée.
    const seenSku = new Set<string>();
    const dedupedRows = rows.filter((row) => {
      if (!row.sku) return true;
      if (seenSku.has(row.sku)) return false;
      seenSku.add(row.sku);
      return true;
    });
    const droppedDupes = rows.length - dedupedRows.length;
    if (droppedDupes > 0) {
      console.log(`[POST /products] ${droppedDupes} variante(s) à SKU dupliqué ignorée(s) sur ${rows.length}.`);
    }

    const supabase = createAdminClient();

    // Insert each row independently so one bad variant (invalid grade…) doesn't
    // abort the whole group. SKU duplicates already filtered out above.
    const results = await Promise.all(
      dedupedRows.map(async (row, idx) => {
        const { data, error } = await supabase
          .from('products')
          .insert(row)
          .select()
          .single();
        if (error) {
          console.error(`[POST /products] variant[${idx}] insert failed — storage=${row.storage_capacity} grade=${row.grade} color=${row.color} sku=${row.sku} handle=${row.handle} — ${error.code}: ${error.message}`);
        }
        return { data, error };
      })
    );

    const created = results.map(r => r.data).filter(Boolean) as any[];
    const firstError = results.find(r => r.error)?.error;

    // Coût fournisseur posé → recalcule le prix de vente (coût + marge) des produits créés.
    if (created.length > 0) {
      const { recomputeAndWritePrices } = await import('@/lib/margins-db');
      await recomputeAndWritePrices({ productIds: created.map((p) => p.id) });
    }

    if (created.length === 0) {
      return NextResponse.json(
        { error: firstError?.message || 'Insert failed' },
        { status: 400 }
      );
    }

    // Le parent du groupe = la 1ʳᵉ ligne créée (= l'id renvoyé en tête de réponse,
    // celui que Fluxitron enregistre comme platformProductId). On rattache toutes
    // les lignes sœurs à ce parent via fluxitron_group_id pour que les lectures
    // groupées (GET /products[/:id]) renvoient bien toutes les variantes ensemble.
    const parentId = created[0].id;
    if (created.length > 1) {
      const siblingIds = created.slice(1).map((p) => p.id);
      await supabase
        .from('products')
        .update({ fluxitron_group_id: parentId })
        .in('id', siblingIds);
      for (const p of created) p.fluxitron_group_id = parentId;
    }

    // Respond as one product carrying every created variant, so the caller can
    // map each pushed variant to the product id we created for it (each
    // variant.id is the id of its own product row).
    const base = toFluxitronProduct(created[0]);
    const responseProduct = {
      ...base,
      variants: created.map((p) => toFluxitronProduct(p).variants[0]),
    };

    const res = NextResponse.json(responseProduct, { status: 201 });
    return addRateLimitHeaders(res);
  } catch (err) {
    console.error('Error creating product:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
