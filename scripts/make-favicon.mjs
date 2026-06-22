// Génère les favicons TEL & CASH à partir du logo wordmark `public/logo-telcash.png`.
//
//   node scripts/make-favicon.mjs
//
// Le logo est un wordmark large (1024×272) : le symbole « flèches circulaires »
// se trouve à gauche, puis un blanc, puis le texte « TEL and CASH ». Un favicon
// doit être CARRÉ et lisible à 16–32 px → on isole le seul symbole (illisible
// sinon). Détection par projection de colonnes : on repère le premier bloc
// d'encre depuis la gauche, on coupe au premier « blanc » (gap) qui suit.
//
// Sorties :
//   src/app/icon.png        (512) → favicon onglet (Next l'injecte tout seul)
//   src/app/apple-icon.png  (180, fond blanc) → apple-touch-icon / écran d'accueil
//   public/icon-512.png     (512, transparent) → manifest PWA (maskable + any)
//   public/icon-192.png     (192, transparent) → manifest PWA

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = 'public/logo-telcash.png';
const NAVY = '#1e3a8a';

// Un pixel est « de l'encre » s'il est opaque ET sombre (le symbole et le texte
// sont bleu marine ; le fond est blanc ou transparent).
function isInk(r, g, b, a) {
  if (a < 40) return false;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum < 200;
}

async function main() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;

  // Profil d'encre par colonne
  const col = new Array(W).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) col[x]++;
    }
  }

  // 1er bloc d'encre depuis la gauche, puis 1er gap (≥ ~3 % de la largeur) → fin du symbole
  const GAP = Math.round(W * 0.025);
  let start = 0;
  while (start < W && col[start] === 0) start++;
  let end = start;
  let run = 0;
  for (let x = start; x < W; x++) {
    if (col[x] === 0) { run++; if (run >= GAP) break; } else { run = 0; end = x; }
  }
  // BBox serrée du symbole sur [start..end] (calculée à la main → pas de
  // dépendance au .trim() de sharp, capricieux sur les bords transparents).
  let minX = end, maxX = start, minY = H, maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = start; x <= end && x < W; x++) {
      const i = (y * W + x) * 4;
      if (isInk(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  console.log(`Symbole : bbox x=[${minX}..${maxX}] y=[${minY}..${maxY}] (${bw}×${bh})`);

  const symbol = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: minX, top: minY, width: bw, height: bh })
    .png()
    .toBuffer();

  const side = Math.max(bw, bh);
  const pad = Math.round(side * 0.12); // ~10–12 % de marge interne
  const square = side + pad * 2;
  const onTransparent = await sharp({
    create: { width: square, height: square, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: symbol, gravity: 'center' }])
    .png()
    .toBuffer();

  mkdirSync('src/app', { recursive: true });

  // Favicon onglet (transparent, 512)
  await sharp(onTransparent).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile('src/app/icon.png');

  // PWA manifest icons (transparent)
  await sharp(onTransparent).resize(512, 512).png().toFile('public/icon-512.png');
  await sharp(onTransparent).resize(192, 192).png().toFile('public/icon-192.png');

  // apple-touch-icon : iOS ignore la transparence (fond noir sinon) → fond blanc,
  // symbole à ~78 % pour la marge « safe » iOS.
  const appleInner = await sharp(onTransparent).resize(140, 140, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: 180, height: 180, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([{ input: appleInner, gravity: 'center' }])
    .png().toFile('src/app/apple-icon.png');

  console.log('✓ icon.png / apple-icon.png / icon-512.png / icon-192.png générés');
}

main().catch((e) => { console.error('✗', e); process.exit(1); });
