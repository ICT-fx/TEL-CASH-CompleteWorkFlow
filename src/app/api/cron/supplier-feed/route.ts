import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import {
  normText, canonicalModel, gradeTier, storageFromString,
  feedModelCore, modelCandidates, feedColor, type FeedEntry,
} from '@/lib/supplier-feed';

// Pull du Catalog Feed Fluxitron → miroir de stock fournisseur (products source='fluxitron').
// Snapshot complet à chaque passe : upsert des clés présentes, purge des disparues.
// Le grisage (v_catalog_products) lit ce miroir via v_supplier_variant_stock — rien
// d'autre à changer. Déclenché par Vercel Cron (vercel.json) ou manuellement (admin).

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // gros feed + upserts par lots

const FEED_URL = process.env.FLUXITRON_FEED_URL;
const FEED_TOKEN = process.env.FLUXITRON_FEED_TOKEN;

async function authorize(request: Request): Promise<NextResponse | null> {
  // Vercel Cron envoie « Authorization: Bearer <CRON_SECRET> » si CRON_SECRET est défini.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') === `Bearer ${secret}`) return null;
  // Sinon : déclenchement manuel réservé à l'admin.
  const { response } = await requireAdmin();
  return response ?? null;
}

interface Agg {
  brand: string; model: string; storage: string; grade: 'A' | 'B' | 'C'; color: string;
  stock: number; cost: number | null; image: string | null;
}

function skuOf(a: Agg): string {
  return 'FLXFEED-' + [a.brand, a.model, a.storage, a.grade, a.color]
    .join('|').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function GET(request: Request) {
  const denied = await authorize(request);
  if (denied) return denied;

  if (!FEED_URL || !FEED_TOKEN) {
    return NextResponse.json({ error: 'FLUXITRON_FEED_URL / FLUXITRON_FEED_TOKEN manquants' }, { status: 500 });
  }
  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';

  // 1) Récupère le feed (snapshot complet)
  let feed: any;
  try {
    const res = await fetch(FEED_URL, { headers: { 'X-Feed-Token': FEED_TOKEN }, cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ error: `Feed HTTP ${res.status} ${res.statusText}` }, { status: 502 });
    feed = await res.json();
  } catch (e: any) {
    return NextResponse.json({ error: `Feed fetch: ${e?.message ?? e}` }, { status: 502 });
  }
  const entries: FeedEntry[] = Array.isArray(feed?.products) ? feed.products : [];

  const db = createAdminClient();

  // 2) Catalogue magasin (téléphones) → clés canoniques marque|modèle
  //    PAGINÉ : le client Supabase plafonne select() à 1000 lignes. Le catalogue
  //    dépasse ce seuil (~2900 variantes) ; sans pagination le matcher ne voyait
  //    qu'un tiers du catalogue et ratait tout modèle au-delà de la 1000e ligne.
  const manual: { brand: string | null; model: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error: manualErr } = await db
      .from('products').select('brand, model')
      .eq('source', 'manual').eq('category', 'telephones')
      .range(from, from + 999);
    if (manualErr) return NextResponse.json({ error: manualErr.message }, { status: 500 });
    manual.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const manualByKey = new Map<string, { brand: string; model: string }>();
  for (const p of manual ?? []) {
    const cb = normText(p.brand), cm = canonicalModel(p.model);
    if (cb && cm) manualByKey.set(`${cb}|${cm}`, { brand: p.brand as string, model: p.model as string });
  }

  // 3) Filtre lean (seulement les modèles du catalogue magasin) + agrégation
  //    par (marque, modèle magasin, stockage, grade-palier, couleur), somme du stock.
  const agg = new Map<string, Agg>();
  let mobiles = 0, matchedEntries = 0;
  for (const e of entries) {
    if (String(e?.itemGroup ?? '').toLowerCase() !== 'mobiles') continue;
    mobiles++;
    const cb = normText(e?.manufacturer);
    if (!cb) continue;
    let hit: { brand: string; model: string } | undefined;
    for (const cand of modelCandidates(feedModelCore(e))) {
      hit = manualByKey.get(`${cb}|${cand}`);
      if (hit) break;
    }
    if (!hit) continue; // pas dans le catalogue magasin → ignoré
    const storage = storageFromString(String(e?.title ?? ''));
    const grade = gradeTier(e?.grade ?? e?.dimensions?.Appearance);
    const color = feedColor(e);
    if (!storage || !grade || !color) continue;
    matchedEntries++;

    const key = `${hit.brand}|${hit.model}|${storage}|${grade}|${color}`.toLowerCase();
    const stock = Math.max(0, Number(e?.stock) || 0);
    const cost = Number(e?.price?.cost);
    const image = Array.isArray(e?.images) ? (e.images.find((s) => typeof s === 'string') ?? null) : null;
    const cur = agg.get(key);
    if (cur) {
      cur.stock += stock;
      if (cur.cost == null && Number.isFinite(cost)) cur.cost = cost;
      if (!cur.image && image) cur.image = image;
    } else {
      agg.set(key, {
        brand: hit.brand, model: hit.model, storage, grade, color,
        stock, cost: Number.isFinite(cost) ? cost : null, image,
      });
    }
  }

  const rows = [...agg.values()].map((a) => ({
    source: 'fluxitron' as const,
    category: 'telephones' as const,
    brand: a.brand,
    model: a.model,
    storage_capacity: a.storage,
    grade: a.grade,
    color: a.color,
    stock: a.stock,
    price: 0,                       // jamais vendu : prix neutre
    cost_price: a.cost,
    images: a.image ? [a.image] : [],
    sku: skuOf(a),
    is_active: false,               // le trigger trg_fluxitron_inactive l'impose aussi
  }));

  const summary = {
    dryRun,
    feedEntries: entries.length,
    mobiles,
    manualModels: manualByKey.size,
    matchedEntries,
    supplierKeys: rows.length,
    inStockKeys: rows.filter((r) => r.stock > 0).length,
  };

  if (dryRun) return NextResponse.json({ ...summary, sample: rows.slice(0, 12) });

  // 4) Upsert par lots (clé = sku synthétique déterministe)
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await db.from('products').upsert(batch, { onConflict: 'sku' });
    if (error) return NextResponse.json({ error: `Upsert: ${error.message}`, ...summary, upserted }, { status: 500 });
    upserted += batch.length;
  }

  // 5) Purge : le feed est un snapshot complet → on supprime les lignes
  //    fournisseur qui ne sont plus présentes (modèle retiré du catalogue, ou
  //    anciennes lignes du push legacy à SKU FLX-…).
  const keep = new Set(rows.map((r) => r.sku));
  const { data: existing, error: exErr } = await db
    .from('products').select('id, sku').eq('source', 'fluxitron');
  if (exErr) return NextResponse.json({ error: `List: ${exErr.message}`, ...summary, upserted }, { status: 500 });
  const toDelete = (existing ?? []).filter((r) => !r.sku || !keep.has(r.sku)).map((r) => r.id);
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += 500) {
    const batch = toDelete.slice(i, i + 500);
    const { error } = await db.from('products').delete().in('id', batch);
    if (error) return NextResponse.json({ error: `Delete: ${error.message}`, ...summary, upserted, deleted }, { status: 500 });
    deleted += batch.length;
  }

  // 6) Rafraîchir l'agrégat de stock fournisseur (migration 042). Le grisage
  //    ne lit plus les lignes source='fluxitron' en direct mais la vue
  //    matérialisée mv_supplier_variant_stock : sans ce refresh, le catalogue
  //    continuerait de servir le stock de la veille. CONCURRENTLY → la lecture
  //    du catalogue n'est jamais interrompue pendant l'opération.
  const { error: refreshErr } = await db.rpc('fn_refresh_supplier_stock');
  if (refreshErr) {
    return NextResponse.json(
      { error: `Refresh: ${refreshErr.message}`, ...summary, upserted, deleted },
      { status: 500 },
    );
  }

  return NextResponse.json({ ...summary, upserted, deleted, refreshed: true });
}
