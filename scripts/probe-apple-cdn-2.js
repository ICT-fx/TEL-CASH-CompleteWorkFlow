#!/usr/bin/env node
// Passe 2 : patterns alternatifs du CDN Apple pour les couples encore manquants
// après probe-apple-cdn.js (hero, witb, slugs sans tirets, "spacegray", etc.).
// Fusionne les nouveaux hits dans scripts/apple-cdn-hits.json.

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const ROOT = path.resolve(__dirname, '..');
const MISSING = path.join(ROOT, 'public/images/_manquants.json');
const HITS = path.join(__dirname, 'apple-cdn-hits.json');

const BASE = 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/';
const QS = '?wid=1200&hei=1200&fmt=png-alpha&qlt=90';

const missing = JSON.parse(fs.readFileSync(MISSING, 'utf8'));
const hits = JSON.parse(fs.readFileSync(HITS, 'utf8'));

function variants(model, color) {
  const m = model.trim().replace(/^iPhone\s+/i, '').toLowerCase().replace(/\s+/g, '-');
  const mTight = m.replace(/-/g, '');
  const c = color.trim().toLowerCase().replace(/\s+/g, '-');
  const cTight = c.replace(/-/g, '');
  const names = [];
  const stems = [`iphone-${m}`, `iphone${mTight}`, `iphone-${mTight}`];
  const colors = [c, cTight];
  if (c === 'product-red') colors.push('red', '(product)red', 'productred');
  if (c === 'space-gray') colors.push('spacegray', 'space-grey', 'spacegrey');
  const suffixes = [
    'select', 'select-2017', 'select-201709', 'select-2018', 'select-201809',
    'select-2019', 'select-201909', 'select-2020', 'select-202009',
    'select-2021', 'hero', 'witb', 'finish-select', 'storage-select',
  ];
  for (const stem of stems) {
    for (const col of colors) {
      for (const suf of suffixes) {
        names.push(`${stem}-${col}-${suf}`);
      }
    }
  }
  return names.map((n) => BASE + encodeURIComponent(n) + QS);
}

function head(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD', timeout: 12000 }, (res) => {
      const ok =
        res.statusCode === 200 &&
        /image\/png/i.test(res.headers['content-type'] || '') &&
        parseInt(res.headers['content-length'] || '0', 10) > 30_000;
      res.resume();
      resolve(ok);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let found = 0;
  const todo = missing.filter((it) => !hits[it.key]);
  console.log(`${todo.length} couples encore sans source`);
  for (const item of todo) {
    const [model, color] = item.key.split('|');
    let hit = null;
    for (const url of variants(model, color)) {
      // eslint-disable-next-line no-await-in-loop
      if (await head(url)) { hit = url; break; }
      // eslint-disable-next-line no-await-in-loop
      await sleep(90);
    }
    if (hit) { hits[item.key] = hit; found++; console.log(`  ✓ ${item.key}`); }
    else console.log(`  ✗ ${item.key}`);
  }
  fs.writeFileSync(HITS, JSON.stringify(hits, null, 2) + '\n');
  console.log(`\n+${found} nouveaux hits (total ${Object.keys(hits).length})`);
})();
