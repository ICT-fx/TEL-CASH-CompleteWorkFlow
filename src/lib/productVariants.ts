// Pure logic for the customer-facing model/variant abstraction.
//
// Vocabulaire :
//   Model   = (brand, model) — ex. "Apple iPhone 11"
//   Variant = (storage, grade, color) — peut mapper sur N SKUs en base
//   SKU     = une ligne `products` (téléphone physique avec IMEI)
//
// Aucune dépendance React — toute la logique reste testable.

import { displayGrade, modelSlug, DISPLAY_GRADE_ORDER, type DisplayGrade } from './products';

// Normalise une capacité de stockage brute vers un libellé client cohérent :
//   "128 GO" / "128go" / "128 GB" / "128"  → "128 Go"
//   "1024" / "1 TO" / "1tb" / "1 to"        → "1 To"
// Renvoie null si aucune capacité exploitable (champ vide → pas de sélecteur,
// plutôt qu'un onglet « — » cassé, cf. bug iPhone 17 Pro « STOCKAGE — »).
export function normalizeStorage(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === '—') return null;
  const m = s.match(/(\d{1,4})\s*(to|tb|go|gb)?/i);
  if (!m) return null;
  let gb = parseInt(m[1], 10);
  const unit = (m[2] || '').toLowerCase();
  if (unit === 'to' || unit === 'tb') gb = gb * 1024; // To/TB → repasse en Go pour le calcul
  if (!Number.isFinite(gb) || gb <= 0) return null;
  if (gb >= 1024 && gb % 1024 === 0) return `${gb / 1024} To`;
  return `${gb} Go`;
}

export interface RawProduct {
  id: string;
  brand: string | null;
  model: string | null;
  storage_capacity?: string | null;
  color?: string | null;
  grade?: string | null;
  price: number | string;
  stock: number;
  is_active: boolean;
  images?: string[] | null;
  [extra: string]: unknown;
}

export interface FrontModel {
  brand: string;
  model: string;
  slug: string;                      // URL-safe key
  representativeImage: string | null;
  representativeColor: string | null; // couleur du SKU mis en avant (= défaut fiche)
  minPrice: number;                  // across active SKUs
  maxPrice: number;
  totalStock: number;                // sum across all SKUs of the model
  variantCount: number;              // unique (storage, grade, color) tuples
  skuCount: number;                  // raw SKU count
  firstAvailableSkuId: string;       // SKU to deep-link to from the catalog card
}

export interface FrontVariant {
  storage: string;
  grade: string;                     // GradeLetter ('A+'|'A'|'B+'|'B'|'C+'|'C') ou brut si normalisation échoue
  color: string;
  stock: number;                     // sum across matching SKUs
  price: number;                     // cheapest active SKU
  skuId: string;                     // the SKU we'll send to the cart
  available: boolean;                // stock > 0
  allMatchingSkuIds: string[];       // every SKU that maps to this variant
  representativeImage: string | null;
}

export interface VariantMatrix {
  variants: FrontVariant[];
  availableStorages: string[];
  availableGrades: string[];
  availableColors: string[];
}

export type VariantAxis = 'storage' | 'grade' | 'color';

const STORAGE_PLACEHOLDER = '—';

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function firstImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  for (const img of images) {
    if (typeof img === 'string' && img.length > 0) return img;
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Catalog: group active SKUs by (brand, model)
// ──────────────────────────────────────────────────────────────────────────────
export function groupSkusByModel(products: RawProduct[]): FrontModel[] {
  const buckets = new Map<string, RawProduct[]>();

  for (const p of products) {
    if (!p.brand || !p.model) continue;
    const key = `${p.brand.trim().toLowerCase()}|${p.model.trim().toLowerCase()}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(p);
    else buckets.set(key, [p]);
  }

  const models: FrontModel[] = [];

  buckets.forEach((skus) => {
    const first = skus[0];
    const brand = (first.brand || '').trim();
    const model = (first.model || '').trim();

    const activeSkus = skus.filter((s) => s.is_active);
    // Prix « à partir de » sur le prix de vente COHÉRENT (A ≥ B ≥ C), pas le brut.
    const coherent = computeCoherentPrices(activeSkus);
    const prices = coherent.size > 0
      ? [...coherent.values()]
      : activeSkus.map((s) => asNumber(s.price)).filter((p) => p > 0);

    let totalStock = 0;
    const variantKeys = new Set<string>();

    for (const s of skus) {
      totalStock += asNumber(s.stock);
      const storage = normalizeStorage(s.storage_capacity) || STORAGE_PLACEHOLDER;
      const grade = displayGrade(s.grade) || STORAGE_PLACEHOLDER;
      const color = (s.color || STORAGE_PLACEHOLDER).trim() || STORAGE_PLACEHOLDER;
      variantKeys.add(`${storage}|${grade}|${color}`);
    }

    // SKU mis en avant : in-stock actif en priorité, sinon le 1er. C'est CE SKU
    // que la carte deep-link ET dont la couleur sert d'image (= défaut fiche),
    // pour que le listing et la fiche affichent la MÊME photo.
    const featured = activeSkus.find((s) => asNumber(s.stock) > 0) ?? skus[0];
    const firstAvailableSkuId = featured.id;
    const representativeColor = (featured.color || '').trim() || null;
    const representativeImage = firstImage(featured.images) ?? firstImage(skus.find((s) => firstImage(s.images))?.images);

    models.push({
      brand,
      model,
      slug: modelSlug(brand, model),
      representativeImage,
      representativeColor,
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      totalStock,
      variantCount: variantKeys.size,
      skuCount: skus.length,
      firstAvailableSkuId,
    });
  });

  return models;
}

// ──────────────────────────────────────────────────────────────────────────────
// Cohérence du PRIX DE VENTE (Grade A ≥ Grade B ≥ Grade C)
// ──────────────────────────────────────────────────────────────────────────────
// La source Foxway price parfois un grade SUPÉRIEUR moins cher qu'un grade
// inférieur (ex. un A+ « comme neuf » à 670 € alors que des B sont à 790 €). Pour
// le client, on garantit l'ordre A ≥ B ≥ C, par (modèle, couleur, stockage), en
// REMONTANT le prix du grade supérieur UNIQUEMENT quand l'ordre est violé. Calcul
// sur le prix de vente — l'ingestion Foxway n'est pas touchée. Le même prix sert
// à l'affichage ET au paiement (cf. computeCoherentPrices / coherentSkuPrice).
function coherenceBump(lower: number): number {
  // « un peu au-dessus » : +4 % (au moins 10 €), arrondi au multiple de 5 sup.
  return Math.ceil((lower + Math.max(10, Math.round(lower * 0.04))) / 5) * 5;
}

// Table `storage|grade|color` → prix de vente cohérent (contient TOUTES les
// variantes ; le prix = brut quand l'ordre est déjà respecté).
export function computeCoherentPrices(products: RawProduct[]): Map<string, number> {
  // 1) prix MINI brut par (storage, color, displayGrade)
  const cheapest = new Map<string, number>();
  for (const s of products) {
    if (!s.is_active) continue;
    const g = displayGrade(s.grade);
    if (!g) continue;
    const price = asNumber(s.price, Infinity);
    if (!Number.isFinite(price) || price <= 0) continue;
    const storage = normalizeStorage(s.storage_capacity) || STORAGE_PLACEHOLDER;
    const color = (s.color || STORAGE_PLACEHOLDER).trim() || STORAGE_PLACEHOLDER;
    const k = `${storage}|${color}|${g}`;
    const cur = cheapest.get(k);
    if (cur == null || price < cur) cheapest.set(k, price);
  }
  // 2) regroupe par (storage, color) puis impose C ≤ B ≤ A
  const groups = new Map<string, Partial<Record<DisplayGrade, number>>>();
  for (const [k, price] of cheapest) {
    const [storage, color, g] = k.split('|');
    const gk = `${storage}|${color}`;
    const grp = groups.get(gk) || {};
    grp[g as DisplayGrade] = price;
    groups.set(gk, grp);
  }
  const out = new Map<string, number>();
  for (const [gk, grp] of groups) {
    const [storage, color] = gk.split('|');
    const cohC = grp.C;
    let cohB = grp.B;
    let cohA = grp.A;
    if (cohB != null && cohC != null && cohB <= cohC) cohB = coherenceBump(cohC);
    const lowerForA = cohB != null ? cohB : cohC;
    if (cohA != null && lowerForA != null && cohA <= lowerForA) cohA = coherenceBump(lowerForA);
    if (cohC != null) out.set(`${storage}|C|${color}`, cohC);
    if (cohB != null) out.set(`${storage}|B|${color}`, cohB);
    if (cohA != null) out.set(`${storage}|A|${color}`, cohA);
  }
  return out;
}

// Prix de vente cohérent d'un SKU précis (checkout). Renvoie le prix ajusté si la
// variante est concernée, sinon le prix brut du SKU.
export function coherentSkuPrice(siblings: RawProduct[], sku: RawProduct): number {
  const raw = asNumber(sku.price, 0);
  const g = displayGrade(sku.grade);
  if (!g) return raw;
  const storage = normalizeStorage(sku.storage_capacity) || STORAGE_PLACEHOLDER;
  const color = (sku.color || STORAGE_PLACEHOLDER).trim() || STORAGE_PLACEHOLDER;
  const coh = computeCoherentPrices(siblings).get(`${storage}|${g}|${color}`);
  return coh != null ? coh : raw;
}

// ──────────────────────────────────────────────────────────────────────────────
// Detail page: build a variant matrix from the SKUs of a single model
// ──────────────────────────────────────────────────────────────────────────────
export function buildVariantMatrix(products: RawProduct[]): VariantMatrix {
  // Only active SKUs are considered for the matrix — inactive ones are
  // intentionally hidden from customers (admin gate via is_active).
  const skus = products.filter((p) => p.is_active);

  const variantBuckets = new Map<string, RawProduct[]>();
  for (const s of skus) {
    const storage = normalizeStorage(s.storage_capacity) || STORAGE_PLACEHOLDER;
    const grade = displayGrade(s.grade) || STORAGE_PLACEHOLDER;
    const color = (s.color || STORAGE_PLACEHOLDER).trim() || STORAGE_PLACEHOLDER;
    const key = `${storage}|${grade}|${color}`;
    const bucket = variantBuckets.get(key);
    if (bucket) bucket.push(s);
    else variantBuckets.set(key, [s]);
  }

  const variants: FrontVariant[] = [];

  variantBuckets.forEach((bucket, key) => {
    const [storage, grade, color] = key.split('|');

    // Pick the cheapest active SKU as the "primary" for this variant.
    let cheapest = bucket[0];
    let cheapestPrice = asNumber(cheapest.price, Infinity);
    let totalStock = 0;
    let representativeImage: string | null = null;

    for (const s of bucket) {
      const price = asNumber(s.price, Infinity);
      if (price < cheapestPrice) {
        cheapest = s;
        cheapestPrice = price;
      }
      totalStock += asNumber(s.stock);
      if (!representativeImage) representativeImage = firstImage(s.images);
    }

    variants.push({
      storage,
      grade,
      color,
      stock: totalStock,
      price: cheapestPrice === Infinity ? 0 : cheapestPrice,
      skuId: cheapest.id,
      available: totalStock > 0,
      allMatchingSkuIds: bucket.map((s) => s.id),
      representativeImage,
    });
  });

  // Cohérence prix : on remplace le prix brut par le prix de vente cohérent
  // (A ≥ B ≥ C) — même valeur qu'au checkout (coherentSkuPrice).
  const coherent = computeCoherentPrices(skus);
  for (const v of variants) {
    const p = coherent.get(`${v.storage}|${v.grade}|${v.color}`);
    if (p != null) v.price = p;
  }

  // Stable, predictable axis order (meilleur → pire selon les 3 grades client)
  const gradeRank = (g: string) => {
    const i = DISPLAY_GRADE_ORDER.indexOf(g as (typeof DISPLAY_GRADE_ORDER)[number]);
    return i === -1 ? 99 : i;
  };
  const storageRank = (s: string) => {
    // Order by parsed GB if possible, else alphabetical
    const m = s.match(/(\d{2,4})/);
    return m ? parseInt(m[1]) : 9999;
  };

  const availableStorages = Array.from(new Set(variants.map((v) => v.storage))).sort(
    (a, b) => storageRank(a) - storageRank(b)
  );
  const availableGrades = Array.from(new Set(variants.map((v) => v.grade))).sort(
    (a, b) => gradeRank(a) - gradeRank(b)
  );
  const availableColors = Array.from(new Set(variants.map((v) => v.color))).sort((a, b) =>
    a.localeCompare(b, 'fr')
  );

  return { variants, availableStorages, availableGrades, availableColors };
}

// ──────────────────────────────────────────────────────────────────────────────
// Selector helpers
// ──────────────────────────────────────────────────────────────────────────────

// Three-level availability for a candidate option in the current selection
// context. The UI grays out levels differently so the customer understands
// what's possible vs what's not vs what's a stock-out.
//   'available'    → at least one in-stock variant honoring all locked axes
//   'out_of_stock' → variant exists but every matching SKU has stock = 0
//   'incompatible' → no variant exists with this option + locked axes at all
export type OptionAvailability = 'available' | 'out_of_stock' | 'incompatible';

export function getOptionAvailability(
  matrix: VariantMatrix,
  candidateValue: string,
  axis: VariantAxis,
  selectedStorage: string | null,
  selectedGrade: string | null,
  selectedColor: string | null
): OptionAvailability {
  const matching = matrix.variants.filter((v) => {
    if (v[axis] !== candidateValue) return false;
    if (axis !== 'storage' && selectedStorage && v.storage !== selectedStorage) return false;
    if (axis !== 'grade' && selectedGrade && v.grade !== selectedGrade) return false;
    if (axis !== 'color' && selectedColor && v.color !== selectedColor) return false;
    return true;
  });
  if (matching.length === 0) return 'incompatible';
  return matching.some((v) => v.stock > 0) ? 'available' : 'out_of_stock';
}

// Back-compat boolean wrapper — true when the variant exists at all,
// regardless of stock. Kept for places that don't need stock granularity.
export function isVariantSelectable(
  matrix: VariantMatrix,
  candidateValue: string,
  axis: VariantAxis,
  selectedStorage: string | null,
  selectedGrade: string | null,
  selectedColor: string | null
): boolean {
  return getOptionAvailability(matrix, candidateValue, axis, selectedStorage, selectedGrade, selectedColor) !== 'incompatible';
}

// Find the exact variant matching the 3-tuple selection. Returns null on miss.
export function pickSkuForSelection(
  matrix: VariantMatrix,
  storage: string | null,
  grade: string | null,
  color: string | null
): { skuId: string; price: number; stock: number; image: string | null } | null {
  if (!storage || !grade || !color) return null;
  const match = matrix.variants.find(
    (v) => v.storage === storage && v.grade === grade && v.color === color
  );
  if (!match) return null;
  return { skuId: match.skuId, price: match.price, stock: match.stock, image: match.representativeImage };
}

// ──────────────────────────────────────────────────────────────────────────────
// pickInitialSelection — choose a stock-aware default for the URL SKU.
// ──────────────────────────────────────────────────────────────────────────────
// Priority :
//   1. If the URL SKU's exact (storage, grade, color) has stock > 0 → keep it.
//   2. Otherwise scan the matrix and prefer in-stock variants that share
//      the most axes with the URL SKU (2 axes shared > 1 > 0).
//   3. If no variant has stock at all in the whole matrix → keep the URL SKU's
//      tuple so the UI can clearly say "Rupture" rather than silently moving
//      the customer to a different combination.
export function pickInitialSelection(
  matrix: VariantMatrix,
  initialSku: { storage?: string | null; grade?: string | null; color?: string | null }
): { storage: string | null; grade: string | null; color: string | null } {
  const wantedStorage = (initialSku.storage || '').trim() || null;
  const wantedGrade = (initialSku.grade || '').trim() || null;
  const wantedColor = (initialSku.color || '').trim() || null;

  // 1. Exact match with stock?
  const exact = matrix.variants.find(
    (v) =>
      v.storage === wantedStorage &&
      v.grade === wantedGrade &&
      v.color === wantedColor &&
      v.stock > 0
  );
  if (exact) return { storage: exact.storage, grade: exact.grade, color: exact.color };

  // 2. Score every in-stock variant by axes shared with the URL SKU.
  const inStock = matrix.variants.filter((v) => v.stock > 0);
  if (inStock.length > 0) {
    const score = (v: FrontVariant): number =>
      (v.storage === wantedStorage ? 1 : 0) +
      (v.grade === wantedGrade ? 1 : 0) +
      (v.color === wantedColor ? 1 : 0);

    // Sort by score desc, then by price asc (cheapest among the most similar)
    const best = inStock
      .map((v) => ({ v, s: score(v) }))
      .sort((a, b) => b.s - a.s || a.v.price - b.v.price)[0].v;
    return { storage: best.storage, grade: best.grade, color: best.color };
  }

  // 3. Nothing in stock — keep the URL SKU's tuple (or first variant) so the
  //    "Rupture" badge surfaces clearly.
  const fallback = matrix.variants[0];
  return {
    storage: wantedStorage ?? fallback?.storage ?? null,
    grade: wantedGrade ?? fallback?.grade ?? null,
    color: wantedColor ?? fallback?.color ?? null,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// reconcileSelection — stock-aware axis change.
// ──────────────────────────────────────────────────────────────────────────────
// Called when the user clicks a new value on `axis`. Tries to keep the click
// "honest" by landing on a combination that actually has stock, but falls
// back to a same-combination-as-asked result when no in-stock option fits.
//
// Strategy (axis = the one the user just clicked, value = the new value) :
//   1. Try (axis=value, other axes kept) with stock > 0
//   2. Try (axis=value, one other axis kept, third varying) with stock > 0
//       — preserve the axis that was most recently touched first
//   3. Try (axis=value) with any in-stock combination (cheapest wins)
//   4. Try (axis=value, other axes kept) WITHOUT stock filter (accept rupture)
//   5. Try (axis=value) with any combination (any variant, cheapest)
//   6. Return null if even `axis=value` doesn't exist in the matrix
export function reconcileSelection(
  matrix: VariantMatrix,
  axis: VariantAxis,
  candidateValue: string,
  current: { storage: string | null; grade: string | null; color: string | null }
): { storage: string; grade: string; color: string } | null {
  const cheapest = (arr: FrontVariant[]): FrontVariant =>
    arr.reduce((a, b) => (a.price <= b.price ? a : b));

  const sameAxisOnly = matrix.variants.filter((v) => v[axis] === candidateValue);
  if (sameAxisOnly.length === 0) return null;

  // Filter helpers for the OTHER two axes
  const matchesOther = (v: FrontVariant, lockedAxes: VariantAxis[]) =>
    lockedAxes.every((a) => {
      if (a === axis) return true;                 // not constraining the clicked axis
      const v_value = v[a];
      const cur =
        a === 'storage' ? current.storage : a === 'grade' ? current.grade : current.color;
      return !cur || v_value === cur;
    });

  const otherAxes: VariantAxis[] = (['storage', 'grade', 'color'] as const).filter((a) => a !== axis);

  // Step 1 : full lock on the other 2 axes + stock > 0
  const step1 = sameAxisOnly.filter(
    (v) => v.stock > 0 && matchesOther(v, otherAxes)
  );
  if (step1.length > 0) {
    const c = cheapest(step1);
    return { storage: c.storage, grade: c.grade, color: c.color };
  }

  // Step 2 : lock ONE of the other axes + stock > 0 (try each individually)
  for (const lockOne of otherAxes) {
    const step2 = sameAxisOnly.filter(
      (v) => v.stock > 0 && matchesOther(v, [lockOne])
    );
    if (step2.length > 0) {
      const c = cheapest(step2);
      return { storage: c.storage, grade: c.grade, color: c.color };
    }
  }

  // Step 3 : any in-stock variant honoring just the clicked axis (cheapest wins)
  const step3 = sameAxisOnly.filter((v) => v.stock > 0);
  if (step3.length > 0) {
    const c = cheapest(step3);
    return { storage: c.storage, grade: c.grade, color: c.color };
  }

  // Step 4 : nothing in stock — try to preserve the other 2 axes anyway
  const step4 = sameAxisOnly.filter((v) => matchesOther(v, otherAxes));
  if (step4.length > 0) {
    const c = cheapest(step4);
    return { storage: c.storage, grade: c.grade, color: c.color };
  }

  // Step 5 : fallback to the cheapest variant with the requested axis
  const c = cheapest(sameAxisOnly);
  return { storage: c.storage, grade: c.grade, color: c.color };
}
