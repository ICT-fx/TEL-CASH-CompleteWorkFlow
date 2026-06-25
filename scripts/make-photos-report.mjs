// Régénère docs/RAPPORT-PHOTOS.md à partir de la SOURCE DE VÉRITÉ du front :
//   - src/lib/modelImages.ts   (mapping modèle×couleur → fichier packshot)
//   - src/lib/imageBlocklist.ts (fichiers forcés en placeholder neutre)
//   - public/images/*           (présence réelle des fichiers)
//
//   node scripts/make-photos-report.mjs
//
// Pour chaque couple modèle×couleur mappé :
//   ✅ vraie photo  = fichier présent ET non blocklisté
//   ⚠️ placeholder  = fichier blocklisté (mauvais modèle/couleur ou photo « pas pro »)
//   ❌ fichier manquant = clé mappée mais fichier absent de public/images
// Re-exécutable : reflète toujours l'état courant du mapping + blocklist.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ROOT = process.cwd();

// ── 1. Mapping modèle×couleur → fichier ─────────────────────────────────────
const mapSrc = readFileSync(`${ROOT}/src/lib/modelImages.ts`, 'utf8');
const entries = [];
for (const m of mapSrc.matchAll(/"([^"]+)\|([^"]+)\|([^"]+)":\s*"(\/images\/[^"]+)"/g)) {
  entries.push({ brand: m[1], model: m[2], color: m[3], file: m[4] });
}

// ── 2. Fichiers blocklistés (→ placeholder) ─────────────────────────────────
const blkSrc = readFileSync(`${ROOT}/src/lib/imageBlocklist.ts`, 'utf8');
const blockStart = blkSrc.indexOf('BLOCKED_IMAGE_FILES');
const blockEnd = blkSrc.indexOf('])', blockStart);
const blockBody = blkSrc.slice(blockStart, blockEnd);
const blocked = new Set(
  [...blockBody.matchAll(/'([^']+\.png)'/g)].map((m) => m[1].toLowerCase()),
);

// ── 3. Incohérences corrigées lors de l'audit du 24/06/2026 ────────────────
// (mauvais modèle / mauvaise couleur — vérifiées visuellement image par image)
const AUDIT_2406 = {
  'google-pixel-9-pro-xl-5g-grey.png': 'montre un Pixel 9 Pro **Fold** (pliable), pas un Pro XL',
  'google-pixel-9-pro-fold-5g-black.png': 'montre un Pixel **classique** (barre photo), pas un Fold',
  'google-pixel-7a-5g-white.png': 'montre un Pixel **7 Pro** (module pleine largeur), pas un 7a',
  'samsung-galaxy-a56-5g-black.png': 'montre un Galaxy **A55** (objectifs séparés), pas l’A56',
  'samsung-galaxy-s22-5g-grey.png': 'montre un Galaxy **S21**, pas le S22',
  'samsung-galaxy-s25-edge-5g-ice-blue.png': 'S25 **classique** (triple objectif), pas l’Edge (double)',
  'samsung-galaxy-s25-ultra-5g-green.png': 'appareil **noir**, pas vert',
  'samsung-galaxy-s26-plus-5g-silver.png': 'châssis **quad-objectif type Ultra**, pas un S26+',
  'samsung-galaxy-z-flip4-5g-rose-gold.png': 'montre un **Flip6 argent**, pas un Flip4 rose gold',
  'samsung-galaxy-z-fold7-5g-green.png': 'render **Fold3** (watermark OnLeaks), pas un Fold7',
  'xiaomi-14-pro-5g-black.png': 'montre un **Redmi**, pas le Xiaomi 14 Pro Leica',
  'xiaomi-17-ultra-5g-black.png': 'Xiaomi **17 standard**, pas le 17 Ultra (module Leica)',
  'apple-iphone-8-product-red.png': 'composite incluant un iPhone **8 Plus** (double caméra)',
};

const base = (f) => f.split('/').pop().toLowerCase();
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const brandLabel = (b) => ({ apple: 'Apple', samsung: 'Samsung', xiaomi: 'Xiaomi', google: 'Google', oneplus: 'OnePlus' }[b] || titleCase(b));

// ── 4. Statut de chaque couple ──────────────────────────────────────────────
let ok = 0, ph = 0, missing = 0;
for (const e of entries) {
  const b = base(e.file);
  if (blocked.has(b)) { e.status = '⚠️'; ph++; }
  else if (!existsSync(`${ROOT}/public${e.file}`)) { e.status = '❌'; missing++; }
  else { e.status = '✅'; ok++; }
}

// ── 5. Rendu Markdown ───────────────────────────────────────────────────────
const lines = [];
lines.push('# RAPPORT PHOTOS — TEL & CASH');
lines.push('');
lines.push(`Source : mapping front (\`src/lib/modelImages.ts\`) + blocklist (\`src/lib/imageBlocklist.ts\`) + fichiers \`public/images/\`. Généré par \`scripts/make-photos-report.mjs\`.`);
lines.push('');
lines.push(`**Bilan : ${entries.length} couples modèle×couleur mappés** — ✅ ${ok} vraie photo · ⚠️ ${ph} placeholder neutre · ❌ ${missing} fichier manquant.`);
lines.push('');
lines.push('Règles appliquées (mode strict) :');
lines.push('- Photo affichée seulement si packshot officiel **transparent** de CE modèle et CETTE couleur (exact ou alias sûr). Sinon silhouette neutre.');
lines.push('- Au moindre doute sur le modèle/la couleur → **placeholder**, jamais la photo d’un autre modèle/couleur.');
lines.push('- Listing et fiche utilisent EXACTEMENT la même résolution d’image.');
lines.push('');

lines.push('## 🔴 Incohérences détectées et corrigées — audit du 2026-06-24');
lines.push('');
lines.push('Photos importées le 15/06 (commits `d9ec500` / `922ceb6` / `c0d6245`) montrant un **mauvais modèle ou une mauvaise couleur** — vérifiées visuellement une à une, désormais forcées en placeholder (aucune version correcte dans l’historique git). À remplacer par un vrai packshot.');
lines.push('');
lines.push('| Modèle × couleur | Fichier | Ce qui était affiché à tort |');
lines.push('|---|---|---|');
for (const e of entries) {
  const b = base(e.file);
  if (AUDIT_2406[b]) {
    lines.push(`| ${brandLabel(e.brand)} ${titleCase(e.model)} · ${titleCase(e.color)} | \`${b}\` | ${AUDIT_2406[b]} |`);
  }
}
lines.push('');

// Tableau complet par marque → modèle
lines.push('## Catalogue complet (couples mappés)');
lines.push('');
const byBrand = new Map();
for (const e of entries) {
  if (!byBrand.has(e.brand)) byBrand.set(e.brand, []);
  byBrand.get(e.brand).push(e);
}
for (const brand of [...byBrand.keys()].sort()) {
  lines.push(`### ${brandLabel(brand)}`);
  lines.push('');
  lines.push('| Modèle | Couleur | État |');
  lines.push('|---|---|---|');
  const rows = byBrand.get(brand).sort((a, b) => a.model.localeCompare(b.model) || a.color.localeCompare(b.color));
  for (const e of rows) {
    lines.push(`| ${titleCase(e.model)} | ${titleCase(e.color)} | ${e.status} |`);
  }
  lines.push('');
}

lines.push('---');
lines.push('');
lines.push('_Légende : ✅ vraie photo (modèle+couleur vérifiés) · ⚠️ placeholder neutre (photo absente, « pas pro », ou mauvais modèle/couleur retiré) · ❌ fichier mappé mais manquant._');
lines.push('');
lines.push('> Les couples modèle×couleur présents en base mais **absents de ce mapping** s’affichent aussi en placeholder neutre (non listés ici : ce rapport couvre le mapping front).');
lines.push('');

writeFileSync(`${ROOT}/docs/RAPPORT-PHOTOS.md`, lines.join('\n'));
console.log(`✓ RAPPORT-PHOTOS.md régénéré : ${entries.length} couples (✅ ${ok} · ⚠️ ${ph} · ❌ ${missing}).`);
