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
