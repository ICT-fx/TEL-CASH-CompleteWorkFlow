/**
 * Sync ponctuelle du miroir de stock fournisseur (réplique EXACTE du cron
 * src/app/api/cron/supplier-feed/route.ts, étapes 1→5).
 *
 * Pull du Catalog Feed Fluxitron → upsert products source='fluxitron' (snapshot
 * complet : purge des clés disparues). Utilisé quand on ne peut pas appeler
 * l'endpoint déployé (CRON_SECRET absent en local, session admin requise).
 *
 * LECTURE/ÉCRITURE en base. `--dry` = simulation sans écriture.
 *
 * Pré-requis dans .env.local : FLUXITRON_FEED_URL, FLUXITRON_FEED_TOKEN,
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * Lancement : npx tsx scripts/feed-sync-once.ts [--dry]
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  normText, canonicalModel, gradeTier, storageFromString,
  feedModelCore, modelCandidates, feedColor, type FeedEntry,
} from '../src/lib/supplier-feed';

function loadEnv(path = '.env.local') {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  } catch { /* compte sur l'env du shell */ }
}
loadEnv();

const FEED_URL = process.env.FLUXITRON_FEED_URL;
const FEED_TOKEN = process.env.FLUXITRON_FEED_TOKEN;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function die(msg: string): never { console.error(`\n❌ ${msg}\n`); process.exit(1); }
if (!FEED_URL || !FEED_TOKEN) die('FLUXITRON_FEED_URL et FLUXITRON_FEED_TOKEN requis dans .env.local.');
if (!SB_URL || !SB_KEY) die('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local.');

const DRY = process.argv.includes('--dry') || process.env.DRY === '1';

interface Agg {
  brand: string; model: string; storage: string; grade: 'A' | 'B' | 'C'; color: string;
  stock: number; cost: number | null; image: string | null;
}
function skuOf(a: Agg): string {
  return 'FLXFEED-' + [a.brand, a.model, a.storage, a.grade, a.color]
    .join('|').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function main() {
  console.log(`\n⏳ Feed : ${FEED_URL}`);
  const res = await fetch(FEED_URL!, { headers: { 'X-Feed-Token': FEED_TOKEN! }, cache: 'no-store' });
  if (!res.ok) die(`Feed HTTP ${res.status} ${res.statusText}`);
  const feed: any = await res.json();
  const entries: FeedEntry[] = Array.isArray(feed?.products) ? feed.products : [];
  console.log(`✅ ${entries.length} entrées`);

  const db = createClient(SB_URL!, SB_KEY!);

  // 2) Catalogue magasin → clés canoniques marque|modèle
  //    PAGINÉ : le client Supabase plafonne select() à 1000 lignes ; sans ça
  //    on ne voit qu'un tiers du catalogue (~2936 variantes téléphones).
  const manual: { brand: string; model: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('products').select('brand, model')
      .eq('source', 'manual').eq('category', 'telephones')
      .range(from, from + 999);
    if (error) die(error.message);
    manual.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  console.log(`Catalogue magasin (téléphones) : ${manual.length} variantes chargées`);
  const manualByKey = new Map<string, { brand: string; model: string }>();
  for (const p of manual ?? []) {
    const cb = normText(p.brand), cm = canonicalModel(p.model);
    if (cb && cm) manualByKey.set(`${cb}|${cm}`, { brand: p.brand as string, model: p.model as string });
  }

  // 3) Filtre lean + agrégation
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
    if (!hit) continue;
    const storage = storageFromString(String(e?.title ?? ''));
    const grade = gradeTier(e?.grade ?? e?.dimensions?.Appearance);
    const color = feedColor(e);
    if (!storage || !grade || !color) continue;
    matchedEntries++;

    const key = `${hit.brand}|${hit.model}|${storage}|${grade}|${color}`.toLowerCase();
    const stock = Math.max(0, Number(e?.stock) || 0);
    const cost = Number(e?.price?.cost);
    const image = Array.isArray(e?.images) ? (e.images.find((s: any) => typeof s === 'string') ?? null) : null;
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
    price: 0,
    cost_price: a.cost,
    images: a.image ? [a.image] : [],
    sku: skuOf(a),
    is_active: false,
  }));

  const summary = {
    feedEntries: entries.length, mobiles, manualModels: manualByKey.size,
    matchedEntries, supplierKeys: rows.length,
    inStockKeys: rows.filter((r) => r.stock > 0).length,
  };
  console.log('\n── Résumé ──');
  console.log(JSON.stringify(summary, null, 2));

  if (DRY) { console.log('\n(--dry : rien écrit en base.)\n'); return; }

  // 4) Upsert par lots (clé = sku)
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await db.from('products').upsert(batch, { onConflict: 'sku' });
    if (error) die(`Upsert: ${error.message} (upserted=${upserted})`);
    upserted += batch.length;
  }

  // 5) Purge des lignes fournisseur disparues
  const keep = new Set(rows.map((r) => r.sku));
  const { data: existing, error: exErr } = await db
    .from('products').select('id, sku').eq('source', 'fluxitron');
  if (exErr) die(`List: ${exErr.message}`);
  const toDelete = (existing ?? []).filter((r) => !r.sku || !keep.has(r.sku)).map((r) => r.id);
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += 500) {
    const batch = toDelete.slice(i, i + 500);
    const { error } = await db.from('products').delete().in('id', batch);
    if (error) die(`Delete: ${error.message} (deleted=${deleted})`);
    deleted += batch.length;
  }

  console.log(`\n✅ upserted=${upserted} deleted=${deleted}\n`);
}

main().catch((e) => die(e?.message || String(e)));
