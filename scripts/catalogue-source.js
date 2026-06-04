// Source of truth for the iPhone catalogue used by make-seed-catalogue.js.
// Edit this file (not catalogue.json directly), then re-run:
//   node scripts/make-seed-catalogue.js
//
// Storage values are STRINGS that the /products filter checks with .includes().
// The filter expects "64", "128", "256", "512" — the script formats them as
// "<n> Go" (or "1 To" for 1024) so the front filter keeps working.
//
// Colors are stored in ENGLISH in the DB (resolveProductImage/colorLabelFr
// translate at display time). The optional `hex` is for the swatch fallback.
//
// `basePrice` = Grade A price (numeric, EUR) for the smallest storage.
// Storage uplift and grade discount are applied by the generator.

/** @type {{ name: string, hex: string }[]} */
function colors(...list) { return list; }
function model(brand, name, basePrice, storages, palette) {
  return { brand, model: name, basePrice, storages, colors: palette };
}

// Palette helpers — English keys matching colors.ts dictionary.
const C = {
  black:        { name: 'Black',          hex: '#0a0a0a' },
  jetBlack:     { name: 'Jet Black',      hex: '#0c0c0c' },
  white:        { name: 'White',          hex: '#f8fafc' },
  silver:       { name: 'Silver',         hex: '#cbd5e1' },
  gold:         { name: 'Gold',           hex: '#d4af37' },
  roseGold:     { name: 'Rose Gold',      hex: '#e8b4b8' },
  spaceGray:    { name: 'Space Gray',     hex: '#4b5563' },
  productRed:   { name: 'Product Red',    hex: '#dc2626' },
  coral:        { name: 'Coral',          hex: '#fb7185' },
  yellow:       { name: 'Yellow',         hex: '#eab308' },
  blue:         { name: 'Blue',           hex: '#3b82f6' },
  midnight:     { name: 'Midnight',       hex: '#1e293b' },
  starlight:    { name: 'Starlight',      hex: '#f5f0e6' },
  midnightGreen:{ name: 'Midnight Green', hex: '#0c3b32' },
  pacificBlue:  { name: 'Pacific Blue',   hex: '#0e7490' },
  graphite:     { name: 'Graphite',       hex: '#374151' },
  sierraBlue:   { name: 'Sierra Blue',    hex: '#60a5fa' },
  alpineGreen:  { name: 'Alpine Green',   hex: '#166534' },
  green:        { name: 'Green',          hex: '#22c55e' },
  pink:         { name: 'Pink',           hex: '#ec4899' },
  purple:       { name: 'Purple',         hex: '#8b5cf6' },
  deepPurple:   { name: 'Deep Purple',    hex: '#5b21b6' },
  spaceBlack:   { name: 'Space Black',    hex: '#1c1c1e' },
  natTitanium:  { name: 'Natural Titanium', hex: '#a3a3a3' },
  blueTitanium: { name: 'Blue Titanium',  hex: '#1e40af' },
  whiteTitanium:{ name: 'White Titanium', hex: '#e5e7eb' },
  blackTitanium:{ name: 'Black Titanium', hex: '#1f2937' },
  desertTitan:  { name: 'Desert Titanium',hex: '#b78b5a' },
  ultramarine:  { name: 'Ultramarine',    hex: '#5860c2' },
  teal:         { name: 'Teal',           hex: '#0ea5b7' },
};

// 33 iPhone models — chronological. basePrice is the Grade A price for the
// SMALLEST storage of the model. Prices are demo placeholders only.
const MODELS = [
  // ── 2016 ────────────────────────────────────────────────────────────────
  model('Apple', 'iPhone 7',       180, ['32','128','256'],
    colors(C.jetBlack, C.black, C.silver, C.gold, C.roseGold, C.productRed)),
  model('Apple', 'iPhone 7 Plus',  220, ['32','128','256'],
    colors(C.jetBlack, C.black, C.silver, C.gold, C.roseGold, C.productRed)),

  // ── 2017 ────────────────────────────────────────────────────────────────
  model('Apple', 'iPhone 8',       210, ['64','128','256'],
    colors(C.spaceGray, C.silver, C.gold, C.productRed)),
  model('Apple', 'iPhone 8 Plus',  260, ['64','128','256'],
    colors(C.spaceGray, C.silver, C.gold, C.productRed)),
  model('Apple', 'iPhone X',       290, ['64','256'],
    colors(C.silver, C.spaceGray)),

  // ── 2018 ────────────────────────────────────────────────────────────────
  model('Apple', 'iPhone XR',      280, ['64','128','256'],
    colors(C.white, C.black, C.blue, C.yellow, C.coral, C.productRed)),
  model('Apple', 'iPhone XS',      330, ['64','256','512'],
    colors(C.silver, C.spaceGray, C.gold)),
  model('Apple', 'iPhone XS Max',  380, ['64','256','512'],
    colors(C.silver, C.spaceGray, C.gold)),

  // ── 2019 ────────────────────────────────────────────────────────────────
  model('Apple', 'iPhone 11',      330, ['64','128','256'],
    colors(C.black, C.white, C.yellow, C.green, C.purple, C.productRed)),
  model('Apple', 'iPhone 11 Pro',  430, ['64','256','512'],
    colors(C.silver, C.spaceGray, C.gold, C.midnightGreen)),
  model('Apple', 'iPhone 11 Pro Max', 490, ['64','256','512'],
    colors(C.silver, C.spaceGray, C.gold, C.midnightGreen)),

  // ── 2020 ────────────────────────────────────────────────────────────────
  model('Apple', 'iPhone SE (2nd generation)', 220, ['64','128','256'],
    colors(C.black, C.white, C.productRed)),
  model('Apple', 'iPhone 12 mini', 360, ['64','128','256'],
    colors(C.black, C.white, C.productRed, C.green, C.blue, C.purple)),
  model('Apple', 'iPhone 12',      400, ['64','128','256'],
    colors(C.black, C.white, C.productRed, C.green, C.blue, C.purple)),
  model('Apple', 'iPhone 12 Pro',  490, ['128','256','512'],
    colors(C.silver, C.graphite, C.gold, C.pacificBlue)),
  model('Apple', 'iPhone 12 Pro Max', 550, ['128','256','512'],
    colors(C.silver, C.graphite, C.gold, C.pacificBlue)),

  // ── 2021 ────────────────────────────────────────────────────────────────
  model('Apple', 'iPhone 13 mini', 440, ['128','256','512'],
    colors(C.pink, C.blue, C.midnight, C.starlight, C.productRed, C.green)),
  model('Apple', 'iPhone 13',      490, ['128','256','512'],
    colors(C.pink, C.blue, C.midnight, C.starlight, C.productRed, C.green)),
  model('Apple', 'iPhone 13 Pro',  590, ['128','256','512','1024'],
    colors(C.silver, C.graphite, C.gold, C.sierraBlue, C.alpineGreen)),
  model('Apple', 'iPhone 13 Pro Max', 650, ['128','256','512','1024'],
    colors(C.silver, C.graphite, C.gold, C.sierraBlue, C.alpineGreen)),

  // ── 2022 ────────────────────────────────────────────────────────────────
  model('Apple', 'iPhone SE (3rd generation)', 290, ['64','128','256'],
    colors(C.midnight, C.starlight, C.productRed)),
  model('Apple', 'iPhone 14',      550, ['128','256','512'],
    colors(C.midnight, C.starlight, C.blue, C.purple, C.yellow, C.productRed)),
  model('Apple', 'iPhone 14 Plus', 620, ['128','256','512'],
    colors(C.midnight, C.starlight, C.blue, C.purple, C.yellow, C.productRed)),
  model('Apple', 'iPhone 14 Pro',  720, ['128','256','512','1024'],
    colors(C.spaceBlack, C.silver, C.gold, C.deepPurple)),
  model('Apple', 'iPhone 14 Pro Max', 790, ['128','256','512','1024'],
    colors(C.spaceBlack, C.silver, C.gold, C.deepPurple)),

  // ── 2023 ────────────────────────────────────────────────────────────────
  model('Apple', 'iPhone 15',      650, ['128','256','512'],
    colors(C.pink, C.yellow, C.green, C.blue, C.black)),
  model('Apple', 'iPhone 15 Plus', 730, ['128','256','512'],
    colors(C.pink, C.yellow, C.green, C.blue, C.black)),
  model('Apple', 'iPhone 15 Pro',  890, ['128','256','512','1024'],
    colors(C.natTitanium, C.blueTitanium, C.whiteTitanium, C.blackTitanium)),
  model('Apple', 'iPhone 15 Pro Max', 990, ['256','512','1024'],
    colors(C.natTitanium, C.blueTitanium, C.whiteTitanium, C.blackTitanium)),

  // ── 2024 ────────────────────────────────────────────────────────────────
  model('Apple', 'iPhone 16',      790, ['128','256','512'],
    colors(C.ultramarine, C.teal, C.pink, C.white, C.black)),
  model('Apple', 'iPhone 16 Plus', 890, ['128','256','512'],
    colors(C.ultramarine, C.teal, C.pink, C.white, C.black)),
  model('Apple', 'iPhone 16 Pro',  990, ['128','256','512','1024'],
    colors(C.desertTitan, C.natTitanium, C.whiteTitanium, C.blackTitanium)),
  model('Apple', 'iPhone 16 Pro Max', 1099, ['256','512','1024'],
    colors(C.desertTitan, C.natTitanium, C.whiteTitanium, C.blackTitanium)),
];

module.exports = { MODELS };
