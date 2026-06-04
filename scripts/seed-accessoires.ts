// Seed the accessories catalogue (coques, verres, chargeurs, câbles…).
//
//   npx tsx scripts/seed-accessoires.ts
//
// Idempotent : upsert sur la clé unique `sku` (même pattern que le seed
// catalogue iPhone). Aucune DELETE → l'historique commandes éventuel reste
// intact si un order_item référence un accessoire.
//
// Pourquoi pas `source='manual-accessoire'` comme suggéré dans la consigne ?
// La contrainte CHECK products_source_check (migration 006) n'accepte que
// 'manual' | 'fluxitron'. Pas de migration possible → on identifie les
// accessoires par `category='accessoires'` + `product_type='accessoire'`
// (et `source='manual'` pour rester valide). Le bouton `catalogue:accessoires:reset`
// désactive proprement (is_active=false) les anciens manual-accessoires si besoin.

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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch { /* env ailleurs */ }
}
loadEnvLocal();

// ── Catalogue accessoires ────────────────────────────────────────────────
interface Accessoire {
  sku: string;
  brand: string;
  model: string;
  price: number;
  stock: number;
  image: string;          // path under /public — stored as is in products.images[]
  productType: string;    // 'coque' | 'verre' | 'chargeur' | 'cable' | 'ecouteurs' | 'batterie'
}

const ACCESSOIRES: Accessoire[] = [
  // Coques (universelles, pas de modèle spécifique)
  { sku: 'TC-ACC-COQUE-TRANSPARENTE',  brand: 'TEL & CASH', model: 'Coque transparente',      productType: 'coque',     price: 19.99, stock: 50, image: '/images/accessories/coque-transparente.svg' },
  { sku: 'TC-ACC-COQUE-SILICONE-NOIR', brand: 'TEL & CASH', model: 'Coque silicone noir',     productType: 'coque',     price: 19.99, stock: 50, image: '/images/accessories/coque-silicone-noir.svg' },
  { sku: 'TC-ACC-COQUE-MAGSAFE',       brand: 'TEL & CASH', model: 'Coque MagSafe',           productType: 'coque',     price: 29.99, stock: 40, image: '/images/accessories/coque-magsafe.svg' },

  // Verre trempé
  { sku: 'TC-ACC-VERRE-TREMPE-9H',     brand: 'TEL & CASH', model: 'Verre trempé 9H',         productType: 'verre',     price: 14.99, stock: 80, image: '/images/accessories/verre-trempe.svg' },

  // Chargeurs
  { sku: 'TC-ACC-CHARGEUR-USBC-20W',   brand: 'TEL & CASH', model: 'Chargeur USB-C 20W',      productType: 'chargeur',  price: 24.99, stock: 40, image: '/images/accessories/chargeur-usbc-20w.svg' },
  { sku: 'TC-ACC-CHARGEUR-MAGSAFE',    brand: 'TEL & CASH', model: 'Chargeur MagSafe',        productType: 'chargeur',  price: 39.99, stock: 30, image: '/images/accessories/chargeur-magsafe.svg' },
  { sku: 'TC-ACC-ADAPTATEUR-SECTEUR',  brand: 'TEL & CASH', model: 'Adaptateur secteur',      productType: 'chargeur',  price: 19.99, stock: 60, image: '/images/accessories/adaptateur-secteur.svg' },

  // Câbles
  { sku: 'TC-ACC-CABLE-USBC-LIGHTNING', brand: 'TEL & CASH', model: 'Câble USB-C → Lightning', productType: 'cable',    price: 12.99, stock: 80, image: '/images/accessories/cable-usbc-lightning.svg' },
  { sku: 'TC-ACC-CABLE-USBC-USBC',     brand: 'TEL & CASH', model: 'Câble USB-C → USB-C',     productType: 'cable',     price: 12.99, stock: 80, image: '/images/accessories/cable-usbc-usbc.svg' },

  // Écouteurs
  { sku: 'TC-ACC-ECOUTEURS-FILAIRES',  brand: 'TEL & CASH', model: 'Écouteurs filaires',      productType: 'ecouteurs', price: 14.99, stock: 50, image: '/images/accessories/ecouteurs-filaires.svg' },
  { sku: 'TC-ACC-ECOUTEURS-SANS-FIL',  brand: 'TEL & CASH', model: 'Écouteurs sans fil',      productType: 'ecouteurs', price: 29.99, stock: 35, image: '/images/accessories/ecouteurs-sans-fil.svg' },

  // Batterie externe
  { sku: 'TC-ACC-BATTERIE-EXTERNE-10K', brand: 'TEL & CASH', model: 'Batterie externe 10 000 mAh', productType: 'batterie', price: 34.99, stock: 30, image: '/images/accessories/batterie-externe.svg' },
];

function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants');
    process.exit(1);
  }
  const supabase = createAdminClient();

  console.log(`→ ${ACCESSOIRES.length} accessoires à seeder`);

  const payload = ACCESSOIRES.map((a) => ({
    sku:              a.sku,
    handle:           slugify(`tc-acc-${a.model}`),
    brand:            a.brand,
    model:            a.model,
    storage_capacity: null,
    color:            null,
    grade:            null,             // CHECK accepte NULL (migration 007)
    battery_health:   null,
    price:            a.price,
    compare_at_price: null,
    stock:            a.stock,
    images:           [a.image],
    category:         'accessoires',
    is_active:        true,
    source:           'manual',         // contrainte CHECK n'autorise pas autre chose
    vendor:           a.brand,
    product_type:     a.productType,    // discriminant interne pour les sélecteurs
  }));

  const { data, error } = await supabase
    .from('products')
    .upsert(payload, { onConflict: 'sku', ignoreDuplicates: false })
    .select('id, sku, category, product_type');

  if (error) {
    console.error('✗ Upsert error:', error.message);
    process.exit(1);
  }
  console.log(`✓ ${data?.length ?? 0} accessoires upsertés`);

  // Sanity check
  const { count: actifs } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category', 'accessoires')
    .eq('is_active', true);
  console.log(`→ Accessoires actifs en base : ${actifs ?? 0}`);

  const { data: byType } = await supabase
    .from('products')
    .select('product_type')
    .eq('category', 'accessoires')
    .eq('is_active', true);
  const tally: Record<string, number> = {};
  for (const r of byType ?? []) {
    const k = (r as any).product_type ?? 'unknown';
    tally[k] = (tally[k] || 0) + 1;
  }
  console.log('→ Répartition par type :', tally);
}

main().catch((e) => { console.error('✗', e); process.exit(1); });
