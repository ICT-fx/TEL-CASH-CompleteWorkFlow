// Vérification READ-ONLY de la tarification par marges.
//   npx tsx scripts/verify-margins.ts
// Charge TOUS les produits (pagination), applique les règles via la logique pure
// (src/lib/margins) et rapporte ce que « Appliquer les prix » écrirait — sans
// rien modifier en base. Sert à prouver que la pagination couvre bien tout le
// catalogue (et plus seulement ~1000 produits).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  computeProductPrices,
  type PricingProduct, type MarginRule, type MarginSettings,
} from '../src/lib/margins';

function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8');
    for (const raw of content.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch { /* env via shell */ }
}
loadEnvLocal();

const PAGE = 1000;

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Pagination déterministe — comme dans loadPricingInputs.
  const rows: Record<string, any>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('products')
      .select('id, brand, model, grade, storage_capacity, color, cost_price, price, compare_at_price')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }

  const products: PricingProduct[] = rows.map((p) => ({
    id: p.id, brand: p.brand ?? '', model: p.model ?? '', grade: p.grade,
    storage_capacity: p.storage_capacity, color: p.color,
    cost_price: Number(p.cost_price ?? p.price) || 0, price: Number(p.price) || 0,
    compare_at_price: p.compare_at_price != null ? Number(p.compare_at_price) : null,
  }));

  const { data: ruleRows } = await db.from('margin_rules').select('*');
  const rules = (ruleRows ?? []) as MarginRule[];
  const { data: s } = await db.from('margin_settings').select('*').eq('id', 1).single();
  const settings: MarginSettings = {
    coherence_enabled: s?.coherence_enabled ?? false,
    coherence_min_gap_percent: Number(s?.coherence_min_gap_percent ?? 5),
  };

  const comps = computeProductPrices(products, rules, settings);
  const wouldChange = comps.filter((c) => Math.abs(c.newPrice - c.oldPrice) > 0.0001).length;
  const withBarre = comps.filter((c) => c.compareAtPrice != null).length;

  console.log(`Produits chargés (pagination) : ${products.length}`);
  console.log(`Règles : ${rules.length} · Cohérence : ${settings.coherence_enabled ? 'ON' : 'OFF'} (${settings.coherence_min_gap_percent}%)`);
  console.log(`Prix qui changeraient : ${wouldChange}`);
  console.log(`Avec prix barré calculé : ${withBarre}`);

  const i17 = comps.filter((c) => c.product.model.startsWith('iPhone 17')).slice(0, 8);
  console.log(`\niPhone 17 (échantillon) — coût → nouveau prix [barré] (règle) :`);
  for (const c of i17) {
    console.log(`  ${c.product.model} ${c.product.grade} ${c.product.storage_capacity}: ${c.cost} → ${c.newPrice}` +
      `${c.compareAtPrice ? ` [barré ${c.compareAtPrice}]` : ''}${c.ruleApplied ? '' : ' (aucune règle)'}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
