import { normalizeGradeLetter } from '@/lib/products';

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
  key: string;                    // unique React key — brand|model|storage
  brand: string;
  model: string;
  storage: string;                // display label, may be "Sans stockage spécifié"
  variants: AdminProduct[];       // SKUs in the group
  variantCount: number;
  totalStock: number;
  activeCount: number;
  minPrice: number;               // computed over active variants only
  maxPrice: number;
  gradeBreakdown: Record<string, number>;  // { A: stockA, B: stockB, ... }
  colorBreakdown: Record<string, number>;  // { Bleu: stockBleu, ... }
  riskFlags: string[];            // human-readable alerts ("Grade A : rupture", "Vert : 1 restant")
  representativeImage: string | null;
  representativeSource: 'manual' | 'fluxitron';
}

const STORAGE_PLACEHOLDER = 'Sans stockage spécifié';

function makeKey(brand: string, model: string, storage: string): string {
  return [brand, model, storage].join('|').toLowerCase();
}

export function groupProductsByModel(products: AdminProduct[]): ModelGroup[] {
  // 1. Bucket variants by their (brand, model, storage) tuple
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

    const key = makeKey(brand, model, storage);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(p);
    } else {
      buckets.set(key, [p]);
    }
  }

  // 2. Build each group's aggregates
  const groups: ModelGroup[] = [];

  buckets.forEach((variants, key) => {
    const first = variants[0];
    const brand = (first.brand || '').trim();
    const model = (first.model || '').trim();
    const storage = (first.storage_capacity || '').trim() || STORAGE_PLACEHOLDER;

    let totalStock = 0;
    let activeCount = 0;
    const activePrices: number[] = [];
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
      if (qty === 0) riskFlags.push(`${color} : rupture`);
      else if (qty <= VARIANT_LOW_STOCK) riskFlags.push(`${color} : ${qty} restant${qty > 1 ? 's' : ''}`);
    }

    groups.push({
      key,
      brand,
      model,
      storage,
      variants,
      variantCount: variants.length,
      totalStock,
      activeCount,
      minPrice: activePrices.length > 0 ? Math.min(...activePrices) : 0,
      maxPrice: activePrices.length > 0 ? Math.max(...activePrices) : 0,
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
