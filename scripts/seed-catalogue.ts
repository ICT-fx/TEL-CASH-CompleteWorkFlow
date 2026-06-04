// Seed the iPhone catalogue into Supabase using the service role key.
//
//   npx tsx scripts/seed-catalogue.ts                  # uses .env.local
//   npx tsx scripts/seed-catalogue.ts --reset-apple    # delete demo Apple rows
//
// Reads public/catalogue.json (built by scripts/make-seed-catalogue.js) and
// upserts every variant on the `sku` unique key, so the script is fully
// idempotent — re-running it never produces duplicates.
//
// The script never touches non-Apple rows; the optional --reset-apple flag
// only deletes pre-existing Apple rows (so we don't leave stale demo SKUs
// behind when the source palette changes).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createAdminClient } from '../src/lib/supabase-admin';

// ── Tiny .env.local loader (no dotenv dependency) ────────────────────────
function loadEnvLocal() {
  const envPath = resolve(__dirname, '..', '.env.local');
  try {
    const content = readFileSync(envPath, 'utf8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env.local absent — assume the env is wired up by the shell
  }
}

loadEnvLocal();

// ── Grade mapping ────────────────────────────────────────────────────────
// The DB CHECK constraint on `products.grade` only accepts the French labels
// (migration 007 is the live state on this Supabase project, migration 008
// has NOT been applied). The catalogue keeps A/B/C for readability and SKU
// stability — we translate to French at insert time only.
//   Display side: normalizeGradeLetter() already converts FR → A/B/C, so the
//   storefront keeps showing "Grade A" / "Grade B" / "Grade C".
const GRADE_FR: Record<string, 'Parfait État' | 'Très Bon État' | 'État Correct'> = {
  'A':       'Parfait État',
  'Grade A': 'Parfait État',
  'B':       'Très Bon État',
  'Grade B': 'Très Bon État',
  'C':       'État Correct',
  'Grade C': 'État Correct',
};

function toFrenchGrade(raw: string): 'Parfait État' | 'Très Bon État' | 'État Correct' {
  const mapped = GRADE_FR[raw.trim()];
  if (!mapped) throw new Error(`Grade inconnu, refus d'insérer : "${raw}"`);
  return mapped;
}

// ── Catalogue shape (subset of make-seed-catalogue.js output) ────────────
interface Variant {
  sku: string;
  handle: string;
  brand: string;
  model: string;
  storage_capacity: string;
  color: string;
  grade: 'A' | 'B' | 'C';
  battery_health: number;
  price: number;
  compare_at_price: number | null;
  stock: number;
  images: string[];
  category: 'telephones' | 'accessoires';
  is_active: boolean;
  source: 'manual' | 'fluxitron';
  vendor: string;
  product_type: string;
}

interface Catalogue {
  generated_at: string;
  stats: { models: number; colors: number; variants: number };
  variants: Variant[];
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || url.includes('your-project') || !key || key.includes('your-service-role-key')) {
    console.error('✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
    console.error('  (current values look like the placeholders shipped with the repo)');
    process.exit(1);
  }

  const cataloguePath = resolve(__dirname, '..', 'public', 'catalogue.json');
  const catalogue: Catalogue = JSON.parse(readFileSync(cataloguePath, 'utf8'));
  const variants = catalogue.variants;
  console.log(`→ ${variants.length} variantes à seeder (catalogue généré le ${catalogue.generated_at})`);

  const supabase = createAdminClient();
  const resetApple = process.argv.includes('--reset-apple');

  // Optional cleanup: deactivate pre-existing Apple rows so the catalog only
  // shows our newly seeded SKUs. We DON'T delete — order_items keeps a FK on
  // products so deleting would either fail or break order history. Rows whose
  // sku matches the new batch get re-activated by the upsert below.
  if (resetApple) {
    console.log('→ --reset-apple : désactivation des Apple existants (preserve l\'historique commandes)');
    const { data: deactivated, error: updErr } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('brand', 'Apple')
      .eq('is_active', true)
      .select('id');
    if (updErr) {
      console.error('✗ Échec désactivation:', updErr.message);
      process.exit(1);
    }
    console.log(`  ${deactivated?.length ?? 0} ligne(s) Apple désactivée(s) (seront réactivées par l\'upsert si le sku correspond)`);
  }

  // Upsert by `sku` (unique). category_id is left to migration 004's
  // legacy → category_id mapping so the FK stays sane.
  const BATCH = 200;
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < variants.length; i += BATCH) {
    const batch = variants.slice(i, i + BATCH);
    const payload = batch.map((v) => ({
      sku:              v.sku,           // sku/handle stay built from A/B/C — stable PK across runs
      handle:           v.handle,
      brand:            v.brand,
      model:            v.model,
      storage_capacity: v.storage_capacity,
      color:            v.color,
      grade:            toFrenchGrade(v.grade), // → 'Parfait État' / 'Très Bon État' / 'État Correct'
      battery_health:   v.battery_health,
      price:            v.price,
      compare_at_price: v.compare_at_price,
      stock:            v.stock,
      images:           v.images,
      category:         v.category,
      is_active:        v.is_active,
      source:           v.source,
      vendor:           v.vendor,
      product_type:     v.product_type,
    }));

    const { data, error } = await supabase
      .from('products')
      .upsert(payload, { onConflict: 'sku', ignoreDuplicates: false })
      .select('id, sku, created_at, updated_at');

    if (error) {
      console.error(`✗ Batch ${i / BATCH + 1} :`, error.message);
      process.exit(1);
    }

    for (const row of data ?? []) {
      // Heuristic: if created_at and updated_at differ, it was an update.
      const c = row.created_at ? Date.parse(row.created_at as string) : 0;
      const u = row.updated_at ? Date.parse(row.updated_at as string) : 0;
      if (Math.abs(u - c) < 2000) inserted++;
      else updated++;
    }

    process.stdout.write(`  upsert ${Math.min(i + BATCH, variants.length)} / ${variants.length}\r`);
  }

  process.stdout.write('\n');
  console.log(`✓ Seed terminé`);
  console.log(`  insérées (approx.) : ${inserted}`);
  console.log(`  mises à jour       : ${updated}`);

  // Sanity check
  const { count, error: countErr } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('brand', 'Apple');
  if (countErr) console.warn('⚠ vérif count:', countErr.message);
  else console.log(`  total Apple en base : ${count}`);
}

main().catch((err) => {
  console.error('✗ Erreur seed:', err);
  process.exit(1);
});
