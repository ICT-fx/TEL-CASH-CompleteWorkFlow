// Optimise les packshots dans public/images : resize <=720px + PNG palette.
// Mêmes noms de fichiers (.png) -> aucune référence à changer, transparence gardée.
//   node scripts/optimize-product-images.mjs
import sharp from 'sharp';
import fs from 'fs';

const DIR = 'public/images';
const MAX = 720;

const files = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.png'));
let before = 0, after = 0, done = 0, skipped = 0;

for (const f of files) {
  const p = `${DIR}/${f}`;
  const sizeBefore = fs.statSync(p).size;
  try {
    const meta = await sharp(p).metadata();
    // ne retraite pas si déjà petit (<=720 et <120Ko)
    if ((meta.width || 0) <= MAX && sizeBefore < 120_000) { skipped++; before += sizeBefore; after += sizeBefore; continue; }
    const buf = await sharp(p)
      .resize(MAX, MAX, { fit: 'inside', withoutEnlargement: true })
      .png({ palette: true, quality: 82, effort: 9, compressionLevel: 9 })
      .toBuffer();
    // n'écrit que si on gagne de la place
    if (buf.length < sizeBefore) { fs.writeFileSync(p, buf); after += buf.length; }
    else { after += sizeBefore; }
    before += sizeBefore;
    done++;
  } catch (e) {
    console.log(`skip ${f}: ${e.message}`);
    before += sizeBefore; after += sizeBefore; skipped++;
  }
}

const mo = (b) => (b / 1048576).toFixed(1);
console.log(`Optimisé ${done} images (${skipped} ignorées).`);
console.log(`Total: ${mo(before)} Mo -> ${mo(after)} Mo  (${Math.round((1 - after / before) * 100)}% de moins)`);
