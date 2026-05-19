/**
 * PARTIAL backfill — no DDL, no grade.
 *
 * Fills storage_capacity, color and cleans the model suffix for Fluxitron
 * products. Does NOT touch `grade` or `is_active` because the current CHECK
 * constraint (migration 007 — FR labels) would block any A/B/C grade update.
 * The full reconciliation (grades + DDL) is handled by the future
 * `scripts/reconcile-fluxitron-data.ts` once DATABASE_URL is available.
 *
 * Usage :
 *   npm run backfill:fluxitron:partial:dry      # dry-run (no writes)
 *   npm run backfill:fluxitron:partial:apply    # apply UPDATEs
 *
 * SECURITY :
 *   Reads SUPABASE_SERVICE_ROLE_KEY from .env.local — admin privileges.
 *   Only run locally; do not commit a bundle that includes the key.
 *
 * IDEMPOTENCE :
 *   - Only rows with source = 'fluxitron' are inspected.
 *   - storage_capacity / color are filled ONLY if currently NULL or empty.
 *   - model is cleaned ONLY if its current value still carries a storage suffix.
 *   - Re-runs are safe: rows already enriched are skipped.
 *
 * SHARED LOGIC :
 *   Imports `enrichFluxitronFromExisting` from the runtime mapper — no
 *   duplicated parsing.
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
  console.log(`\n=== Fluxitron PARTIAL backfill — mode: ${mode} ===\n`);
  console.log('Scope: storage_capacity + color + model cleanup');
  console.log('NOT touched: grade, is_active (handled by reconcile script later)\n');

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
  let willCleanModel = 0;
  let skippedNothingToDo = 0;
  let flaggedCPlus = 0;
  const updates: { id: string; sku: string | null; before: Partial<ProductRow>; after: Record<string, string> }[] = [];
  const noEnrichment: string[] = [];
  const stillPartial: { sku: string | null; missing: string[] }[] = [];

  for (const row of candidates) {
    const enrichment = enrichFluxitronFromExisting(row);

    if (enrichment.rejectedAsCPlus) flaggedCPlus++;

    // Pick ONLY the fields we are allowed to touch in the partial backfill
    const after: Record<string, string> = {};
    if (enrichment.storage_capacity !== undefined && !row.storage_capacity) {
      after.storage_capacity = enrichment.storage_capacity;
      willSetStorage++;
    }
    if (enrichment.color !== undefined && !row.color) {
      after.color = enrichment.color;
      willSetColor++;
    }
    if (enrichment.model !== undefined && enrichment.model !== row.model) {
      after.model = enrichment.model;
      willCleanModel++;
    }

    if (Object.keys(after).length === 0) {
      if (row.storage_capacity && row.color) {
        skippedNothingToDo++;
      } else {
        noEnrichment.push(row.sku || row.id);
      }
      continue;
    }

    updates.push({
      id: row.id,
      sku: row.sku,
      before: {
        model: row.model,
        storage_capacity: row.storage_capacity,
        color: row.color,
      },
      after,
    });

    const missing: string[] = [];
    if (!row.storage_capacity && !after.storage_capacity) missing.push('storage');
    if (!row.color && !after.color) missing.push('color');
    if (missing.length > 0) stillPartial.push({ sku: row.sku, missing });
  }

  console.log('─── Summary ─────────────────────────────────────────────');
  console.log(`Rows that will receive a storage  : ${willSetStorage}`);
  console.log(`Rows that will receive a color    : ${willSetColor}`);
  console.log(`Rows where model will be cleaned  : ${willCleanModel}`);
  console.log(`Rows already complete (skipped)   : ${skippedNothingToDo}`);
  console.log(`Rows nothing can be inferred for  : ${noEnrichment.length}`);
  console.log(`Total rows to UPDATE              : ${updates.length}`);
  console.log(`Rows flagged as C+ (info only)    : ${flaggedCPlus}`);
  console.log('─────────────────────────────────────────────────────────\n');

  if (stillPartial.length > 0) {
    console.log('⚠ Partial enrichment (storage or color stays NULL) :');
    for (const p of stillPartial.slice(0, 10)) {
      console.log(`   ${p.sku} — still missing: ${p.missing.join(', ')}`);
    }
    if (stillPartial.length > 10) console.log(`   …and ${stillPartial.length - 10} more`);
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

  // Verification queries
  console.log('\n─── Verification ────────────────────────────────────────');

  const { data: agg } = await supabase
    .from('products')
    .select('storage_capacity, color')
    .eq('source', 'fluxitron');
  const total = agg?.length || 0;
  const withStorage = (agg || []).filter(r => r.storage_capacity && r.storage_capacity.trim()).length;
  const withColor = (agg || []).filter(r => r.color && r.color.trim()).length;
  console.log(`\nFluxitron totals : total=${total}, with_storage=${withStorage}, with_color=${withColor}`);

  const { data: distModel } = await supabase.from('products').select('model').eq('source', 'fluxitron');
  const models = Array.from(new Set((distModel || []).map(r => r.model))).sort();
  console.log(`\nDISTINCT model :`);
  for (const m of models) console.log(`   ${JSON.stringify(m)}`);

  const { data: distStor } = await supabase.from('products').select('storage_capacity').eq('source', 'fluxitron');
  const stors = Array.from(new Set((distStor || []).map(r => r.storage_capacity))).sort();
  console.log(`\nDISTINCT storage_capacity :`);
  for (const s of stors) console.log(`   ${JSON.stringify(s)}`);

  const { data: distCol } = await supabase.from('products').select('color').eq('source', 'fluxitron').limit(30);
  const cols = Array.from(new Set((distCol || []).map(r => r.color)));
  console.log(`\nDISTINCT color (up to 30) :`);
  for (const c of cols) console.log(`   ${JSON.stringify(c)}`);

  console.log('\n─────────────────────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
