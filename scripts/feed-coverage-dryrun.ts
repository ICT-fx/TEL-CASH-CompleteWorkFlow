/**
 * Dry-run de couverture : Catalog Feed Fluxitron ↔ catalogue magasin.
 *
 * Vérifie, AVANT de basculer sur le pull, que les modèles de ton catalogue
 * magasin (source='manual', category='telephones') matchent les modèles du feed
 * Foxway via la clé canonique (marque + modèle). LECTURE SEULE — n'écrit rien.
 *
 * Format réel du feed (constaté) : le stockage est DANS LE TITRE, pas dans
 * dimensions, et le titre finit souvent par un code modèle Foxway (S928B, P600…) :
 *   "Samsung Galaxy S24 Ultra 5G 256GB S928B"
 *   dimensions = {Boxed, Color, Appearance, Cloud Lock, Functionality}
 * On reconstruit donc le modèle = titre − marque − stockage − couleur − code final.
 *
 * Pré-requis dans .env.local :
 *   FLUXITRON_FEED_URL=https://api.fluxitron.com/api/feed/<storeId>/catalog.json
 *   FLUXITRON_FEED_TOKEN=flx_feed_...
 *
 * Lancement : npm run feed:coverage
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  normText, canonicalModel, storageFromString, feedModelCore, modelCandidates,
} from '../src/lib/supplier-feed';

// ── Charge .env.local (tsx ne le fait pas tout seul) ─────────────────────────
function loadEnv(path = '.env.local') {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  } catch {
    /* pas de .env.local : on compte sur l'env du shell */
  }
}
loadEnv();

const FEED_URL = process.env.FLUXITRON_FEED_URL;
const FEED_TOKEN = process.env.FLUXITRON_FEED_TOKEN;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function die(msg: string): never {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

if (!FEED_URL || !FEED_TOKEN) die("FLUXITRON_FEED_URL et FLUXITRON_FEED_TOKEN requis dans .env.local.");
if (!SB_URL || !SB_KEY) die('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local.');

// Normalisation & parsing : importés de src/lib/supplier-feed (source unique,
// exactement la même logique que le puller).

async function main() {
  console.log(`\n⏳ Feed : ${FEED_URL}`);
  const res = await fetch(FEED_URL!, { headers: { 'X-Feed-Token': FEED_TOKEN! } });
  if (!res.ok) die(`Feed HTTP ${res.status} ${res.statusText}.`);
  const feed: any = await res.json();
  const products: any[] = Array.isArray(feed?.products) ? feed.products : [];
  console.log(`✅ ${products.length} entrées (devise: ${feed?.displayCurrency ?? '?'})`);

  // Échantillon : entrée brute complète + parsing
  console.log(`\n── Échantillon (2 entrées brutes + parsing) ──`);
  for (const e of products.slice(1, 3)) {
    console.log('  RAW: ' + JSON.stringify(e));
    console.log(`  → marque="${e?.manufacturer}" modèle="${feedModelCore(e)}" stockage="${storageFromString(String(e?.title ?? ''))}" couleur="${e?.dimensions?.Color ?? ''}" grade="${e?.grade}"`);
  }

  // Construit l'ensemble des clés feed (marque|modèle) — seulement les Mobiles
  const feedKeys = new Set<string>();
  const storageSeen = new Map<string, number>();
  const feedByBrand = new Map<string, Map<string, string>>(); // marque -> coeur -> titre échantillon
  let mobiles = 0;
  for (const e of products) {
    if (String(e?.itemGroup ?? '').toLowerCase() !== 'mobiles') continue;
    mobiles++;
    const cb = normText(e?.manufacturer);
    if (!cb) continue;
    const core = feedModelCore(e);
    for (const cand of modelCandidates(core)) if (cand) feedKeys.add(`${cb}|${cand}`);
    if (core) {
      let mm = feedByBrand.get(cb);
      if (!mm) { mm = new Map(); feedByBrand.set(cb, mm); }
      if (!mm.has(core)) mm.set(core, String(e?.title ?? ''));
    }
    const s = storageFromString(String(e?.title ?? ''));
    if (s) storageSeen.set(s, (storageSeen.get(s) ?? 0) + 1);
  }
  console.log(`\n${mobiles} entrées « Mobiles » → ${feedKeys.size} clés (marque|modèle) candidates.`);
  console.log(`Stockages vus dans les titres Mobiles : ${[...storageSeen.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}(${n})`).join(', ')}`);

  // Catalogue magasin (téléphones)
  const sb = createClient(SB_URL!, SB_KEY!);
  const { data: manual, error } = await sb
    .from('products').select('brand, model').eq('source', 'manual').eq('category', 'telephones');
  if (error) die(`Supabase: ${error.message}`);

  const manualModels = new Map<string, { brand: string; model: string }>();
  for (const p of manual ?? []) {
    const cb = normText(p.brand), cm = canonicalModel(p.model);
    if (cb && cm) manualModels.set(`${cb}|${cm}`, { brand: p.brand!, model: p.model! });
  }

  const matched: string[] = [];
  const unmatched: { display: string; cb: string; cm: string }[] = [];
  for (const [key, v] of manualModels) {
    const [cb, cm] = key.split('|');
    if (feedKeys.has(key)) matched.push(`${v.brand} ${v.model}`);
    else unmatched.push({ display: `${v.brand} ${v.model}`, cb, cm });
  }
  matched.sort((a, b) => a.localeCompare(b, 'fr'));
  unmatched.sort((a, b) => a.display.localeCompare(b.display, 'fr'));
  const pct = manualModels.size ? Math.round((100 * matched.length) / manualModels.size) : 0;

  console.log(`\n════════ COUVERTURE marque + modèle ════════`);
  console.log(`Modèles magasin (téléphones) : ${manualModels.size}`);
  console.log(`  ✅ matchés dans le feed : ${matched.length}`);
  console.log(`  ⚠️  NON matchés          : ${unmatched.length}`);
  console.log(`  Taux de couverture      : ${pct}%`);

  if (unmatched.length) {
    console.log(`\n── NON matchés + titres feed les plus proches (même marque) ──`);
    for (const u of unmatched) {
      console.log(`\n  • ${u.display}`);
      const mm = feedByBrand.get(u.cb);
      if (!mm) { console.log(`      (aucune entrée « Mobiles » pour ${u.cb} dans le feed)`); continue; }
      const want = new Set(u.cm.split(' '));
      const near = [...mm.entries()]
        .map(([core, title]) => ({ title, score: core.split(' ').filter((t) => want.has(t)).length }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
      if (!near.length) console.log(`      (rien de proche — Foxway ne semble pas avoir ce modèle)`);
      for (const n of near) console.log(`      ~ ${n.title}`);
    }
  }
  console.log(`\n(Lecture seule — rien n'a été écrit en base.)\n`);
}

main().catch((e) => die(e?.message || String(e)));
