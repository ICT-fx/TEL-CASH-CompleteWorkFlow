// Logique pure des marges — aucune dépendance React/DB, entièrement testable.
import { displayGrade, type DisplayGrade } from './products';

export type ScopeLevel = 'global' | 'brand' | 'model' | 'product';
export type MarginType = 'percent' | 'fixed' | 'combined';
export type Rounding = 'cent' | 'decicent' | 'euro' | 'five_euro' | 'ten_euro' | 'ends_99';

// Arrondit une valeur selon le mode choisi.
export function applyRounding(value: number, mode: Rounding): number {
  if (!Number.isFinite(value)) return 0;
  switch (mode) {
    case 'cent':
      return Math.round(value * 100) / 100;
    case 'decicent':
      return Math.round(value * 1000) / 1000;
    case 'euro':
      return Math.round(value);
    case 'five_euro':
      return Math.round(value / 5) * 5;
    case 'ten_euro':
      return Math.round(value / 10) * 10;
    case 'ends_99': {
      // Arrondi à l'euro le plus proche puis −0,01 → prix en X,99.
      const euros = Math.round(value);
      return Math.max(0, euros) - 0.01;
    }
  }
}

export type StrikeType = 'percent' | 'fixed';

export interface MarginRule {
  id: string;
  scope_level: ScopeLevel;
  brand: string | null;
  model: string | null;
  product_id: string | null;
  grade: DisplayGrade | null; // A/B/C ou null = tous grades
  margin_type: MarginType;
  margin_percent: number | null;
  margin_fixed: number | null;
  rounding: Rounding;
  // Prix barré (compare_at_price) — calculé DEPUIS le prix de vente.
  // « X % en moins » = remise affichée X % → barré = prix / (1 − X/100).
  // « Y € en moins » → barré = prix + Y.
  strike_enabled?: boolean | null;
  strike_type?: StrikeType | null;
  strike_value?: number | null;
  strike_rounding?: Rounding | null;
}

export interface PricingProduct {
  id: string;
  brand: string;
  model: string;
  grade: string | null;            // grade brut (A+/A/B+/…)
  storage_capacity: string | null;
  color: string | null;
  cost_price: number;
  price: number;                   // prix de vente courant (pour avant/après)
  compare_at_price: number | null; // prix barré courant
}

// Prix de vente = coût + marge, puis arrondi (porté par la règle).
export function computeSellingPrice(cost: number, r: MarginRule): number {
  const pct = r.margin_percent ?? 0;
  const fixed = r.margin_fixed ?? 0;
  let raw = cost;
  if (r.margin_type === 'percent') raw = cost * (1 + pct / 100);
  else if (r.margin_type === 'fixed') raw = cost + fixed;
  else raw = cost * (1 + pct / 100) + fixed; // combined
  return applyRounding(raw, r.rounding);
}

// Prix barré (compare_at_price) calculé DEPUIS le prix de vente déjà margé.
// percent : « X % en moins » → le prix affiché est X % sous le barré →
//   barré = prix / (1 − X/100). fixed : barré = prix + Y €. Puis arrondi.
// Renvoie null si le barré n'est pas activé / valeur invalide.
export function computeStrikePrice(price: number, r: MarginRule): number | null {
  if (!r.strike_enabled) return null;
  const type: StrikeType = r.strike_type ?? 'percent';
  const value = r.strike_value ?? 0;
  if (!(value > 0)) return null;
  let raw: number;
  if (type === 'percent') {
    if (value >= 100) return null; // remise ≥ 100 % impossible
    raw = price / (1 - value / 100);
  } else {
    raw = price + value;
  }
  const barre = applyRounding(raw, r.strike_rounding ?? 'ends_99');
  // Le barré doit rester strictement au-dessus du prix pour avoir un sens.
  return barre > price ? barre : null;
}

const eqi = (a: string | null, b: string | null) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

// Une règle s'applique-t-elle à ce produit ? (scope + grade)
function ruleMatches(p: PricingProduct, r: MarginRule): boolean {
  const dg = displayGrade(p.grade);
  if (r.grade && r.grade !== dg) return false;
  switch (r.scope_level) {
    case 'global': return true;
    case 'brand': return eqi(p.brand, r.brand);
    case 'model': return eqi(p.brand, r.brand) && eqi(p.model, r.model);
    case 'product': return p.id === r.product_id;
  }
}

// Spécificité : produit(3) > modèle(2) > marque(1) > global(0), +1 si grade ciblé.
function specificity(r: MarginRule): number {
  const base = { product: 3, model: 2, brand: 1, global: 0 }[r.scope_level];
  return base * 2 + (r.grade ? 1 : 0);
}

// Règle la plus spécifique qui matche, ou null.
export function resolveRule(p: PricingProduct, rules: MarginRule[]): MarginRule | null {
  let best: MarginRule | null = null;
  let bestScore = -1;
  for (const r of rules) {
    if (!ruleMatches(p, r)) continue;
    const s = specificity(r);
    if (s > bestScore) { best = r; bestScore = s; }
  }
  return best;
}

export interface MarginSettings {
  coherence_enabled: boolean;
  coherence_min_gap_percent: number;
}

export interface PriceComputation {
  product: PricingProduct;
  cost: number;
  oldPrice: number;
  newPrice: number;
  marginPct: number;          // (newPrice - cost) / cost
  ruleApplied: string | null; // rule.id ou null
  coherenceAdjusted: boolean; // prix remonté par la cohérence A/B/C
  lowMargin: boolean;         // marginPct < LOW_MARGIN_THRESHOLD
  compareAtPrice: number | null; // prix barré calculé (null si pas de règle barré)
}

export const LOW_MARGIN_THRESHOLD = 0.05;

// Clé de famille pour la cohérence : même téléphone, grades différents.
function familyKey(p: PricingProduct): string {
  return [p.brand, p.model, p.storage_capacity, p.color]
    .map((s) => (s ?? '').trim().toLowerCase()).join('|');
}

// Arrondi VERS LE HAUT au pas du mode — utilisé par la cohérence pour ne pas
// repasser sous le seuil après ré-arrondi.
function roundUp(value: number, mode: Rounding): number {
  switch (mode) {
    case 'cent': return Math.ceil(value * 100) / 100;
    case 'decicent': return Math.ceil(value * 1000) / 1000;
    case 'euro': return Math.ceil(value);
    case 'five_euro': return Math.ceil(value / 5) * 5;
    case 'ten_euro': return Math.ceil(value / 10) * 10;
    case 'ends_99': {
      // Le prix en X,99 doit rester >= value (plancher de cohérence) : on prend
      // le premier palier ,99 supérieur ou égal à value.
      let euros = Math.ceil(value);
      if (euros - 0.01 < value) euros += 1;
      return Math.max(0, euros) - 0.01;
    }
  }
}

export function computeProductPrices(
  products: PricingProduct[],
  rules: MarginRule[],
  settings: MarginSettings
): PriceComputation[] {
  // 1. Prix de base depuis cascade + marge.
  const computations: PriceComputation[] = products.map((p) => {
    const cost = Number(p.cost_price) || 0;
    const r = resolveRule(p, rules);
    const newPrice = r ? computeSellingPrice(cost, r) : cost;
    return {
      product: p, cost, oldPrice: Number(p.price) || 0, newPrice,
      marginPct: cost > 0 ? (newPrice - cost) / cost : 0,
      ruleApplied: r?.id ?? null, coherenceAdjusted: false, lowMargin: false,
      compareAtPrice: null,
    };
  });

  // 2. Cohérence A > B > C par famille (remontée seule).
  if (settings.coherence_enabled) {
    const gap = 1 + (Number(settings.coherence_min_gap_percent) || 0) / 100;
    const families = new Map<string, PriceComputation[]>();
    for (const c of computations) {
      const k = familyKey(c.product);
      let arr = families.get(k);
      if (!arr) { arr = []; families.set(k, arr); }
      arr.push(c);
    }
    for (const group of families.values()) {
      const byGrade = new Map<DisplayGrade, PriceComputation>();
      for (const c of group) {
        const dg = displayGrade(c.product.grade);
        if (!dg) continue;
        // En cas de doublon de grade dans une famille, garder le + cher (référence).
        const prev = byGrade.get(dg);
        if (!prev || c.newPrice > prev.newPrice) byGrade.set(dg, c);
      }
      // Du pire (C) vers le meilleur (Premium) : chaque grade supérieur dépasse le plancher.
      const order: DisplayGrade[] = ['C', 'B', 'A', 'Premium'];
      let floor = 0;
      for (const dg of order) {
        const c = byGrade.get(dg);
        if (!c) continue;
        if (floor > 0 && c.newPrice < floor) {
          const rounding = (rules.find((r) => r.id === c.ruleApplied)?.rounding) ?? 'cent';
          c.newPrice = roundUp(floor, rounding);
          c.coherenceAdjusted = true;
          c.marginPct = c.cost > 0 ? (c.newPrice - c.cost) / c.cost : 0;
        }
        floor = c.newPrice * gap;
      }
    }
  }

  // 3. Marge faible + prix barré (depuis le prix de vente FINAL, post-cohérence).
  for (const c of computations) {
    c.lowMargin = c.marginPct < LOW_MARGIN_THRESHOLD;
    const r = c.ruleApplied ? rules.find((x) => x.id === c.ruleApplied) ?? null : null;
    c.compareAtPrice = r ? computeStrikePrice(c.newPrice, r) : null;
  }
  return computations;
}
