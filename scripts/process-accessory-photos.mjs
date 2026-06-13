// Traitement des photos d'accessoires (Partie B).
//
// USAGE :
//   1. Yanis dépose les JPG fournis dans  public/accessoires-src/
//      en les nommant d'après la colonne « photo src » :
//      J8545.jpg, J8548.jpg, J8577.jpg, P8582.jpg, K62.jpg, magsafe.jpg,
//      F6005.jpg, F3005.jpg, F3002.jpg  (le 25W Lightning n'a pas de photo).
//   2. node scripts/process-accessory-photos.mjs
//
// Ce que fait le script, par image :
//   a) DÉTOURAGE par FLOOD-FILL depuis les bords : le fond blanc connecté aux
//      bords devient transparent. On NE fait PAS un simple seuil de blanc → les
//      boîtes/câbles blancs au centre restent pleins (pas de trous).
//   b) Si la photo contient 2 vues (recto/verso côte à côte → image large),
//      on garde la vue principale de GAUCHE (recto).
//   c) Détourage des bords transparents + recentrage à ~88 % sur un canvas carré
//      transparent (même rendu que les packshots iPhone).
//   d) Écrit  public/accessoires/<handle>.png  et met à jour products.images.
//
// Si une image est inutilisable (halo persistant, trous) → on laisse le produit
// sans image (placeholder neutre côté front).

import sharp from 'sharp';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SRC_DIR = 'public/accessoires-src';
const OUT_DIR = 'public/accessoires';
const S = 1000;          // canvas carré
const INNER = Math.round(S * 0.88);
const WHITE = 236;       // seuil « proche du blanc » pour le fond
const TOL = 12;          // tolérance de variation entre canaux

function loadEnv() {
  return Object.fromEntries(
    fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
}

// Flood-fill 4-connexe depuis les bords : alpha=0 pour le fond blanc connecté.
function floodFillBackground(data, w, h) {
  const isBg = (idx) => {
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    return r >= WHITE && g >= WHITE && b >= WHITE &&
      Math.abs(r - g) <= TOL && Math.abs(g - b) <= TOL && Math.abs(r - b) <= TOL;
  };
  const visited = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    if (!isBg(p * 4)) return;
    visited[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    data[p * 4 + 3] = 0;            // transparent
    const x = p % w, y = (p / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  return data;
}

async function processOne(srcPath) {
  // a) flood-fill du fond
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  floodFillBackground(data, info.width, info.height);
  let img = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });

  // b) 2 vues côte à côte → on garde la moitié gauche (recto), puis re-trim
  const trimmed = await img.png().trim({ threshold: 10 }).toBuffer({ resolveWithObject: true }).catch(() => null);
  if (trimmed && trimmed.info.width / trimmed.info.height > 1.35) {
    const halfW = Math.floor(trimmed.info.width / 2);
    img = sharp(trimmed.data, { raw: { width: trimmed.info.width, height: trimmed.info.height, channels: 4 } })
      .extract({ left: 0, top: 0, width: halfW, height: trimmed.info.height });
  } else if (trimmed) {
    img = sharp(trimmed.data, { raw: { width: trimmed.info.width, height: trimmed.info.height, channels: 4 } });
  }

  // c) trim + 88 % + recentrage carré transparent
  const inner = await img.png().trim({ threshold: 10 }).resize(INNER, INNER, { fit: 'inside' }).toBuffer();
  const m = await sharp(inner).metadata();
  const left = Math.max(0, Math.round((S - m.width) / 2));
  const top = Math.max(0, Math.round((S - m.height) / 2));
  return sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, left, top }]).png({ compressionLevel: 9 }).toBuffer();
}

async function main() {
  if (!fs.existsSync(SRC_DIR)) { console.log(`Crée d'abord ${SRC_DIR}/ et déposes-y les JPG.`); return; }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const map = JSON.parse(fs.readFileSync('scripts/accessory-photo-map.json', 'utf8'));
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  for (const item of map) {
    if (!item.photoSrc) { console.log(`— ${item.model} : pas de photo → placeholder`); continue; }
    const src = ['jpg', 'jpeg', 'png', 'webp'].map((e) => `${SRC_DIR}/${item.photoSrc}.${e}`).find((p) => fs.existsSync(p));
    if (!src) { console.log(`⚠️  ${item.model} : ${item.photoSrc}.* introuvable dans ${SRC_DIR}/`); continue; }
    try {
      const out = await processOne(src);
      const outPath = `${OUT_DIR}/${item.handle}.png`;
      fs.writeFileSync(outPath, out);
      await sb.from('products').update({ images: [`/accessoires/${item.handle}.png`] }).eq('id', item.id);
      console.log(`✅ ${item.model} → /accessoires/${item.handle}.png (DB mise à jour)`);
    } catch (e) {
      console.log(`❌ ${item.model} : traitement échoué (${e.message}) → placeholder`);
    }
  }
}

main();
