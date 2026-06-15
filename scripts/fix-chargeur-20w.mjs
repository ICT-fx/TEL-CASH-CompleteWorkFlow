// One-off : rectifie le "Chargeur secteur 25W USB-C (+ câble Type-C)" en 20W
// et lui associe la photo déposée (public/accessoires/chargeurusbc.jpg).
//
//   node scripts/fix-chargeur-20w.mjs
//
// a) Normalise l'image (trim transparent + 88 % + canvas carré 1000×1000)
//    pour matcher le rendu des autres packshots, écrite sous le nouveau handle.
// b) Met à jour le produit en base : model 25W → 20W + images.

import sharp from 'sharp';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const PRODUCT_ID = '0f6b6f20-623d-4e56-92fb-39dc0a57ec7e';
const SRC = 'public/accessoires/chargeurusbc.jpg';        // PNG déposé (mal nommé)
const NEW_HANDLE = 'chargeur-secteur-20w-usb-c-cable-type-c';
const OUT = `public/accessoires/${NEW_HANDLE}.png`;
const S = 1000;
const INNER = Math.round(S * 0.88);

function loadEnv() {
  return Object.fromEntries(
    fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
}

async function normalizeImage() {
  const inner = await sharp(SRC).ensureAlpha().trim({ threshold: 10 })
    .resize(INNER, INNER, { fit: 'inside' }).png().toBuffer();
  const m = await sharp(inner).metadata();
  const left = Math.max(0, Math.round((S - m.width) / 2));
  const top = Math.max(0, Math.round((S - m.height) / 2));
  const out = await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, left, top }]).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(OUT, out);
  console.log(`✅ Image normalisée → ${OUT} (${S}×${S})`);
}

async function main() {
  await normalizeImage();

  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: before, error: e1 } = await sb.from('products')
    .select('id, brand, model, images').eq('id', PRODUCT_ID).single();
  if (e1) { console.error('❌ Lecture produit :', e1.message); process.exit(1); }
  console.log('Avant :', JSON.stringify(before));

  const newModel = (before.model || '').replace(/25\s*W/i, '20W');
  const newImages = [`/accessoires/${NEW_HANDLE}.png`];

  const { data: after, error: e2 } = await sb.from('products')
    .update({ model: newModel, images: newImages }).eq('id', PRODUCT_ID)
    .select('id, brand, model, images').single();
  if (e2) { console.error('❌ Mise à jour :', e2.message); process.exit(1); }
  console.log('Après :', JSON.stringify(after));
  console.log('✅ Produit rectifié en 20W + image associée.');
}

main();
