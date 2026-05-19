/**
 * Backfill script — fill in missing storage_capacity / color / grade / model
 * for products inserted via Fluxitron BEFORE the mapper had the title/tags/
 * description fallbacks.
 *
 * Usage :
 *   npm run backfill:fluxitron:dry        # dry-run (no DB writes)
 *   npm run backfill:fluxitron:apply      # apply UPDATEs
 *
 * SECURITY :
 *   This script reads SUPABASE_SERVICE_ROLE_KEY from .env.local — it has
 *   admin-level DB privileges. Only run it locally, never commit a build
 *   artifact that bundles the key.
 *
 * IDEMPOTENCE :
 *   - Only rows with source = 'fluxitron' are touched.
 *   - For each row, only fields currently NULL are filled — admin manual
 *     edits are never overwritten.
 *   - Re-running the script is safe : already-enriched rows are skipped.
 *
 * SHARED LOGIC :
 *   This script imports `enrichFluxitronFromExisting` from the same
 *   mappers.ts used by the runtime — no duplicated parsing logic.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { enrichFluxitronFromExisting } from '../src/app/api/v1/_lib/mappers';

function loadEnv(): { url: string; key: string } {
  const envPath = resolve(process.cwd(), '.env.local');
  const env = readFileSync(envPath, 'utf8');
  const get = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim();
  const url = get('NEXT_PUBLIC_SUPABASE_URL');
  const key = get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  return { url, key };
}

interface ProductRow {
  id: string;
  brand: string | null;
  model: string | null;
  storage_capacity: string | null;
  color: string | null;
  grade: string | null;
  condition_description: string | null;
  tags: string[] | null;
  sku: string | null;
  source: string | null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const mode = apply ? 'LIVE' : 'DRY-RUN';
  console.log(`\n=== Fluxitron backfill — mode: ${mode} ===\n`);

  const { url, key } = loadEnv();
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: rows, error } = await supabase
    .from('products')
    .select('id, brand, model, storage_capacity, color, grade, condition_description, tags, sku, source')
    .eq('source', 'fluxitron');

  if (error) {
    console.error('Supabase read error:', error);
    process.exit(1);
  }

  const candidates = (rows || []) as ProductRow[];
  console.log(`Inspected: ${candidates.length} Fluxitron rows\n`);

  let willSetStorage = 0;
  let willSetColor = 0;
  let willSetGrade = 0;
  let willCleanModel = 0;
  let skippedAlreadyFull = 0;
  const updates: { id: string; sku: string | null; before: Partial<ProductRow>; after: Record<string, string> }[] = [];
  const noEnrichment: string[] = [];   // Rows we couldn't enrich at all
  const partialEnrichment: { sku: string | null; missing: string[] }[] = [];  // Rows where some fields stayed null

  for (const row of candidates) {
    const enrichment = enrichFluxitronFromExisting(row);

    // Skip if nothing to do
    if (
      enrichment.storage_capacity === undefined &&
      enrichment.color === undefined &&
      enrichment.grade === undefined &&
      enrichment.model === undefined
    ) {
      if (row.storage_capacity && row.color && row.grade) {
        skippedAlreadyFull++;
      } else {
        noEnrichment.push(row.sku || row.id);
      }
      continue;
    }

    const after: Record<string, string> = {};
    if (enrichment.storage_capacity !== undefined && !row.storage_capacity) {
      after.storage_capacity = enrichment.storage_capacity;
      willSetStorage++;
    }
    if (enrichment.color !== undefined && !row.color) {
      after.color = enrichment.color;
      willSetColor++;
    }
    if (enrichment.grade !== undefined && !row.grade) {
      after.grade = enrichment.grade;
      willSetGrade++;
    }
    if (enrichment.model !== undefined && enrichment.model !== row.model) {
      after.model = enrichment.model;
      willCleanModel++;
    }

    if (Object.keys(after).length === 0) {
      continue;
    }

    updates.push({
      id: row.id,
      sku: row.sku,
      before: {
        model: row.model,
        storage_capacity: row.storage_capacity,
        color: row.color,
        grade: row.grade,
      },
      after,
    });

    // Track rows that still won't be complete after enrichment
    const missing: string[] = [];
    if (!row.storage_capacity && !after.storage_capacity) missing.push('storage');
    if (!row.color && !after.color) missing.push('color');
    if (!row.grade && !after.grade) missing.push('grade');
    if (missing.length > 0) partialEnrichment.push({ sku: row.sku, missing });
  }

  console.log('─── Summary ─────────────────────────────────────────────');
  console.log(`Rows that will receive a storage  : ${willSetStorage}`);
  console.log(`Rows that will receive a color    : ${willSetColor}`);
  console.log(`Rows that will receive a grade    : ${willSetGrade}`);
  console.log(`Rows where model will be cleaned  : ${willCleanModel}`);
  console.log(`Rows already complete (skipped)   : ${skippedAlreadyFull}`);
  console.log(`Rows nothing can be inferred for  : ${noEnrichment.length}`);
  console.log(`Total rows to UPDATE              : ${updates.length}`);
  console.log('─────────────────────────────────────────────────────────\n');

  if (partialEnrichment.length > 0) {
    console.log('⚠ Partial enrichment (some fields stay NULL) :');
    for (const p of partialEnrichment.slice(0, 10)) {
      console.log(`   ${p.sku} — still missing: ${p.missing.join(', ')}`);
    }
    if (partialEnrichment.length > 10) console.log(`   …and ${partialEnrichment.length - 10} more`);
    console.log('');
  }

  if (noEnrichment.length > 0) {
    console.log('⚠ Could not infer ANY field for these rows :');
    for (const sku of noEnrichment.slice(0, 5)) console.log(`   ${sku}`);
    if (noEnrichment.length > 5) console.log(`   …and ${noEnrichment.length - 5} more`);
    console.log('');
  }

  console.log('─── 3 detailed examples (BEFORE → AFTER) ────────────────');
  for (const u of updates.slice(0, 3)) {
    console.log(`\n• SKU ${u.sku}`);
    console.log('   BEFORE:', JSON.stringify(u.before));
    console.log('   AFTER :', JSON.stringify(u.after));
  }
  console.log('\n─────────────────────────────────────────────────────────\n');

  if (!apply) {
    console.log('DRY-RUN — nothing was written. Re-run with --apply to commit.');
    return;
  }

  console.log(`Applying ${updates.length} UPDATEs…`);
  let ok = 0;
  let fail = 0;
  for (const u of updates) {
    const { error } = await supabase
      .from('products')
      .update(u.after)
      .eq('id', u.id);
    if (error) {
      fail++;
      console.error(`   ✗ ${u.sku}: ${error.message}`);
    } else {
      ok++;
    }
  }
  console.log(`\nDone. ${ok} succeeded, ${fail} failed.`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
