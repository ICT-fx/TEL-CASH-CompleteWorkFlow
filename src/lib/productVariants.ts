// Pure logic for the customer-facing model/variant abstraction.
//
// Vocabulaire :
//   Model   = (brand, model) — ex. "Apple iPhone 11"
//   Variant = (storage, grade, color) — peut mapper sur N SKUs en base
//   SKU     = une ligne `products` (téléphone physique avec IMEI)
//
// Aucune dépendance React — toute la logique reste testable.

import { displayGrade, modelSlug, DISPLAY_GRADE_ORDER } from './products';
import type { ProductSpecs } from './productSpecs';

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
  compare_at_price?: number | string | null;
  stock: number;
  is_active: boolean;
  images?: string[] | null;
  warranty?: string | null;
  specs?: ProductSpecs | null;
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
  minPriceCompareAt: number | null;  // prix barré du SKU le moins cher (si > prix)
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
    // Prix « à partir de » = prix STOCKÉ brut des SKU actifs (prix manuels).
    // Plus de cohérence runtime : products.price est la source de vérité.
    const prices = activeSkus.map((s) => asNumber(s.price)).filter((p) => p > 0);

    // SKU vitrine = le moins cher PARMI CEUX QUI ONT UN PRIX (>0). Une variante
    // à 0 € (prix non défini) n'est pas vendable : elle ne doit jamais servir de
    // prix barré ni de lien depuis la carte.
    const pricedActive = activeSkus.filter((s) => asNumber(s.price) > 0);
    const cheapestPricedSku = pricedActive.length
      ? pricedActive.reduce((a, b) => (asNumber(a.price) <= asNumber(b.price) ? a : b))
      : null;

    // Prix barré « vitrine » : celui du SKU vendable le moins cher, uniquement
    // s'il est strictement supérieur à ce prix.
    let minPriceCompareAt: number | null = null;
    if (cheapestPricedSku) {
      const cap = cheapestPricedSku.compare_at_price != null ? asNumber(cheapestPricedSku.compare_at_price) : 0;
      const pr = asNumber(cheapestPricedSku.price);
      minPriceCompareAt = cap > pr ? cap : null;
    }

    let totalStock = 0;
    const variantKeys = new Set<string>();

    for (const s of skus) {
      totalStock += asNumber(s.stock);
      const storage = normalizeStorage(s.storage_capacity) || STORAGE_PLACEHOLDER;
      const grade = displayGrade(s.grade) || STORAGE_PLACEHOLDER;
      const color = (s.color || STORAGE_PLACEHOLDER).trim() || STORAGE_PLACEHOLDER;
      variantKeys.add(`${storage}|${grade}|${color}`);
    }

    // SKU mis en avant = le moins cher VENDABLE (prix > 0). C'est CE SKU que la
    // carte deep-link ET dont la couleur sert d'image (= défaut fiche). Fallback
    // sur un SKU actif puis n'importe lequel, pour que la carte reste cliquable
    // même si le modèle n'a (temporairement) aucun prix.
    const featured = cheapestPricedSku ?? (activeSkus[0] ?? skus[0]);
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
      minPriceCompareAt,
      totalStock,
      variantCount: variantKeys.size,
      skuCount: skus.length,
      firstAvailableSkuId,
    });
  });

  return models;
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
      available: cheapestPrice !== Infinity && cheapestPrice > 0, // vendable = prix défini (>0)
      allMatchingSkuIds: bucket.map((s) => s.id),
      representativeImage,
    });
  });

  // Prix manuels : v.price = prix STOCKÉ du SKU le moins cher de la variante
  // (calculé ci-dessus). La couleur ne modifie plus le prix — après migration,
  // toutes les couleurs d'un (storage, grade) partagent le même products.price.

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

// Disponibilité d'une option candidate dans le contexte de sélection courant.
// Règle PRIX (sell-to-order, mais le prix conditionne la vente) :
//   'available'    → au moins une variante avec cette option a un PRIX (>0)
//   'out_of_stock' → la combinaison existe mais AUCUN prix défini (→ grisé,
//                    non sélectionnable ; jamais affiché « rupture de stock »)
//   'incompatible' → aucune variante n'existe avec cette option + axes fixes
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
  // Règle prix : une variante sans prix (0 ou non défini) n'est PAS vendable.
  if (matching.length === 0) return 'incompatible';
  if (!matching.some((v) => v.price > 0)) return 'out_of_stock';
  return 'available';
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
// pickInitialSelection — choisit la sélection par défaut pour le SKU de l'URL.
// ──────────────────────────────────────────────────────────────────────────────
// Sell-to-order : le stock ne filtre plus. Priorité :
//   1. Si le tuple exact (storage, grade, color) du SKU URL existe → le garder.
//   2. Sinon, la variante active qui partage le plus d'axes avec le SKU URL
//      (score 3→2→1→0), à prix égal la moins chère.
//   3. Sinon, la première variante de la matrice.
export function pickInitialSelection(
  matrix: VariantMatrix,
  initialSku: { storage?: string | null; grade?: string | null; color?: string | null }
): { storage: string | null; grade: string | null; color: string | null } {
  const wantedStorage = (initialSku.storage || '').trim() || null;
  const wantedGrade = (initialSku.grade || '').trim() || null;
  const wantedColor = (initialSku.color || '').trim() || null;

  // 1. Tuple exact trouvé ET vendable (prix > 0) ? On ne s'ouvre jamais sur une
  //    variante à 0 € (non vendable, grisée) si une variante vendable existe.
  const exact = matrix.variants.find(
    (v) =>
      v.storage === wantedStorage &&
      v.grade === wantedGrade &&
      v.color === wantedColor
  );
  if (exact && exact.price > 0) return { storage: exact.storage, grade: exact.grade, color: exact.color };

  // 2. La variante la plus similaire (axes partagés), en PRIORISANT les vendables
  //    (prix > 0), puis la moins chère en cas d'ex-æquo.
  if (matrix.variants.length > 0) {
    const priced = matrix.variants.filter((v) => v.price > 0);
    const pool = priced.length ? priced : matrix.variants;
    const score = (v: FrontVariant): number =>
      (v.storage === wantedStorage ? 1 : 0) +
      (v.grade === wantedGrade ? 1 : 0) +
      (v.color === wantedColor ? 1 : 0);

    const best = pool
      .map((v) => ({ v, s: score(v) }))
      .sort((a, b) => b.s - a.s || a.v.price - b.v.price)[0].v;
    return { storage: best.storage, grade: best.grade, color: best.color };
  }

  // 3. Matrice vide (pas de variante active).
  return { storage: wantedStorage, grade: wantedGrade, color: wantedColor };
}

// ──────────────────────────────────────────────────────────────────────────────
// reconcileSelection — changement d'axe.
// ──────────────────────────────────────────────────────────────────────────────
// Appelé quand l'utilisateur clique sur une nouvelle valeur sur `axis`.
// Cherche une combinaison qui EXISTE en PRIORISANT les variantes vendables
// (prix > 0) — on ne doit jamais retomber sur une variante à 0 € (grisée) si une
// variante vendable partage cet axe. Parmi le « pool » retenu : on préserve le
// plus d'autres axes possible (storage/grade/color courants), puis la moins chère.
export function reconcileSelection(
  matrix: VariantMatrix,
  axis: VariantAxis,
  candidateValue: string,
  current: { storage: string | null; grade: string | null; color: string | null }
): { storage: string; grade: string; color: string } | null {
  const sameAxisOnly = matrix.variants.filter((v) => v[axis] === candidateValue);
  if (sameAxisOnly.length === 0) return null;

  // Priorité aux variantes vendables (prix > 0).
  const priced = sameAxisOnly.filter((v) => v.price > 0);
  const pool = priced.length ? priced : sameAxisOnly;

  const otherAxes: VariantAxis[] = (['storage', 'grade', 'color'] as const).filter((a) => a !== axis);
  const preserved = (v: FrontVariant): number =>
    otherAxes.reduce((acc, a) => {
      const cur = a === 'storage' ? current.storage : a === 'grade' ? current.grade : current.color;
      return acc + (cur && v[a] === cur ? 1 : 0);
    }, 0);

  const best = pool
    .map((v) => ({ v, s: preserved(v) }))
    .sort((a, b) => b.s - a.s || a.v.price - b.v.price)[0].v;
  return { storage: best.storage, grade: best.grade, color: best.color };
}
