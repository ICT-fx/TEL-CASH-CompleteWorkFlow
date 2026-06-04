#!/usr/bin/env node
// Normalize every photo under public/images/ to a uniform e-commerce look:
//   - 1200×1200 square canvas
//   - flat white background
//   - phone centered with ~10% padding (occupies ~80% of the canvas)
//   - PNG, same filename so catalogue paths keep working
//
//   node scripts/normalize-images.js
//
// Originals are copied to public/images/_originals/ before any rewrite, so
// the script is safe to re-run. Already-normalized files are skipped on
// re-runs via a marker in PNG metadata. Failures never crash the run.

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const ROOT      = path.resolve(__dirname, '..');
const IMG_DIR   = path.join(ROOT, 'public/images');
const BACKUP    = path.join(IMG_DIR, '_originals');
const NON_FLAT  = path.join(IMG_DIR, '_fond-non-uniforme.json');

const TARGET   = 1200;                       // square canvas size
const PADDING  = 0.10;                       // % of canvas on each side
const INNER    = Math.round(TARGET * (1 - 2 * PADDING));  // ≈ 960px max phone size
const WHITE    = { r: 255, g: 255, b: 255, alpha: 1 };
const MARKER   = 'tc-normalized-v1';         // metadata tag to skip re-runs

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

async function safeCopy(srcAbs, dstAbs) {
  if (fs.existsSync(dstAbs)) return false;
  await fsp.copyFile(srcAbs, dstAbs);
  return true;
}

// Decide whether the background of an image is "uniform" enough that a
// simple trim() + flatten() will look clean. Heuristic: sample the 4 corners
// (10×10 px) and check their colours are bright (>=240) and close to each
// other (max delta <= 25 per channel). Anything else looks like a lifestyle
// shot / gradient and would need IA cutout.
async function backgroundIsUniform(buf) {
  try {
    const meta = await sharp(buf).metadata();
    const w = meta.width  ?? 0;
    const h = meta.height ?? 0;
    if (w < 40 || h < 40) return true; // tiny → ignore the heuristic
    const corners = [
      { left: 0,         top: 0,          width: 10, height: 10 },
      { left: w - 10,    top: 0,          width: 10, height: 10 },
      { left: 0,         top: h - 10,     width: 10, height: 10 },
      { left: w - 10,    top: h - 10,     width: 10, height: 10 },
    ];
    const samples = [];
    for (const c of corners) {
      const { data, info } = await sharp(buf).extract(c).raw().toBuffer({ resolveWithObject: true });
      const px = info.width * info.height;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < data.length; i += info.channels) {
        r += data[i]; g += data[i + 1]; b += data[i + 2];
      }
      samples.push([Math.round(r / px), Math.round(g / px), Math.round(b / px)]);
    }
    // All corners must be near-white …
    const allBright = samples.every(([r, g, b]) => r >= 240 && g >= 240 && b >= 240);
    if (!allBright) return false;
    // … and close to each other (no gradient).
    const range = (idx) => Math.max(...samples.map((s) => s[idx])) - Math.min(...samples.map((s) => s[idx]));
    return range(0) <= 25 && range(1) <= 25 && range(2) <= 25;
  } catch {
    return false;
  }
}

async function processOne(filename) {
  const srcAbs = path.join(IMG_DIR, filename);

  // Skip directories and our markers files
  const st = await fsp.stat(srcAbs);
  if (st.isDirectory()) return { status: 'skip-dir' };
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return { status: 'skip-ext' };

  // Read once into memory so we can introspect + rewrite atomically.
  const original = await fsp.readFile(srcAbs);

  // Skip if already normalized (marker present)
  try {
    const meta = await sharp(original).metadata();
    const desc = (meta.exif && meta.exif.toString()) || '';
    const comment = (meta.comments?.map((c) => c.text).join(' ')) || '';
    if (
      comment.includes(MARKER) ||
      desc.includes(MARKER) ||
      (meta.width === TARGET && meta.height === TARGET && comment.includes(MARKER))
    ) {
      return { status: 'already-normalized' };
    }
  } catch {
    // unreadable → fall through to error path below
  }

  // Backup original (only the first time)
  await safeCopy(srcAbs, path.join(BACKUP, filename));

  const uniform = await backgroundIsUniform(original);

  // Trim — sharp's default trim() looks at corner pixels, perfect for clean
  // white-background product shots. We feed it a small tolerance so JPEG
  // compression noise doesn't keep a halo around the phone.
  let trimmed;
  try {
    trimmed = await sharp(original)
      .flatten({ background: WHITE })   // kill any residual transparency before trimming
      .trim({ threshold: 12 })
      .toBuffer();
  } catch (err) {
    // Some files have no detectable border to trim → keep the flattened source.
    trimmed = await sharp(original).flatten({ background: WHITE }).toBuffer();
  }

  // Resize so the trimmed image fits the inner safe area, then centre it
  // on a square white canvas.
  const resized = await sharp(trimmed)
    .resize(INNER, INNER, { fit: 'inside', withoutEnlargement: false })
    .toBuffer();

  const out = await sharp({
    create: { width: TARGET, height: TARGET, channels: 4, background: WHITE },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .flatten({ background: WHITE })
    .png({ compressionLevel: 9 })
    .withMetadata({ comment: MARKER })
    .toBuffer();

  // Atomic write
  const tmp = srcAbs + '.tmp';
  await fsp.writeFile(tmp, out);
  await fsp.rename(tmp, srcAbs);

  return { status: 'normalized', uniform };
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────

(async () => {
  if (!fs.existsSync(IMG_DIR)) {
    console.error('✗ public/images/ absent');
    process.exit(1);
  }
  await fsp.mkdir(BACKUP, { recursive: true });

  const entries = (await fsp.readdir(IMG_DIR)).filter((name) => {
    if (name.startsWith('_')) return false;
    if (name.startsWith('.')) return false;
    return true;
  });

  let normalized = 0;
  let alreadyDone = 0;
  let skipped = 0;
  let failed = 0;
  const nonUniform = [];
  const failures = [];

  console.log(`→ ${entries.length} fichiers à examiner dans public/images/`);

  for (const name of entries) {
    try {
      const res = await processOne(name);
      if (res.status === 'normalized') {
        normalized++;
        if (!res.uniform) nonUniform.push(name);
        process.stdout.write(`  ✓ ${name}\n`);
      } else if (res.status === 'already-normalized') {
        alreadyDone++;
      } else {
        skipped++;
      }
    } catch (err) {
      failed++;
      failures.push({ file: name, error: err.message });
      process.stdout.write(`  ✗ ${name} — ${err.message}\n`);
    }
  }

  await fsp.writeFile(
    NON_FLAT,
    JSON.stringify({
      generated_at: new Date().toISOString(),
      note: 'Coins non uniformément blancs : fond complexe / lifestyle / dégradé. Détourage IA recommandé.',
      files: nonUniform,
    }, null, 2) + '\n',
  );

  console.log('');
  console.log(`✓ normalisées       : ${normalized}`);
  console.log(`  déjà normalisées  : ${alreadyDone}`);
  console.log(`  fonds non uniformes (heuristique) : ${nonUniform.length}  → ${path.relative(ROOT, NON_FLAT)}`);
  console.log(`  skippées (dossier/format) : ${skipped}`);
  console.log(`  échecs            : ${failed}`);
  console.log(`  format de sortie  : ${TARGET}×${TARGET} PNG fond blanc, padding ${PADDING * 100}%`);

  if (failures.length) {
    console.log('');
    console.log('Échecs détaillés :');
    for (const f of failures) console.log(`  - ${f.file} : ${f.error}`);
  }
})();
