// Crée/maj l'accessoire-SERVICE « Protection d'écran premium ScreenArmor
// (posée en magasin) » — protection écran générique, compatible tous smartphones,
// posée par nos soins en magasin sur le téléphone commandé avant expédition.
//
//   node scripts/seed-protection-premium.mjs
//
// Idempotent : upsert sur la clé unique `sku`. Même schéma que seed-verre-protection
// (category='accessoires' + source='manual'). product_type='protection_posee' :
// discriminant DÉDIÉ (≠ 'verre') pour que le bundle « Souvent achetés ensemble »
// l'ajoute EN PLUS du verre, et pour que la logistique le traite comme un SERVICE
// posé sur le téléphone (jamais un colis séparé, poids nul côté Boxtal).
// Prix 20 € → achetable + éligible au bundle. Stock élevé = service ~illimité,
// toujours « En stock ». Image = placeholder transparent (vrai visuel à venir).

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
  sku: 'TC-ACC-PROTECTION-PREMIUM',
  handle: 'protection-ecran-premium-screenarmor',
  brand: 'ScreenArmor',
  model: "Protection d'écran premium ScreenArmor (posée en magasin)",
  storage_capacity: null,
  color: null,
  grade: null,
  battery_health: null,
  price: 20,                       // 20 € → achetable + éligible bundle
  compare_at_price: null,
  stock: 9999,                     // service ~illimité → toujours « En stock »
  images: ['/accessoires/protection-premium.svg'],
  category: 'accessoires',
  is_active: true,
  source: 'manual',
  vendor: 'TEL & CASH',
  product_type: 'protection_posee', // discriminant dédié (≠ verre) — service posé
  condition_description:
    "Protection d'écran dernière génération à revêtement auto-régénérant : les " +
    "micro-rayures du quotidien s'estompent d'elles-mêmes. Sa structure absorbe les " +
    "chocs jusqu'à 5× mieux qu'un film standard, tout en restant d'une finesse extrême " +
    "— sensibilité tactile et clarté de l'écran parfaitement préservées. Nous la posons " +
    "nous-mêmes en magasin, sans bulle ni poussière, sur votre téléphone avant son " +
    "expédition. Compatible avec tous les smartphones.",
};

const sb = createClient(URL, KEY);
const { data, error } = await sb
  .from('products')
  .upsert(product, { onConflict: 'sku', ignoreDuplicates: false })
  .select('id, sku, model, brand, price, stock, category, product_type, is_active');

if (error) { console.error('✗ Upsert error:', error.message); process.exit(1); }
console.log('✓ Protection premium upsertée :', data?.[0]);
