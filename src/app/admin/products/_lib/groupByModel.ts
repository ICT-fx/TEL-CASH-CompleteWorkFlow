import { normalizeGradeLetter } from '@/lib/products';
import { colorLabelFr } from '@/lib/colors';

// Stock alert thresholds — applied at the model-group level (totalStock across variants).
// Keep these centralized so we can tune them without hunting through render code.
export const STOCK_THRESHOLD_CRITICAL = 3;  // <= → red
export const STOCK_THRESHOLD_WARNING = 10;  // <= → orange ; above → green

// Per-variant alert thresholds (used for risk flags per grade / color)
const VARIANT_LOW_STOCK = 2;

export type StockLevel = 'empty' | 'critical' | 'warning' | 'ok';

export function getStockLevel(total: number): StockLevel {
  if (total <= 0) return 'empty';
  if (total <= STOCK_THRESHOLD_CRITICAL) return 'critical';
  if (total <= STOCK_THRESHOLD_WARNING) return 'warning';
  return 'ok';
}

// Minimal shape we need from a Supabase products row. Keep it permissive — the
// admin table accepts any extra fields without complaint.
export interface AdminProduct {
  id: string;
  brand: string | null;
  model: string | null;
  storage_capacity?: string | null;
  color?: string | null;
  grade?: string | null;
  price: number | string;
  cost_price?: number | string | null;
  compare_at_price?: number | string | null;
  stock: number;
  is_active: boolean;
  images?: string[] | null;
  sku?: string | null;
  source?: 'manual' | 'fluxitron' | null;
  // Anything else the row may carry — we forward it untouched in `variants`.
  [extra: string]: unknown;
}

export interface ModelGroup {
  key: string;                    // unique React key — brand|model|storage[|grade]
  brand: string;
  model: string;
  storage: string;                // display label, may be "Sans stockage spécifié"
  gradeLetter?: 'A' | 'B' | 'C'; // set when byGrade=true (phone tabs)
  variants: AdminProduct[];       // SKUs in the group
  variantCount: number;
  colorCount: number;             // distinct non-empty colors across variants
  totalStock: number;
  activeCount: number;
  minPrice: number;               // computed over active variants only
  maxPrice: number;
  marginPct: number | null;       // marge moyenne sur variantes actives : (ΣPV−Σcoût)/Σcoût
  marginEuroAvg: number | null;   // marge € moyenne par variante active
  gradeBreakdown: Record<string, number>;  // { A: stockA, B: stockB, ... }
  colorBreakdown: Record<string, number>;  // { Bleu: stockBleu, ... }
  riskFlags: string[];            // human-readable alerts ("Grade A : rupture", "Vert : 1 restant")
  representativeImage: string | null;
  representativeSource: 'manual' | 'fluxitron';
}

const STORAGE_PLACEHOLDER = 'Sans stockage spécifié';

// Grades allowed in byGrade mode (phone tabs) — A+/B+/C+/D/E are excluded.
const PHONE_GRADES = new Set<string>(['A', 'B', 'C']);

function makeKey(brand: string, model: string, storage: string, grade?: string): string {
  const base = [brand, model, storage].join('|').toLowerCase();
  return grade ? `${base}|${grade.toLowerCase()}` : base;
}

export function groupProductsByModel(products: AdminProduct[], byGrade = false): ModelGroup[] {
  // 1. Bucket variants by their grouping key.
  //    byGrade=true  → (brand, model, storage, gradeLetter) — only A/B/C kept
  //    byGrade=false → (brand, model, storage)              — all variants kept
  const buckets = new Map<string, AdminProduct[]>();

  for (const p of products) {
    if (!p.brand || !p.model) {
      console.warn('[groupByModel] Skipping SKU without brand/model:', p.id);
      continue;
    }

    const brand = p.brand.trim();
    const model = p.model.trim();
    const rawStorage = (p.storage_capacity || '').trim();
    const storage = rawStorage || STORAGE_PLACEHOLDER;

    if (byGrade) {
      const gradeLetter = normalizeGradeLetter(p.grade);
      // Exclude anything that is not a plain A, B, or C (no +, no D/E, no null).
      if (!gradeLetter || !PHONE_GRADES.has(gradeLetter)) continue;
      const key = makeKey(brand, model, storage, gradeLetter);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.push(p);
      } else {
        buckets.set(key, [p]);
      }
    } else {
      const key = makeKey(brand, model, storage);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.push(p);
      } else {
        buckets.set(key, [p]);
      }
    }
  }

  // 2. Build each group's aggregates
  const groups: ModelGroup[] = [];

  buckets.forEach((variants, key) => {
    const first = variants[0];
    const brand = (first.brand || '').trim();
    const model = (first.model || '').trim();
    const storage = (first.storage_capacity || '').trim() || STORAGE_PLACEHOLDER;
    // In byGrade mode the group key ends with the grade letter — extract it.
    const gradeLetter: 'A' | 'B' | 'C' | undefined = byGrade
      ? (normalizeGradeLetter(first.grade) as 'A' | 'B' | 'C' | null) ?? undefined
      : undefined;

    let totalStock = 0;
    let activeCount = 0;
    const activePrices: number[] = [];
    let sumPrice = 0, sumCost = 0, marginCount = 0; // marge sur variantes actives avec coût
    const gradeBreakdown: Record<string, number> = {};
    const colorBreakdown: Record<string, number> = {};
    let representativeImage: string | null = null;
    let hasFluxitron = false;

    for (const v of variants) {
      const stock = Number.isFinite(v.stock as number) ? Number(v.stock) : 0;
      totalStock += stock;
      if (v.is_active) {
        activeCount++;
        const priceNum = typeof v.price === 'string' ? parseFloat(v.price) : v.price;
        if (Number.isFinite(priceNum)) activePrices.push(priceNum as number);
        const costNum = typeof v.cost_price === 'string' ? parseFloat(v.cost_price) : (v.cost_price as number | null | undefined);
        if (Number.isFinite(priceNum) && Number.isFinite(costNum) && (costNum as number) > 0) {
          sumPrice += priceNum as number;
          sumCost += costNum as number;
          marginCount++;
        }
      }

      // Grade bucket — normalize to A/B/C so legacy FR-labelled rows
      // ("Très Bon État" / "Parfait État" / "État Correct") aggregate together
      // and the riskFlag messages read "Grade B" not "Grade Très Bon État".
      const grade = normalizeGradeLetter(v.grade);
      if (grade) gradeBreakdown[grade] = (gradeBreakdown[grade] || 0) + stock;

      const color = (v.color || '').trim();
      if (color) colorBreakdown[color] = (colorBreakdown[color] || 0) + stock;

      if (!representativeImage && Array.isArray(v.images)) {
        const firstImg = v.images.find((img) => typeof img === 'string' && img.length > 0);
        if (firstImg) representativeImage = firstImg;
      }

      if (v.source === 'fluxitron') hasFluxitron = true;
    }

    // Risk flags: per grade and per color, surface ruptures and very low stock.
    const riskFlags: string[] = [];
    for (const [grade, qty] of Object.entries(gradeBreakdown)) {
      if (qty === 0) riskFlags.push(`Grade ${grade} : rupture`);
      else if (qty <= VARIANT_LOW_STOCK) riskFlags.push(`Grade ${grade} : ${qty} restant${qty > 1 ? 's' : ''}`);
    }
    for (const [color, qty] of Object.entries(colorBreakdown)) {
      const colorFr = colorLabelFr(color);
      if (qty === 0) riskFlags.push(`${colorFr} : rupture`);
      else if (qty <= VARIANT_LOW_STOCK) riskFlags.push(`${colorFr} : ${qty} restant${qty > 1 ? 's' : ''}`);
    }

    // Count distinct non-empty colors across all variants in the group.
    const colorCount = Object.keys(colorBreakdown).length;

    groups.push({
      key,
      brand,
      model,
      storage,
      gradeLetter,
      variants,
      variantCount: variants.length,
      colorCount,
      totalStock,
      activeCount,
      minPrice: activePrices.length > 0 ? Math.min(...activePrices) : 0,
      maxPrice: activePrices.length > 0 ? Math.max(...activePrices) : 0,
      marginPct: sumCost > 0 ? (sumPrice - sumCost) / sumCost : null,
      marginEuroAvg: marginCount > 0 ? (sumPrice - sumCost) / marginCount : null,
      gradeBreakdown,
      colorBreakdown,
      riskFlags,
      representativeImage,
      representativeSource: hasFluxitron ? 'fluxitron' : 'manual',
    });
  });

  return groups;
}

// Available sort options for the grouped view.
export type GroupSortKey = 'name-asc' | 'stock-asc' | 'stock-desc' | 'price-asc';

export function sortModelGroups(groups: ModelGroup[], sortKey: GroupSortKey): ModelGroup[] {
  const sorted = [...groups];
  switch (sortKey) {
    case 'stock-asc':
      sorted.sort((a, b) => a.totalStock - b.totalStock);
      break;
    case 'stock-desc':
      sorted.sort((a, b) => b.totalStock - a.totalStock);
      break;
    case 'price-asc':
      sorted.sort((a, b) => a.minPrice - b.minPrice);
      break;
    case 'name-asc':
    default:
      sorted.sort((a, b) => {
        const aLabel = `${a.brand} ${a.model} ${a.storage}`;
        const bLabel = `${b.brand} ${b.model} ${b.storage}`;
        return aLabel.localeCompare(bLabel, 'fr');
      });
  }
  return sorted;
}
