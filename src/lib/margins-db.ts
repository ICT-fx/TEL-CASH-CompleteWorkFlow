import { createAdminClient } from '@/lib/supabase-admin';
import {
  computeProductPrices,
  type MarginRule, type MarginSettings, type PricingProduct, type PriceComputation,
} from '@/lib/margins';

type AdminDb = ReturnType<typeof createAdminClient>;

// PostgREST plafonne chaque requête à `db.max_rows` (~1000). Avec 6500+ produits,
// un simple .select() ne renvoie qu'une fraction du catalogue → les marges ne
// s'appliquaient qu'à ~1000 produits. On pagine donc par tranches de 1000, avec
// un ORDER BY déterministe (id) pour ne sauter/dupliquer aucune ligne.
const PAGE = 1000;
async function fetchAllProductRows(db: AdminDb, brand?: string) {
  const all: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    let q = db
      .from('products')
      .select('id, brand, model, grade, storage_capacity, color, cost_price, price, compare_at_price')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (brand) q = q.eq('brand', brand);
    const { data, error } = await q;
    if (error || !data) break;
    all.push(...data);
    if (data.length < PAGE) break;     // dernière tranche atteinte
    from += PAGE;
    if (from > 100_000) break;          // garde-fou
  }
  return all;
}

// Charge produits (filtrés) + règles + réglages pour un calcul.
export async function loadPricingInputs(filter?: { brand?: string }): Promise<{
  products: PricingProduct[];
  rules: MarginRule[];
  settings: MarginSettings;
}> {
  const db = createAdminClient();

  const rows = await fetchAllProductRows(db, filter?.brand);

  const products: PricingProduct[] = rows.map((p: Record<string, any>) => ({
    id: p.id,
    brand: p.brand ?? '',
    model: p.model ?? '',
    grade: p.grade,
    storage_capacity: p.storage_capacity,
    color: p.color,
    cost_price: Number(p.cost_price ?? p.price) || 0,
    price: Number(p.price) || 0,
    compare_at_price: p.compare_at_price != null ? Number(p.compare_at_price) : null,
  }));

  const { data: ruleRows } = await db.from('margin_rules').select('*');
  const rules = (ruleRows ?? []) as MarginRule[];

  const { data: s } = await db.from('margin_settings').select('*').eq('id', 1).single();
  const settings: MarginSettings = {
    coherence_enabled: s?.coherence_enabled ?? false,
    coherence_min_gap_percent: Number(s?.coherence_min_gap_percent ?? 5),
  };

  return { products, rules, settings };
}

// Calcule l'aperçu (sans écrire).
export async function previewPrices(filter?: { brand?: string }): Promise<PriceComputation[]> {
  const { products, rules, settings } = await loadPricingInputs(filter);
  return computeProductPrices(products, rules, settings);
}

// Recalcule puis ÉCRIT price pour les produits dont le prix change.
// Réutilisé par /apply et par l'import Fluxitron (cost_price modifié).
// NOTE: la cohérence A>B>C a besoin de TOUTE la famille — on charge donc tous les
// produits (ou la marque), on calcule, PUIS on filtre par productIds. Ne jamais
// charger seulement les productIds.
export async function recomputeAndWritePrices(filter?: {
  brand?: string;
  productIds?: string[];
}): Promise<{ updated: number }> {
  const db = createAdminClient();
  const { products, rules, settings } = await loadPricingInputs(
    filter?.brand ? { brand: filter.brand } : undefined
  );

  let comps = computeProductPrices(products, rules, settings);
  if (filter?.productIds?.length) {
    const set = new Set(filter.productIds);
    comps = comps.filter((c) => set.has(c.product.id));
  }

  const EPS = 0.0001;
  // On écrit le prix barré (compare_at_price) UNIQUEMENT quand une règle « barré »
  // produit une valeur. Sans règle barré, on ne touche pas la colonne (on évite
  // d'écraser un barré venu de Fluxitron / saisi à la main).
  const toWrite = comps
    .map((c) => {
      const priceChanged = Math.abs(c.newPrice - c.oldPrice) > EPS;
      const oldCompare = c.product.compare_at_price;
      const compareChanged =
        c.compareAtPrice != null && Math.abs(c.compareAtPrice - (oldCompare ?? -1)) > EPS;
      if (!priceChanged && !compareChanged) return null;
      const payload: { price: number; compare_at_price?: number } = { price: c.newPrice };
      if (c.compareAtPrice != null) payload.compare_at_price = c.compareAtPrice;
      return { id: c.product.id, payload };
    })
    .filter((x): x is { id: string; payload: { price: number; compare_at_price?: number } } => x !== null);

  // Écritures par lots pour ne pas ouvrir des milliers de connexions d'un coup
  // (une règle globale peut toucher des milliers de produits).
  const WRITE_CHUNK = 200;
  for (let i = 0; i < toWrite.length; i += WRITE_CHUNK) {
    const batch = toWrite.slice(i, i + WRITE_CHUNK);
    await Promise.all(batch.map((w) => db.from('products').update(w.payload).eq('id', w.id)));
  }
  return { updated: toWrite.length };
}
