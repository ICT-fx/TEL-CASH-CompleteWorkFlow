#!/usr/bin/env node
// Build public/catalogue.json + supabase/seed-catalogue.sql + image-sources.json
// from scripts/catalogue-source.js (the iPhone catalogue source of truth).
//
//   node scripts/make-seed-catalogue.js
//
// Outputs (all idempotent — re-run to regenerate after editing the source):
//   public/catalogue.json            — every variant (color × storage × grade)
//   supabase/seed-catalogue.sql      — bulk INSERT … ON CONFLICT (sku) DO UPDATE
//   public/image-sources.json        — Model|Color → image URL map (Apple CDN)
//
// The catalogue.json file is consumed by scripts/seed-catalogue.ts (preferred)
// or by anyone wanting to re-import the data via Supabase Studio.

const fs = require('node:fs');
const path = require('node:path');

const { MODELS } = require('./catalogue-source.js');

const ROOT = path.resolve(__dirname, '..');
const OUT_CATALOGUE = path.join(ROOT, 'public/catalogue.json');
const OUT_SQL       = path.join(ROOT, 'supabase/seed-catalogue.sql');
const OUT_IMG_SRC   = path.join(ROOT, 'public/image-sources.json');

// ─────────────────────────────────────────────────────────────────────────
// Mapping helpers
// ─────────────────────────────────────────────────────────────────────────

const GRADES = [
  { code: 'A', battery: 100, priceFactor: 1.00 },
  { code: 'B', battery: 92,  priceFactor: 0.90 },
  { code: 'C', battery: 85,  priceFactor: 0.82 },
];

// "Neuf" reference divisor — compare_at_price = round(Grade A / NEW_PRICE_FACTOR)
// per (model + storage). Always > the variant price, so the UI can show the
// saving ("Économisez X€") on every grade, including Grade A.
const NEW_PRICE_FACTOR = 0.72;

// DB CHECK constraint accepts only French labels (migration 007 is live).
// catalogue.json stays in A/B/C for readability and sku stability — the
// SQL/INSERT path translates at write time, same convention as seed-catalogue.ts.
const GRADE_FR = {
  A: 'Parfait État',
  B: 'Très Bon État',
  C: 'État Correct',
};

// Storage uplift is ADDITIVE and CUMULATIVE, mapped to the model's REAL tiers
// (not the absolute GB value). basePrice in catalogue-source.js is the Grade A
// price at the smallest storage (tier 0). Each step up adds the next increment:
//   tier 0 (base)  +0
//   tier 1         +70   (cumulative 70)
//   tier 2         +130  (cumulative 200)
//   tier 3 (1 To)  +220  (cumulative 420)
const STORAGE_OFFSET = [0, 70, 200, 420];

// "256 Go" or "1 To" — must keep the digit prefix so the /products filter
// (.includes("64"|"128"|"256"|"512")) keeps matching.
function formatStorage(gb) {
  if (gb === '1024') return '1 To';
  return `${gb} Go`;
}

function roundPrice(p) {
  // Round to the nearest €10, then drop to .99 — feels like a price tag.
  const rounded = Math.round(p / 10) * 10;
  return Math.max(rounded - 0.01, 9.99);
}

function slugify(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// SKU format mirrors the one used in migration 004 (uppercase, dashes).
// We include `color` to keep SKUs globally unique across the (brand, model,
// storage, grade) tuple — Apple ships several colors per spec, so a 4-tuple
// SKU would collide.
function makeSku(brand, model, storageLabel, color, grade) {
  return [brand, model, storageLabel, color, grade]
    .map((s) => String(s).trim().toUpperCase())
    .join('-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function makeHandle(brand, model, storageLabel, color, grade) {
  return slugify([brand, model, storageLabel, color, grade].join(' '));
}

// One image per (brand, model, color) — storages/grades share the same photo.
function makeImagePath(brand, model, color) {
  return `/images/${slugify(`${brand}-${model}-${color}`)}.png`;
}

function sqlEscape(s) {
  if (s == null) return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
}

function sqlArray(arr) {
  // text[] literal: ARRAY['a','b']::text[]
  if (!arr || arr.length === 0) return `ARRAY[]::text[]`;
  return `ARRAY[${arr.map(sqlEscape).join(',')}]::text[]`;
}

// ─────────────────────────────────────────────────────────────────────────
// Build the variants
// ─────────────────────────────────────────────────────────────────────────

const variants = [];
const imageEntries = new Map(); // "Model|Color" → ""

for (const m of MODELS) {
  m.storages.forEach((storage, tierIndex) => {
    const storageLabel = formatStorage(storage);
    const offset = STORAGE_OFFSET[tierIndex];
    if (offset == null) {
      throw new Error(`No storage offset for tier ${tierIndex} ("${storage}") in ${m.model}`);
    }
    // Grade A price for THIS storage = base price + cumulative tier uplift.
    const gradeAPrice = m.basePrice + offset;
    // One "neuf" reference per (model + storage), shared across grades.
    const compareAt = roundPrice(gradeAPrice / NEW_PRICE_FACTOR);

    for (const color of m.colors) {
      const imagePath = makeImagePath(m.brand, m.model, color.name);
      const imageKey = `${m.model}|${color.name}`;
      if (!imageEntries.has(imageKey)) imageEntries.set(imageKey, '');

      for (const g of GRADES) {
        const price = roundPrice(gradeAPrice * g.priceFactor);

        variants.push({
          sku:                makeSku(m.brand, m.model, storageLabel, color.name, g.code),
          handle:             makeHandle(m.brand, m.model, storageLabel, color.name, g.code),
          brand:              m.brand,
          model:              m.model,
          storage_capacity:   storageLabel,
          storage_value:      storage,           // raw "256" — handy for filters
          color:              color.name,
          color_hex:          color.hex,
          grade:              g.code,
          battery_health:     g.battery,
          price:              price,
          compare_at_price:   compareAt,
          stock:              5,
          images:             [imagePath],
          image_path:         imagePath,
          category:           'telephones',
          is_active:          true,
          source:             'manual',
          vendor:             m.brand,
          product_type:       'smartphone',
        });
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Write catalogue.json
// ─────────────────────────────────────────────────────────────────────────

const modelsSummary = MODELS.map((m) => ({
  brand: m.brand,
  model: m.model,
  storages: m.storages.map(formatStorage),
  colors: m.colors.map((c) => ({ name: c.name, hex: c.hex })),
}));

const totalColors = MODELS.reduce((sum, m) => sum + m.colors.length, 0);

const catalogue = {
  generated_at: new Date().toISOString(),
  source: 'scripts/catalogue-source.js',
  stats: {
    models:   MODELS.length,
    colors:   totalColors,
    variants: variants.length,
  },
  models: modelsSummary,
  variants,
};

fs.writeFileSync(OUT_CATALOGUE, JSON.stringify(catalogue, null, 2) + '\n');

// ─────────────────────────────────────────────────────────────────────────
// Write supabase/seed-catalogue.sql
// ─────────────────────────────────────────────────────────────────────────

const sqlLines = [];
sqlLines.push('-- =========================================================');
sqlLines.push('-- TEL & CASH — iPhone catalogue seed');
sqlLines.push(`-- Generated from public/catalogue.json (${variants.length} variants)`);
sqlLines.push('-- Idempotent: ON CONFLICT (sku) DO UPDATE.');
sqlLines.push('-- =========================================================');
sqlLines.push('');
sqlLines.push('BEGIN;');
sqlLines.push('');

const CHUNK = 100;
for (let i = 0; i < variants.length; i += CHUNK) {
  const chunk = variants.slice(i, i + CHUNK);
  sqlLines.push(
    'INSERT INTO public.products ' +
    '(sku, handle, brand, model, storage_capacity, color, grade, battery_health, ' +
    'price, compare_at_price, stock, images, category, is_active, source, vendor, product_type)'
  );
  sqlLines.push('VALUES');
  const valueLines = chunk.map((v, idx) => {
    const row =
      '(' +
      [
        sqlEscape(v.sku),
        sqlEscape(v.handle),
        sqlEscape(v.brand),
        sqlEscape(v.model),
        sqlEscape(v.storage_capacity),
        sqlEscape(v.color),
        sqlEscape(GRADE_FR[v.grade]),       // FR label to satisfy the live CHECK constraint
        v.battery_health,
        v.price,
        v.compare_at_price == null ? 'NULL' : v.compare_at_price,
        v.stock,
        sqlArray(v.images),
        sqlEscape(v.category),
        v.is_active ? 'TRUE' : 'FALSE',
        sqlEscape(v.source),
        sqlEscape(v.vendor),
        sqlEscape(v.product_type),
      ].join(', ') +
      ')';
    return '  ' + row + (idx === chunk.length - 1 ? '' : ',');
  });
  sqlLines.push(...valueLines);
  sqlLines.push('ON CONFLICT (sku) DO UPDATE SET');
  sqlLines.push('  handle           = EXCLUDED.handle,');
  sqlLines.push('  brand            = EXCLUDED.brand,');
  sqlLines.push('  model            = EXCLUDED.model,');
  sqlLines.push('  storage_capacity = EXCLUDED.storage_capacity,');
  sqlLines.push('  color            = EXCLUDED.color,');
  sqlLines.push('  grade            = EXCLUDED.grade,');
  sqlLines.push('  battery_health   = EXCLUDED.battery_health,');
  sqlLines.push('  price            = EXCLUDED.price,');
  sqlLines.push('  compare_at_price = EXCLUDED.compare_at_price,');
  sqlLines.push('  stock            = EXCLUDED.stock,');
  sqlLines.push('  images           = EXCLUDED.images,');
  sqlLines.push('  category         = EXCLUDED.category,');
  sqlLines.push('  is_active        = EXCLUDED.is_active,');
  sqlLines.push('  source           = EXCLUDED.source,');
  sqlLines.push('  vendor           = EXCLUDED.vendor,');
  sqlLines.push('  product_type     = EXCLUDED.product_type,');
  sqlLines.push('  updated_at       = now();');
  sqlLines.push('');
}

sqlLines.push('COMMIT;');
sqlLines.push('');
sqlLines.push('-- Quick verification');
sqlLines.push("SELECT brand, COUNT(*) FROM public.products WHERE brand = 'Apple' GROUP BY brand;");
sqlLines.push('');

fs.writeFileSync(OUT_SQL, sqlLines.join('\n'));

// ─────────────────────────────────────────────────────────────────────────
// Write public/image-sources.json (template — preserve existing URLs)
// ─────────────────────────────────────────────────────────────────────────

let existing = {};
if (fs.existsSync(OUT_IMG_SRC)) {
  try { existing = JSON.parse(fs.readFileSync(OUT_IMG_SRC, 'utf8')); }
  catch { existing = {}; }
}

const imgOut = {};
for (const key of imageEntries.keys()) {
  imgOut[key] = existing[key] || '';
}
// Preserve any extra keys the user may have added manually (e.g. older models).
for (const key of Object.keys(existing)) {
  if (!(key in imgOut)) imgOut[key] = existing[key];
}

fs.writeFileSync(OUT_IMG_SRC, JSON.stringify(imgOut, null, 2) + '\n');

// ─────────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────────

console.log('✓ Catalogue généré');
console.log(`  models   : ${MODELS.length}`);
console.log(`  colors   : ${totalColors}`);
console.log(`  variants : ${variants.length}`);
console.log('');
console.log('Outputs :');
console.log(`  ${path.relative(ROOT, OUT_CATALOGUE)}`);
console.log(`  ${path.relative(ROOT, OUT_SQL)}`);
console.log(`  ${path.relative(ROOT, OUT_IMG_SRC)}`);
