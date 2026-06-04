#!/usr/bin/env node
// Download product photos into public/images/ for the iPhone catalogue.
//
//   node scripts/download-images.js
//
// Reads:
//   public/catalogue.json     — for the list of model|color tuples and target paths
//   public/image-sources.json — for the model|color → source URL map
//
// Writes:
//   public/images/<slug>.png  — one file per (model, color), reused across
//                               every storage/grade variant.
//   public/images/_manquants.json — every model|color we could not download,
//                                   so you can add the missing URL by hand.
//
// Idempotent: an existing non-empty file is left alone (delete it to refresh).
// Only Apple CDN / apple.com hosts are followed — reseller scraping is blocked.

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');
const { URL } = require('node:url');

const ROOT       = path.resolve(__dirname, '..');
const CATALOGUE  = path.join(ROOT, 'public/catalogue.json');
const SOURCES    = path.join(ROOT, 'public/image-sources.json');
const IMG_DIR    = path.join(ROOT, 'public/images');
const MISSING    = path.join(IMG_DIR, '_manquants.json');

const ALLOWED_HOSTS = new Set([
  'store.storeimages.cdn-apple.com',
  'www.apple.com',
  'images.apple.com',
  // Wikimedia : licences libres (CC BY-SA / domaine public), redistribuable.
  'upload.wikimedia.org',
  'commons.wikimedia.org',
]);

if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

if (!fs.existsSync(CATALOGUE)) {
  console.error('✗ public/catalogue.json absent — lance d’abord `node scripts/make-seed-catalogue.js`');
  process.exit(1);
}

const catalogue = JSON.parse(fs.readFileSync(CATALOGUE, 'utf8'));
const sources = fs.existsSync(SOURCES)
  ? JSON.parse(fs.readFileSync(SOURCES, 'utf8'))
  : {};

// Build the unique list of (model, color, target path) tuples.
const seen = new Set();
/** @type {{ model: string, color: string, target: string }[]} */
const targets = [];
for (const v of catalogue.variants) {
  const key = `${v.model}|${v.color}`;
  if (seen.has(key)) continue;
  seen.add(key);
  // catalogue stores web-rooted paths like "/images/foo.png" — the actual file
  // lives under public/, so prepend "public" before resolving against ROOT.
  const webPath = v.images[0].replace(/^\/+/, '');
  targets.push({ model: v.model, color: v.color, target: path.join(ROOT, 'public', webPath) });
}

console.log(`→ ${targets.length} couples model|color à traiter`);

// ─────────────────────────────────────────────────────────────────────────
// HTTPS download with redirect follow + host allowlist
// ─────────────────────────────────────────────────────────────────────────
function fetchToFile(url, target, redirectsLeft = 5) {
  return new Promise((resolveP, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch (e) { return reject(new Error(`URL invalide: ${url}`)); }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return reject(new Error(`Schéma non supporté: ${parsed.protocol}`));
    }
    if (!ALLOWED_HOSTS.has(parsed.host)) {
      return reject(new Error(`Hôte non autorisé (reseller bloqué): ${parsed.host}`));
    }

    // Wikimedia's robot policy mandates a descriptive UA with a contact —
    // anything looking generic gets quickly rate-limited (429). Apple's CDN
    // doesn't care. Same string for everyone is fine.
    const ua = 'TEL-CASH-Catalogue-Bot/1.0 (https://telandcash.fr; contact@telandcash.fr) Node.js';
    const req = https.get(parsed, {
      headers: {
        'User-Agent': ua,
        'Accept': 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8',
      },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode || 0)) {
        if (redirectsLeft <= 0) return reject(new Error('Trop de redirections'));
        const next = res.headers.location;
        if (!next) return reject(new Error(`Redirection sans Location (${res.statusCode})`));
        res.resume();
        const nextUrl = next.startsWith('http') ? next : new URL(next, parsed).toString();
        return resolveP(fetchToFile(nextUrl, target, redirectsLeft - 1));
      }
      if ((res.statusCode || 0) >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const tmp = target + '.part';
      const file = fs.createWriteStream(tmp);
      res.pipe(file);
      file.on('finish', () => {
        file.close(async () => {
          try {
            const stat = await fsp.stat(tmp);
            if (stat.size < 1024) {                // <1 KB → almost certainly an error page
              await fsp.unlink(tmp);
              return reject(new Error(`Fichier trop petit (${stat.size} octets)`));
            }
            await fsp.rename(tmp, target);
            resolveP();
          } catch (e) { reject(e); }
        });
      });
      file.on('error', (e) => { fs.unlink(tmp, () => reject(e)); });
    });
    req.on('error', reject);
    req.setTimeout(20_000, () => req.destroy(new Error('timeout')));
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Loop — throttled per host so Wikimedia (strict 429) doesn't ban us.
// ─────────────────────────────────────────────────────────────────────────
const HOST_DELAY_MS = {
  'upload.wikimedia.org':   1500,
  'commons.wikimedia.org':  1500,
};

function hostOf(url) {
  try { return new URL(url).host; } catch { return ''; }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchWithRetry(url, target) {
  // Single retry with backoff if the server gave us a transient 429/5xx.
  try {
    await fetchToFile(url, target);
  } catch (err) {
    if (/HTTP (429|503|502|504)/.test(err.message)) {
      await sleep(4000);
      await fetchToFile(url, target);
      return;
    }
    throw err;
  }
}

(async () => {
  let downloaded = 0, skipped = 0, missing = 0;
  const missingList = [];
  const lastHitAt = new Map(); // host → epoch ms of last request

  for (const t of targets) {
    const key = `${t.model}|${t.color}`;
    const url = (sources[key] || '').trim();

    if (fs.existsSync(t.target) && fs.statSync(t.target).size > 1024) {
      skipped++;
      continue;
    }

    if (!url) {
      missing++;
      missingList.push({ key, target: path.relative(ROOT, t.target), reason: 'aucune URL dans image-sources.json' });
      continue;
    }

    // Per-host throttle
    const host = hostOf(url);
    const delay = HOST_DELAY_MS[host] || 0;
    if (delay > 0) {
      const last = lastHitAt.get(host) || 0;
      const wait = Math.max(0, delay - (Date.now() - last));
      if (wait > 0) await sleep(wait);
      lastHitAt.set(host, Date.now());
    }

    try {
      await fetchWithRetry(url, t.target);
      downloaded++;
      process.stdout.write(`  ✓ ${key}\n`);
    } catch (err) {
      missing++;
      missingList.push({ key, target: path.relative(ROOT, t.target), url, reason: err.message });
      process.stdout.write(`  ✗ ${key} — ${err.message}\n`);
    }
  }

  await fsp.writeFile(MISSING, JSON.stringify(missingList, null, 2) + '\n');

  console.log('');
  console.log(`✓ téléchargées : ${downloaded}`);
  console.log(`  déjà en cache : ${skipped}`);
  console.log(`  manquantes    : ${missing}  (cf. ${path.relative(ROOT, MISSING)})`);
})();
