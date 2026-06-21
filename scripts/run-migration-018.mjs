/**
 * Applique supabase/migrations/018_webhook_idempotency_and_atomic_stock.sql.
 *
 * Stratégie identique à run-migration-008.mjs :
 *   1) Tente supabase.rpc('exec_sql', { query }) — ne marche que si la fonction
 *      `exec_sql` existe dans le projet (par défaut elle n'existe PAS).
 *   2) En cas d'échec, imprime le SQL à coller dans Supabase Studio → SQL Editor.
 *
 * La migration est idempotente — ré-exécutable sans risque.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local');
  const env = readFileSync(envPath, 'utf8');
  const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim();
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    key: get('SUPABASE_SERVICE_ROLE_KEY'),
  };
}

const SQL_PATH = resolve(
  process.cwd(),
  'supabase/migrations/018_webhook_idempotency_and_atomic_stock.sql'
);
const sql = readFileSync(SQL_PATH, 'utf8');

const { url, key } = loadEnv();
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

console.log("Attempting supabase.rpc('exec_sql', ...) …");
const { error } = await supabase.rpc('exec_sql', { query: sql });

if (!error) {
  console.log('✓ Migration 018 appliquée via rpc(exec_sql).');
  process.exit(0);
}

console.log('\n⚠ Impossible d\'exécuter le SQL automatiquement :');
console.log(`   ${error.message}`);
console.log('\nCollez le SQL suivant dans Supabase Studio → SQL Editor et exécutez-le :');
console.log('────────────────────────────────────────────────────────────');
console.log(sql);
console.log('────────────────────────────────────────────────────────────');
console.log('\nLa migration est idempotente — ré-exécutable sans risque.');
