/**
 * One-shot helper to apply supabase/migrations/008_grade_letters_abc.sql.
 *
 * Strategy :
 *   1) Try supabase.rpc('exec_sql', { query }) — works only if a custom
 *      `exec_sql` SQL function exists in the Supabase project. By default it
 *      does NOT, so this attempt is mostly a courtesy.
 *   2) On failure, print the SQL to stdout for manual execution in the
 *      Supabase SQL Editor.
 *
 * No new npm package is installed. If `pg` were available + DATABASE_URL set,
 * we'd use it; neither is the case here.
 *
 * The migration itself is idempotent — it can be re-run safely.
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

const SQL_PATH = resolve(process.cwd(), 'supabase/migrations/008_grade_letters_abc.sql');
const sql = readFileSync(SQL_PATH, 'utf8');

const { url, key } = loadEnv();
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

console.log('Attempting supabase.rpc(\'exec_sql\', ...) …');
const { error } = await supabase.rpc('exec_sql', { query: sql });

if (!error) {
  console.log('✓ Migration applied via rpc(exec_sql).');
  process.exit(0);
}

// Fallback — RPC failed (likely no exec_sql function defined). Print the SQL.
console.log('\n⚠ Cannot execute SQL automatically:');
console.log(`   ${error.message}`);
console.log('\nPaste the following SQL into Supabase Studio → SQL Editor and run it:');
console.log('────────────────────────────────────────────────────────────');
console.log(sql);
console.log('────────────────────────────────────────────────────────────');
console.log('\nThe migration is idempotent — safe to re-run.');
