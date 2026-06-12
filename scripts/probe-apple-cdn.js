#!/usr/bin/env node
// Sonde le CDN Apple Store (images officielles "is/" — PNG fond transparent)
// pour retrouver les packshots des couples model|color encore sans source.
//
//   node scripts/probe-apple-cdn.js
//
// Lit  : public/images/_manquants.json  (les couples sans image)
// Écrit: scripts/apple-cdn-hits.json    (key → URL trouvée, à merger dans
//        public/image-sources.json avant de relancer download-images.js)
//
// Les URLs testées suivent les conventions des pages d'achat apple.com :
//   iphone-{model}-{color}-select[-{year}]?fmt=png-alpha
// Un HEAD 200 image/png = packshot officiel disponible.

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const ROOT = path.resolve(__dirname, '..');
const MISSING = path.join(ROOT, 'public/images/_manquants.json');
const OUT = path.join(__dirname, 'apple-cdn-hits.json');

const BASE = 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/';
const QS = '?wid=1200&hei=1200&fmt=png-alpha&qlt=90';

const missing = JSON.parse(fs.readFileSync(MISSING, 'utf8'));

function modelSlug(model) {
  const m = model.trim();
  if (/^iPhone SE \(2nd/i.test(m)) return 'se';
  if (/^iPhone SE \(3rd/i.test(m)) return 'se';
  return m
    .replace(/^iPhone\s+/i, '')
    .toLowerCase()
    .replace(/\s+/g, '-'); // "12 mini" → "12-mini", "11 Pro Max" → "11-pro-max"
}

function colorSlugs(color) {
  const base = color.trim().toLowerCase().replace(/\s+/g, '-');
  const out = [base];
  if (base === 'product-red') out.push('red', '(product)red');
  if (base === 'space-gray') out.push('space-grey');
  return out;
}

function yearsFor(model) {
  const m = model.toLowerCase();
  if (m.includes('se (3rd')) return ['202203', ''];
  if (m.includes('se (2nd')) return ['2020', ''];
  if (m.includes('13')) return ['2021', '', '202203', '2022'];
  if (m.includes('12')) return ['2020', '2021', ''];
  if (m.includes('11')) return ['2019', '', '201909'];
  if (m.includes('xs') || m.includes('xr')) return ['201809', '', '2018'];
  if (m.includes(' x')) return ['201709', '', '2017'];
  if (m.includes('8')) return ['201709', '', '2017', '201804'];
  if (m.includes('7')) return ['201609', '', '2016'];
  return ['', '2020', '2021', '2022'];
}

function candidates(model, color) {
  const ms = modelSlug(model);
  const urls = [];
  for (const cs of colorSlugs(color)) {
    for (const y of yearsFor(model)) {
      const name = y ? `iphone-${ms}-${cs}-select-${y}` : `iphone-${ms}-${cs}-select`;
      urls.push(BASE + encodeURIComponent(name).replace(/%2F/g, '/') + QS);
    }
  }
  return urls;
}

function head(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD', timeout: 12000 }, (res) => {
      const ok =
        res.statusCode === 200 &&
        /image\/png/i.test(res.headers['content-type'] || '') &&
        parseInt(res.headers['content-length'] || '0', 10) > 30_000; // écarte les vignettes/erreurs
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
  const hits = {};
  let found = 0;
  for (const item of missing) {
    const [model, color] = item.key.split('|');
    let hit = null;
    for (const url of candidates(model, color)) {
      // eslint-disable-next-line no-await-in-loop
      if (await head(url)) { hit = url; break; }
      // eslint-disable-next-line no-await-in-loop
      await sleep(120);
    }
    if (hit) {
      hits[item.key] = hit;
      found++;
      console.log(`  ✓ ${item.key}`);
    } else {
      console.log(`  ✗ ${item.key}`);
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(hits, null, 2) + '\n');
  console.log(`\n${found}/${missing.length} packshots officiels trouvés → ${path.relative(ROOT, OUT)}`);
})();
