// One-shot: deactivate every product whose source = 'fluxitron'.
//
//   npx tsx scripts/disable-fluxitron.ts
//
// Nothing is deleted — past orders that reference those products stay valid.
// Re-running is a no-op (idempotent), the script only flips is_active=false
// on rows still active.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createAdminClient } from '../src/lib/supabase-admin';

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
      ) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch { /* env wired up elsewhere */ }
}

loadEnvLocal();

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('✗ Supabase env vars manquantes');
    process.exit(1);
  }

  const supabase = createAdminClient();

  const { count: totalActive, error: countErr } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'fluxitron')
    .eq('is_active', true);
  if (countErr) {
    console.error('✗ Lecture du nombre actif:', countErr.message);
    process.exit(1);
  }
  console.log(`→ Foxway actifs avant : ${totalActive ?? 0}`);

  const { data, error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('source', 'fluxitron')
    .eq('is_active', true)
    .select('id');

  if (error) {
    console.error('✗ UPDATE:', error.message);
    process.exit(1);
  }

  console.log(`✓ ${data?.length ?? 0} produit(s) Foxway désactivé(s)`);

  const { count: stillActive } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'fluxitron')
    .eq('is_active', true);
  console.log(`→ Foxway actifs après : ${stillActive ?? 0}`);
}

main().catch((e) => { console.error('✗', e); process.exit(1); });
