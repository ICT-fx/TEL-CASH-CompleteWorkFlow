#!/usr/bin/env node
// Generate clean, on-brand placeholder illustrations for accessory products.
// Each SVG is 1200×1200 (same square format as the normalized iPhone photos),
// flat white background, single-color line illustration of the accessory.
// Re-runnable: overwrites public/images/accessories/<slug>.svg.

const fs = require('node:fs');
const path = require('node:path');

const OUT_DIR = path.resolve(__dirname, '..', 'public/images/accessories');
fs.mkdirSync(OUT_DIR, { recursive: true });

const STROKE = '#0A0F1E';
const ACCENT = '#3b82f6';
const SOFT   = '#E2E8F0';

function frame(content, label) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#FFFFFF"/>
  <g transform="translate(600 560)" fill="none" stroke="${STROKE}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round">
${content}
  </g>
  <text x="600" y="1040" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="46" font-weight="600" fill="#64748B">${label}</text>
</svg>`;
}

// Phone outline used as base for case/screen-protector accessories.
function phoneOutline(opts = {}) {
  const fill = opts.fill || 'none';
  const accent = opts.accent || ACCENT;
  return `
    <rect x="-150" y="-260" width="300" height="520" rx="36" fill="${fill}" stroke="${STROKE}"/>
    <rect x="-130" y="-230" width="260" height="450" rx="20" fill="${SOFT}" stroke="none"/>
    <circle cx="-50" cy="-235" r="6" fill="${STROKE}" stroke="none"/>
    <rect x="-30" y="-245" width="60" height="10" rx="5" fill="${STROKE}" stroke="none"/>
    <circle cx="-90" cy="-180" r="18" fill="none" stroke="${accent}" stroke-width="6"/>
    <circle cx="-30" cy="-180" r="18" fill="none" stroke="${accent}" stroke-width="6"/>
    <circle cx="-60" cy="-130" r="6" fill="${accent}" stroke="none"/>
  `;
}

const ACCESSORIES = {
  // ── Coques ──
  'coque-transparente.svg': frame(
    `${phoneOutline()}
     <rect x="-160" y="-270" width="320" height="540" rx="42" fill="none" stroke="${ACCENT}" stroke-width="10" stroke-dasharray="14 10" opacity="0.65"/>`,
    'Coque transparente'
  ),
  'coque-silicone-noir.svg': frame(
    `${phoneOutline({ fill: '#111827' })}`,
    'Coque silicone noir'
  ),
  'coque-magsafe.svg': frame(
    `${phoneOutline()}
     <circle cx="0" cy="0" r="80" fill="none" stroke="${ACCENT}" stroke-width="10"/>
     <circle cx="0" cy="0" r="50" fill="none" stroke="${ACCENT}" stroke-width="6"/>
     <circle cx="0" cy="0" r="14" fill="${ACCENT}" stroke="none"/>`,
    'Coque MagSafe'
  ),

  // ── Verre trempé ──
  'verre-trempe.svg': frame(
    `${phoneOutline()}
     <polygon points="-100,-200 60,-200 90,-160 90,150 -110,150 -130,-170" fill="${ACCENT}" fill-opacity="0.15" stroke="${ACCENT}" stroke-width="6"/>
     <line x1="-70" y1="-160" x2="-30" y2="-130" stroke="#FFFFFF" stroke-width="10"/>`,
    'Verre trempé 9H'
  ),

  // ── Chargeurs ──
  'chargeur-usbc-20w.svg': frame(
    `<rect x="-140" y="-160" width="280" height="280" rx="40" fill="#F1F5F9" stroke="${STROKE}"/>
     <circle cx="-50" cy="-30" r="14" fill="${STROKE}" stroke="none"/>
     <circle cx="50"  cy="-30" r="14" fill="${STROKE}" stroke="none"/>
     <rect x="-30" y="-120" width="60" height="8" rx="4" fill="${STROKE}" stroke="none"/>
     <rect x="-30" y="120" width="60" height="40" rx="6" fill="${STROKE}" stroke="none"/>
     <text x="0" y="40" text-anchor="middle" font-family="system-ui,sans-serif" font-size="56" font-weight="700" fill="${STROKE}" stroke="none">20W</text>`,
    'Chargeur USB-C 20W'
  ),
  'chargeur-magsafe.svg': frame(
    `<circle cx="0" cy="-40" r="140" fill="#F8FAFC" stroke="${STROKE}"/>
     <circle cx="0" cy="-40" r="90"  fill="none" stroke="${ACCENT}" stroke-width="8"/>
     <circle cx="0" cy="-40" r="22"  fill="${ACCENT}" stroke="none"/>
     <path d="M 0 100 L 0 200" stroke="${STROKE}" stroke-width="14" stroke-linecap="round"/>
     <rect x="-22" y="200" width="44" height="40" rx="6" fill="${STROKE}" stroke="none"/>`,
    'Chargeur MagSafe'
  ),
  'adaptateur-secteur.svg': frame(
    `<rect x="-120" y="-180" width="240" height="280" rx="32" fill="#F1F5F9" stroke="${STROKE}"/>
     <rect x="-50" y="-220" width="22" height="50" rx="4" fill="${STROKE}" stroke="none"/>
     <rect x="28"  y="-220" width="22" height="50" rx="4" fill="${STROKE}" stroke="none"/>
     <rect x="-26" y="100" width="52" height="14" rx="4" fill="${STROKE}" stroke="none"/>`,
    'Adaptateur secteur'
  ),

  // ── Câbles ──
  'cable-usbc-lightning.svg': frame(
    `<rect x="-220" y="-30" width="44" height="60" rx="8" fill="${STROKE}" stroke="none"/>
     <rect x="-176" y="-8" width="22" height="16" fill="${STROKE}" stroke="none"/>
     <path d="M -150 0 C -80 -100 80 100 150 0" fill="none" stroke="${STROKE}" stroke-width="14"/>
     <rect x="176" y="-26" width="44" height="52" rx="6" fill="${STROKE}" stroke="none"/>
     <text x="0" y="190" text-anchor="middle" font-family="system-ui,sans-serif" font-size="40" font-weight="600" fill="${ACCENT}" stroke="none">USB-C ↔ Lightning</text>`,
    'Câble USB-C → Lightning'
  ),
  'cable-usbc-usbc.svg': frame(
    `<rect x="-220" y="-26" width="44" height="52" rx="6" fill="${STROKE}" stroke="none"/>
     <path d="M -176 0 C -100 -120 100 120 176 0" fill="none" stroke="${STROKE}" stroke-width="14"/>
     <rect x="176" y="-26" width="44" height="52" rx="6" fill="${STROKE}" stroke="none"/>
     <text x="0" y="190" text-anchor="middle" font-family="system-ui,sans-serif" font-size="40" font-weight="600" fill="${ACCENT}" stroke="none">USB-C ↔ USB-C</text>`,
    'Câble USB-C → USB-C'
  ),

  // ── Écouteurs ──
  'ecouteurs-filaires.svg': frame(
    `<circle cx="-130" cy="60" r="44" fill="${STROKE}"/>
     <circle cx="130"  cy="60" r="44" fill="${STROKE}"/>
     <path d="M -130 20 C -130 -120 -40 -180 0 -180 C 40 -180 130 -120 130 20" fill="none" stroke="${STROKE}" stroke-width="14"/>
     <rect x="-30" y="-200" width="60" height="22" rx="6" fill="${STROKE}" stroke="none"/>`,
    'Écouteurs filaires'
  ),
  'ecouteurs-sans-fil.svg': frame(
    `<g transform="translate(-110 -20)">
       <ellipse cx="0" cy="0" rx="44" ry="50" fill="${STROKE}"/>
       <rect x="-10" y="40" width="20" height="100" rx="8" fill="${STROKE}"/>
     </g>
     <g transform="translate(110 -20)">
       <ellipse cx="0" cy="0" rx="44" ry="50" fill="${STROKE}"/>
       <rect x="-10" y="40" width="20" height="100" rx="8" fill="${STROKE}"/>
     </g>
     <rect x="-100" y="160" width="200" height="100" rx="30" fill="${SOFT}" stroke="${STROKE}"/>
     <circle cx="0" cy="210" r="10" fill="${ACCENT}" stroke="none"/>`,
    'Écouteurs sans fil'
  ),

  // ── Batterie externe ──
  'batterie-externe.svg': frame(
    `<rect x="-160" y="-100" width="280" height="180" rx="20" fill="#F1F5F9" stroke="${STROKE}"/>
     <rect x="120" y="-50" width="20" height="80" rx="4" fill="${STROKE}" stroke="none"/>
     <rect x="-130" y="-70" width="220" height="120" rx="10" fill="#FFFFFF" stroke="${STROKE}" stroke-width="6"/>
     <rect x="-110" y="-50" width="160" height="80" rx="6" fill="${ACCENT}" stroke="none"/>
     <text x="-20" y="170" text-anchor="middle" font-family="system-ui,sans-serif" font-size="44" font-weight="700" fill="${STROKE}" stroke="none">10 000 mAh</text>`,
    'Batterie externe 10 000 mAh'
  ),
};

let written = 0;
for (const [name, svg] of Object.entries(ACCESSORIES)) {
  fs.writeFileSync(path.join(OUT_DIR, name), svg);
  written++;
}
console.log(`✓ ${written} SVG accessoires écrits dans ${path.relative(path.resolve(__dirname, '..'), OUT_DIR)}/`);
for (const f of Object.keys(ACCESSORIES)) console.log(`  - ${f}`);
