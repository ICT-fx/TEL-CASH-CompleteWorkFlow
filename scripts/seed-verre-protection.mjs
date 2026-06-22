// Crée/maj l'accessoire « Verre de protection » (protection écran, générique
// compatible smartphone).
//
//   node scripts/seed-verre-protection.mjs
//
// Idempotent : upsert sur la clé unique `sku`. Même schéma que seed-accessoires
// (category='accessoires' + product_type='verre' + source='manual', contraintes
// CHECK respectées). Image = placeholder neutre transparent /accessoires/.
// Prix fixé à 20 € → produit achetable + éligible au bundle « Souvent achetés
// ensemble » (le bundle exclut tout accessoire sans prix valide).

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants'); process.exit(1); }

const product = {
  sku: 'TC-ACC-VERRE-PROTECTION',
  handle: 'verre-de-protection',
  brand: 'TEL & CASH',
  model: 'Verre de protection',
  storage_capacity: null,
  color: null,
  grade: null,
  battery_health: null,
  price: 20,                 // 20 € (fourni) → achetable + éligible bundle
  compare_at_price: null,
  stock: 50,
  images: ['/accessoires/verre-de-protection.png'],
  category: 'accessoires',
  is_active: true,
  source: 'manual',
  vendor: 'TEL & CASH',
  product_type: 'verre',     // protection écran (discriminant des sélecteurs)
};

const sb = createClient(URL, KEY);
const { data, error } = await sb
  .from('products')
  .upsert(product, { onConflict: 'sku', ignoreDuplicates: false })
  .select('id, sku, model, price, category, product_type, is_active');

if (error) { console.error('✗ Upsert error:', error.message); process.exit(1); }
console.log('✓ Verre de protection upserté :', data?.[0]);
