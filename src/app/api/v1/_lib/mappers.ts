/**
 * Mappers: Convert between Supabase DB format and Fluxitron API format.
 *
 * Our store has 1 product = 1 variant (no multi-variant system).
 * The variant ID equals the product ID.
 */
import { normalizeGrade, type GradeLetter } from '@/lib/products';

// ── Product Mappers ──────────────────────────────────────────────────────────

export interface SupabaseProduct {
  id: string;
  brand: string;
  model: string;
  storage_capacity?: string;
  color?: string;
  imei?: string;
  warranty?: string;
  condition_description?: string;
  grade?: string;
  battery_health?: number;
  price: number;
  compare_at_price?: number;
  stock: number;
  images: string[];
  category: string;
  category_id?: string;
  is_active: boolean;
  sku?: string;
  handle?: string;
  vendor?: string;
  product_type?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface FluxitronProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  vendor: string;
  productType: string;
  status: 'active' | 'draft' | 'archived';
  tags: string[];
  categoryId: string | null;
  images: FluxitronImage[];
  variants: FluxitronVariant[];
  metafields: FluxitronMetafield[];
  createdAt: string;
  updatedAt: string;
}

export interface FluxitronVariant {
  id: string;
  productId: string;
  title: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  inventoryQuantity: number;
  weight: number | null;
  weightUnit: string | null;
  options: Record<string, string>;
}

export interface FluxitronImage {
  id: string;
  src: string;
  position: number;
  alt: string;
}

export interface FluxitronMetafield {
  key: string;
  value: string;
  namespace: string;
  type: string;
}

/**
 * Convert a Supabase product row to Fluxitron Product format.
 */
export function toFluxitronProduct(p: SupabaseProduct): FluxitronProduct {
  const title = [p.brand, p.model, p.storage_capacity].filter(Boolean).join(' ');
  const handle = p.handle || generateHandle(title);

  // Build options from grade and color
  const options: Record<string, string> = {};
  if (p.grade) options['Grade'] = p.grade;
  if (p.color) options['Couleur'] = p.color;

  // Build variant title from options
  const variantTitle = Object.values(options).join(' / ') || 'Default';

  // Map images array (stored as string URLs in Supabase)
  const images: FluxitronImage[] = (p.images || []).map((src, idx) => ({
    id: `img_${p.id}_${idx}`,
    src,
    position: idx + 1,
    alt: `${title} - Image ${idx + 1}`,
  }));

  // Build metafields for phone-specific data
  const metafields: FluxitronMetafield[] = [];
  if (p.battery_health != null) {
    metafields.push({
      key: 'battery_health',
      value: p.battery_health.toString(),
      namespace: 'custom',
      type: 'number_integer',
    });
  }
  if (p.imei) {
    metafields.push({
      key: 'imei',
      value: p.imei,
      namespace: 'custom',
      type: 'single_line_text_field',
    });
  }
  if (p.warranty) {
    metafields.push({
      key: 'warranty',
      value: p.warranty,
      namespace: 'custom',
      type: 'single_line_text_field',
    });
  }

  return {
    id: p.id,
    title,
    handle,
    description: p.condition_description || '',
    vendor: p.vendor || p.brand,
    productType: p.product_type || mapCategoryToProductType(p.category),
    status: p.is_active ? 'active' : 'draft',
    tags: p.tags || [],
    categoryId: p.category_id || null,
    images,
    variants: [
      {
        id: p.id, // 1 product = 1 variant, same ID
        productId: p.id,
        title: variantTitle,
        sku: p.sku || generateSku(p),
        price: parseFloat(p.price.toString()),
        compareAtPrice: p.compare_at_price
          ? parseFloat(p.compare_at_price.toString())
          : null,
        inventoryQuantity: p.stock,
        weight: null,
        weightUnit: null,
        options,
      },
    ],
    metafields,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

/**
 * Convert Fluxitron create/update product request to Supabase insert data.
 */
export function fromFluxitronProductCreate(body: any): Record<string, any> {
  const data: Record<string, any> = {};

  // Mark as Fluxitron product
  data.source = 'fluxitron';

  // Raw grade collected across the cascade — analyzed once at the end so we
  // can detect C+ (which triggers product rejection) before settling on data.grade.
  let rawGrade: string | undefined;

  if (body.title) {
    // Foxway titles look like "Apple iPhone 15 Pro 128GB" — first word is the
    // brand, the rest is the model. If the model ends with a storage suffix
    // ("64GB", "128 Go", "1TB"...), strip it off into storage_capacity so the
    // model stays clean.
    const stripped = stripStorageSuffix(body.title);
    if (stripped.storage) data.storage_capacity = stripped.storage;
    const parts = stripped.title.split(' ');
    data.brand = parts[0] || '';
    data.model = parts.slice(1).join(' ') || '';
  }

  if (body.description !== undefined) data.condition_description = body.description;
  if (body.vendor !== undefined) data.vendor = body.vendor;
  if (body.productType !== undefined) {
    data.product_type = body.productType;
    // Auto-map productType to category field
    const pt = (body.productType || '').toLowerCase();
    if (pt.includes('accessoire') || pt.includes('accessory') || pt.includes('cable') || pt.includes('coque') || pt.includes('case')) {
      data.category = 'accessoires';
    } else {
      data.category = 'telephones';
    }
  }
  // Les produits Fluxitron sont actifs (publiés) par défaut afin d'être
  // directement visibles. Si Fluxitron précise explicitement un statut, on le
  // respecte ('draft' → inactif). Les grades D/E sont quand même forcés inactifs
  // plus bas dans cette fonction, peu importe ce défaut.
  if (body.status !== undefined) {
    data.is_active = body.status === 'active';
  } else {
    data.is_active = true;
  }
  if (body.tags !== undefined) data.tags = body.tags;
  // Prefix handle with 'flx-' to avoid UNIQUE conflicts with manual products
  if (body.handle !== undefined) data.handle = `flx-${body.handle}`;

  // Handle categoryIds (array) — take first one
  if (body.categoryIds && body.categoryIds.length > 0) {
    data.category_id = body.categoryIds[0];
  } else if (body.categoryId) {
    data.category_id = body.categoryId;
  }

  // Handle images — extract URLs
  if (body.images && Array.isArray(body.images)) {
    data.images = body.images.map((img: any) =>
      typeof img === 'string' ? img : img.src
    );
  }

  // Handle variant data (first variant)
  const variant = body.variants?.[0];
  if (variant) {
    // Prefix SKU with 'FLX-' to avoid UNIQUE conflicts with manual products
    if (variant.sku) data.sku = `FLX-${variant.sku}`;
    if (variant.price !== undefined) data.price = variant.price;
    if (variant.compareAtPrice !== undefined) data.compare_at_price = variant.compareAtPrice;
    if (variant.inventoryQuantity !== undefined) data.stock = variant.inventoryQuantity;
    // Le grade PAR VARIANTE est dans le title Foxway ("Grade AB / AB", "D", "E",
    // "Reduced Battery Performance / D") — dernier segment après "/". On le prend
    // EN PRIORITÉ : le metafield "appearance" plus bas est au niveau parent
    // (identique pour toutes les variantes → écraserait tout au même grade).
    const titleGrade = foxwayGradeFromTitle(variant.title);
    if (titleGrade) rawGrade = titleGrade;
    if (variant.options) {
      const opts = variant.options as Record<string, string>;
      const gradeVal = pickVariantOption(opts, 'grade');
      if (gradeVal && !rawGrade) rawGrade = gradeVal;
      const colorVal = pickVariantOption(opts, 'color');
      if (colorVal) data.color = colorVal;
      const storageVal = pickVariantOption(opts, 'storage');
      if (storageVal) data.storage_capacity = storageVal;
    }
  }

  // Handle metafields — accept grade/battery/imei/warranty/color/storage under flexible keys
  if (body.metafields && Array.isArray(body.metafields)) {
    for (const mf of body.metafields) {
      const key = (mf.key || '').toLowerCase();
      if (key === 'battery_health' || key === 'battery' || key === 'batteryhealth') {
        const parsed = parseInt(mf.value);
        if (!Number.isNaN(parsed)) data.battery_health = parsed;
      }
      if (key === 'imei' || key === 'imei1' || key === 'serial_number' || key === 'serial') {
        data.imei = mf.value;
      }
      if (key === 'warranty' || key === 'guarantee' || key === 'garantie') {
        data.warranty = mf.value;
      }
      if ((key === 'grade' || key === 'condition' || key === 'appearance' || key === 'appearance_grade') && !rawGrade) {
        rawGrade = mf.value;
      }
      if (key === 'condition_description' || key === 'description_long' || key === 'cosmetic_description') {
        data.condition_description = mf.value;
      }
      if (!data.color && (key === 'color' || key === 'couleur' || key === 'coloris' || key === 'colour' || key === 'finish' || key === 'aspect')) {
        data.color = mf.value;
      }
      if (!data.storage_capacity && (key === 'storage' || key === 'stockage' || key === 'capacity' || key === 'capacite' || key === 'capacité' || key === 'memory' || key === 'size')) {
        data.storage_capacity = mf.value;
      }
    }
  }

  // Fallback: extract color from tags / description / title.
  // detectColorFromString tries the precise <li>Colou?r: …</li> regex first
  // (description is HTML) and falls back to dictionary includes() if needed.
  if (!data.color) {
    const tagColor = detectColorFromTags(body.tags);
    if (tagColor) data.color = tagColor;
  }
  if (!data.color && body.description) {
    const descColor = detectColorFromString(body.description);
    if (descColor) data.color = descColor;
  }
  if (!data.color && body.title) {
    const titleColor = detectColorFromString(body.title);
    if (titleColor) data.color = titleColor;
  }

  // Fallback: extract storage capacity from description / tags / title.
  // detectStorageFromString tries the precise <li>Storage: …</li> regex first,
  // then falls back to a free regex on the same string.
  if (!data.storage_capacity && body.description) {
    const descStorage = detectStorageFromString(body.description);
    if (descStorage) data.storage_capacity = descStorage;
  }
  if (!data.storage_capacity) {
    const tagStorage = detectStorageFromTags(body.tags);
    if (tagStorage) data.storage_capacity = tagStorage;
  }
  if (!data.storage_capacity && body.title) {
    const titleStorage = detectStorageFromString(body.title);
    if (titleStorage) data.storage_capacity = titleStorage;
  }

  // Fallback: extract grade from tags (Foxway uses grade-a / grade-c+ tags).
  // This catches the ~25% of products where variant.options.Grade is missing.
  if (!rawGrade) {
    const tagGrade = detectGradeFromTags(body.tags);
    if (tagGrade) rawGrade = tagGrade;
  }
  // Last-resort fallback: parse the description for "Condition Grade: X" / "Cosmetic Grade: X"
  if (!rawGrade && body.description) {
    const descGrade = detectGradeFromString(body.description);
    if (descGrade) rawGrade = descGrade;
  }

  // Normalise le grade collecté. Les grades D/E (mauvais états) sont conservés
  // mais le produit est désactivé d'office — jamais publié sur la boutique.
  if (rawGrade) {
    const normalized = normalizeGrade(rawGrade);
    if (normalized) {
      data.grade = normalized;
      if (normalized === 'D' || normalized === 'E') data.is_active = false;
    }
  }

  // Règle de sécurité : un TÉLÉPHONE sans grade exploitable ne doit jamais être
  // visible en boutique — le client achèterait sans connaître l'état. On le force
  // inactif (le marchand peut le réactiver à la main après vérification). Les
  // accessoires n'ont pas de grade : ils ne sont pas concernés.
  if (data.category !== 'accessoires' && !data.grade) {
    data.is_active = false;
  }

  return data;
}

// Known color names (FR + EN) — used as fallback when color isn't in options/metafields
const KNOWN_COLORS = [
  'noir', 'black',
  'blanc', 'white',
  'gris', 'gray', 'grey', 'space gray', 'gris sidéral', 'graphite',
  'argent', 'silver',
  'or', 'gold', 'or rose', 'rose gold',
  'bleu', 'blue', 'bleu nuit', 'midnight', 'minuit', 'sierra blue', 'bleu sierra', 'pacific blue', 'bleu pacifique',
  'rouge', 'red', 'product red',
  'vert', 'green', 'vert alpin', 'alpine green',
  'jaune', 'yellow',
  'violet', 'purple', 'mauve', 'lilas',
  'rose', 'pink',
  'corail', 'coral',
  'titane', 'titanium', 'titane naturel', 'natural titanium',
  'titane noir', 'black titanium',
  'titane blanc', 'white titanium',
  'titane bleu', 'blue titanium',
];

function detectColorFromTags(tags: unknown): string | undefined {
  if (!Array.isArray(tags)) return undefined;
  for (const t of tags) {
    if (typeof t !== 'string') continue;
    const norm = t.toLowerCase().trim();
    if (KNOWN_COLORS.includes(norm)) return titleCase(t);
  }
  return undefined;
}

// Color detection:
// 1) Precise pass — look for "<li>Color: …</li>" / "<li>Colour: …</li>" in the
//    HTML description. Foxway descriptions follow this pattern reliably, so
//    matching it first avoids false positives from text like "...the cloud lock
//    removed..." or "...color-coded packaging...".
// 2) Fallback — dictionary includes() on the lowercased input (guards against
//    descriptions that drop the <li> structure or non-Foxway sources).
function detectColorFromString(s: unknown): string | undefined {
  if (typeof s !== 'string') return undefined;

  // (1) Precise <li>Colour?: …</li> regex
  const liMatch = s.match(/<li>\s*Colou?r\s*:\s*([A-Za-zÀ-ÿ\s'-]+?)\s*<\/li>/i);
  if (liMatch) {
    const raw = liMatch[1].trim();
    const norm = raw.toLowerCase();
    if (KNOWN_COLORS.includes(norm)) return titleCase(raw);
    // If the captured value isn't in our dictionary, still return it — the
    // canonical UI dictionary can be extended later. We just preserve the case.
    return titleCase(raw);
  }

  // (2) Fallback — include() on the dictionary, longest first
  const lower = s.toLowerCase();
  for (const c of [...KNOWN_COLORS].sort((a, b) => b.length - a.length)) {
    if (lower.includes(c)) return titleCase(c);
  }
  return undefined;
}

function detectStorageFromTags(tags: unknown): string | undefined {
  if (!Array.isArray(tags)) return undefined;
  for (const t of tags) {
    if (typeof t !== 'string') continue;
    const m = t.match(/^\s*(\d{2,4})\s*(go|gb|to|tb)\s*$/i);
    if (m) return formatStorage(m[1], m[2]);
  }
  return undefined;
}

// Storage detection:
// 1) Precise pass — look for "<li>Storage: 64GB</li>" in the HTML description.
// 2) Fallback — free regex on the entire string.
function detectStorageFromString(s: unknown): string | undefined {
  if (typeof s !== 'string') return undefined;

  // (1) Precise <li>Storage: …</li> regex (handles non-breaking spaces too)
  const liMatch = s.match(/<li>\s*Storage\s*:\s*(\d{2,4})[\s ]*(GB|TB|Go|To)\s*<\/li>/i);
  if (liMatch) return formatStorage(liMatch[1], liMatch[2]);

  // (2) Fallback — free regex anywhere in the string
  const m = s.match(/(\d{2,4})[\s ]*(go|gb|to|tb)\b/i);
  if (m) return formatStorage(m[1], m[2]);
  return undefined;
}

function formatStorage(num: string, unit: string): string {
  const u = unit.toUpperCase().replace('GB', 'Go').replace('TB', 'To');
  return `${num} ${u}`;
}

// Strip a trailing storage suffix off a product title.
//   "Apple iPhone 11 64GB"        → { title: "Apple iPhone 11", storage: "64 Go" }
//   "Samsung Galaxy S24 256 Go"   → { title: "Samsung Galaxy S24", storage: "256 Go" }
//   "Apple iPhone 15"             → { title: "Apple iPhone 15", storage: null }
export function stripStorageSuffix(title: string): { title: string; storage: string | null } {
  if (typeof title !== 'string') return { title: '', storage: null };
  const m = title.match(/\s+(\d{2,4})[\s ]*(GB|TB|Go|To)\s*$/i);
  if (!m) return { title: title.trim(), storage: null };
  const head = title.slice(0, m.index!).trim();
  return { title: head, storage: formatStorage(m[1], m[2]) };
}

// Foxway always emits one tag per product encoding the grade, e.g.
// "grade-a", "grade-b", "grade-c+", "grade-c". Pull it out — le «+» est
// conservé (normalizeGrade gère les 6 paliers).
export function detectGradeFromTags(tags: unknown): string | undefined {
  if (!Array.isArray(tags)) return undefined;
  for (const t of tags) {
    if (typeof t !== 'string') continue;
    const m = t.trim().toLowerCase().match(/^grade-([abc])(\+)?$/i);
    if (m) return `${m[1].toUpperCase()}${m[2] || ''}`;
  }
  return undefined;
}

// Last-resort grade extraction from the HTML description. Two formats are seen :
//   1) Foxway technique  : "<li>Condition Grade: C+</li>" / "<li>Cosmetic Grade: B</li>"
//   2) Prose marketing   : "reconditionné en Grade B", "Grade C+ avec batterie",
//                          "Grade de reconditionnement B" — pas de deux-points.
// On gère les 6 paliers (A+/A/B+/B/C+/C) ainsi que D/E (mauvais états).
export function detectGradeFromString(s: unknown): string | undefined {
  if (typeof s !== 'string') return undefined;
  // 1) Format technique Foxway, le plus fiable
  const li = s.match(/<li>\s*(?:Condition|Cosmetic|Appearance)?\s*Grade\s*:\s*([ABCDE])(\+)?\s*<\/li>/i);
  if (li) return `${li[1].toUpperCase()}${li[2] || ''}`;
  // 2) Format prose : 1ʳᵉ lettre de grade qui suit le mot « Grade » (éventuellement
  //    après « de reconditionnement »). La lettre doit être MAJUSCULE et isolée
  //    (lookahead) pour ne pas attraper le début d'un autre mot (« Grade de… »).
  const prose = s.match(/\b[Gg]rade\b(?:\s+de\s+reconditionnement)?\s*:?\s*([ABCDE])(\+)?(?![A-Za-z])/);
  if (prose) return `${prose[1].toUpperCase()}${prose[2] || ''}`;
  return undefined;
}

// ──────────────────────────────────────────────────────────────────────────────
// Backfill helper — reused by scripts/backfill-fluxitron-fields.ts
// ──────────────────────────────────────────────────────────────────────────────
//
// Given an existing DB row, infer the missing storage / color / grade / model
// from its already-stored fields (model, condition_description, tags).
// Returns ONLY the fields that should be filled in — never overwrites a value
// that is already present on the row.
//
// This is the SAME parsing logic used by `fromFluxitronProductCreate` so the
// backfill and the runtime stay in sync.
export interface FluxitronEnrichmentRow {
  brand?: string | null;
  model?: string | null;
  storage_capacity?: string | null;
  color?: string | null;
  grade?: string | null;
  condition_description?: string | null;
  tags?: string[] | null;
}

export interface FluxitronEnrichment {
  model?: string;
  storage_capacity?: string;
  color?: string;
  grade?: GradeLetter;
  /** @deprecated Le C+ n'est plus rejeté — conservé pour la compat des scripts ; jamais positionné. */
  rejectedAsCPlus?: boolean;
}

export function enrichFluxitronFromExisting(row: FluxitronEnrichmentRow): FluxitronEnrichment {
  const out: FluxitronEnrichment = {};

  // Storage + cleaned model
  // The runtime puts the storage suffix inside `model` when it failed to extract
  // it. Re-split on backfill.
  if (!row.storage_capacity) {
    const candidateTitle = `${row.brand || ''} ${row.model || ''}`.trim();
    const stripped = stripStorageSuffix(candidateTitle);
    if (stripped.storage) {
      out.storage_capacity = stripped.storage;
      // Reconstruct the cleaned model (drop the brand we prepended)
      const brand = (row.brand || '').trim();
      const cleaned = brand && stripped.title.startsWith(brand)
        ? stripped.title.slice(brand.length).trim()
        : stripped.title;
      if (cleaned && cleaned !== row.model) out.model = cleaned;
    } else if (row.condition_description) {
      const desc = detectStorageFromString(row.condition_description);
      if (desc) out.storage_capacity = desc;
    }
  } else if (row.model) {
    // Storage already set but model may still carry a leftover suffix —
    // clean the model independently.
    const candidateTitle = `${row.brand || ''} ${row.model}`.trim();
    const stripped = stripStorageSuffix(candidateTitle);
    if (stripped.storage) {
      const brand = (row.brand || '').trim();
      const cleaned = brand && stripped.title.startsWith(brand)
        ? stripped.title.slice(brand.length).trim()
        : stripped.title;
      if (cleaned && cleaned !== row.model) out.model = cleaned;
    }
  }

  // Color — try the HTML description first, then dictionary on tags
  if (!row.color) {
    if (row.condition_description) {
      const col = detectColorFromString(row.condition_description);
      if (col) out.color = col;
    }
    if (!out.color) {
      const col = detectColorFromTags(row.tags);
      if (col) out.color = col;
    }
  }

  // Grade — tags d'abord, description en dernier. On normalise vers l'un des
  // 6 paliers (A+/A/B+/B/C+/C). Ne remplit que si le grade est absent.
  if (!row.grade) {
    let rawGrade: string | undefined = detectGradeFromTags(row.tags);
    if (!rawGrade && row.condition_description) {
      rawGrade = detectGradeFromString(row.condition_description);
    }
    if (rawGrade) {
      const normalized = normalizeGrade(rawGrade);
      if (normalized) out.grade = normalized;
    }
  }

  return out;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|\s|-)([a-zà-ÿ])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

// Exposed key sets for variant.options — reused by /api/v1/products/[id]/variants
// to avoid divergence between the two ingestion paths.
export const VARIANT_OPTION_KEYS = {
  grade: ['Grade', 'grade', 'Condition', 'condition', 'AppearanceGrade', 'appearance_grade', 'Etat', 'État'],
  color: ['Couleur', 'Color', 'couleur', 'color', 'Coloris', 'coloris', 'Colour', 'colour', 'Finish', 'finish', 'Aspect', 'aspect'],
  storage: ['Stockage', 'Storage', 'Capacité', 'Capacite', 'capacity', 'storage', 'Memory', 'memory', 'Capacity', 'Size', 'size', 'Espace', 'espace'],
} as const;

export function pickVariantOption(
  opts: Record<string, string> | null | undefined,
  axis: keyof typeof VARIANT_OPTION_KEYS
): string | undefined {
  if (!opts) return undefined;
  return pickOption(opts, VARIANT_OPTION_KEYS[axis] as unknown as string[]);
}

function pickOption(opts: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    if (opts[k]) return opts[k];
  }
  return undefined;
}

// Foxway encode le grade de la variante dans son `title`, en DERNIER segment
// après les "/" :
//   "Grade AB / AB"                        → "AB"
//   "Grade BC / Engraving Removed / BC"    → "BC"
//   "Reduced Battery Performance / D"      → "D"
//   "D" / "E"                              → "D" / "E"
// On isole ce dernier segment pour éviter qu'un normalizeGrade naïf n'attrape
// une lettre parasite (le "B" de "Battery", etc.). À passer ensuite à
// normalizeGrade pour obtenir le palier canonique (AB→A, BC→B, D→C+, E→C).
export function foxwayGradeFromTitle(title: unknown): string | undefined {
  if (typeof title !== 'string') return undefined;
  const seg = title.split('/').pop()?.trim();
  return seg || undefined;
}

/**
 * Convert Fluxitron update product request to Supabase update data.
 */
export function fromFluxitronProductUpdate(body: any): Record<string, any> {
  const data: Record<string, any> = {};
  let rawGrade: string | undefined;

  if (body.title !== undefined) {
    // Same as create — strip storage suffix off title to keep model clean.
    const stripped = stripStorageSuffix(body.title);
    if (stripped.storage) data.storage_capacity = stripped.storage;
    const parts = stripped.title.split(' ');
    data.brand = parts[0] || '';
    data.model = parts.slice(1).join(' ') || '';
  }
  if (body.description !== undefined) data.condition_description = body.description;
  if (body.status !== undefined) data.is_active = body.status === 'active';
  if (body.tags !== undefined) data.tags = body.tags;

  if (body.categoryIds && body.categoryIds.length > 0) {
    data.category_id = body.categoryIds[0];
  }

  if (body.metafields && Array.isArray(body.metafields)) {
    for (const mf of body.metafields) {
      const key = (mf.key || '').toLowerCase();
      if (key === 'battery_health' || key === 'battery' || key === 'batteryhealth') {
        const parsed = parseInt(mf.value);
        if (!Number.isNaN(parsed)) data.battery_health = parsed;
      }
      if (key === 'imei' || key === 'imei1' || key === 'serial_number' || key === 'serial') data.imei = mf.value;
      if (key === 'warranty' || key === 'guarantee' || key === 'garantie') data.warranty = mf.value;
      if (key === 'condition_description' || key === 'description_long' || key === 'cosmetic_description') {
        data.condition_description = mf.value;
      }
      if ((key === 'grade' || key === 'condition' || key === 'appearance' || key === 'appearance_grade') && !rawGrade) {
        rawGrade = mf.value;
      }
    }
  }

  // Sanitize grade on updates too — flexible option keys
  const updateVariant = body.variants?.[0];
  // Grade par variante via le title Foxway — PRIORITAIRE sur le metafield
  // "appearance" (parent, uniforme) lu plus haut.
  const updTitleGrade = foxwayGradeFromTitle(updateVariant?.title);
  if (updTitleGrade) rawGrade = updTitleGrade;
  if (updateVariant?.options) {
    const opts = updateVariant.options as Record<string, string>;
    const gradeVal = pickOption(opts, ['Grade', 'grade', 'Condition', 'condition', 'AppearanceGrade', 'appearance_grade', 'Etat', 'État']);
    if (gradeVal && !rawGrade) rawGrade = gradeVal;
    const colorVal = pickOption(opts, ['Couleur', 'Color', 'couleur', 'color', 'Coloris', 'coloris', 'Colour', 'colour', 'Finish', 'finish', 'Aspect', 'aspect']);
    if (colorVal) data.color = colorVal;
    const storageVal = pickOption(opts, ['Stockage', 'Storage', 'Capacité', 'Capacite', 'capacity', 'storage', 'Memory', 'memory', 'Capacity', 'Size', 'size', 'Espace', 'espace']);
    if (storageVal) data.storage_capacity = storageVal;
  }

  // Update variant fields (price/stock/sku) — previously only handled grade from options
  if (updateVariant) {
    if (updateVariant.sku && !data.sku) data.sku = `FLX-${updateVariant.sku}`;
    if (updateVariant.price !== undefined) data.price = updateVariant.price;
    if (updateVariant.compareAtPrice !== undefined) data.compare_at_price = updateVariant.compareAtPrice;
    if (updateVariant.inventoryQuantity !== undefined) data.stock = updateVariant.inventoryQuantity;
  }

  // Fallback color / storage from tags / title / description — same as create path
  if (!data.color && body.tags) {
    const tagColor = detectColorFromTags(body.tags);
    if (tagColor) data.color = tagColor;
  }
  if (!data.color && body.description) {
    const descColor = detectColorFromString(body.description);
    if (descColor) data.color = descColor;
  }
  if (!data.color && body.title) {
    const titleColor = detectColorFromString(body.title);
    if (titleColor) data.color = titleColor;
  }
  if (!data.storage_capacity && body.description) {
    const descStorage = detectStorageFromString(body.description);
    if (descStorage) data.storage_capacity = descStorage;
  }
  if (!data.storage_capacity && body.tags) {
    const tagStorage = detectStorageFromTags(body.tags);
    if (tagStorage) data.storage_capacity = tagStorage;
  }
  if (!data.storage_capacity && body.title) {
    const titleStorage = detectStorageFromString(body.title);
    if (titleStorage) data.storage_capacity = titleStorage;
  }

  // Fallback grade from tags / description — also collect raw, analyse once
  if (!rawGrade) {
    const tagGrade = detectGradeFromTags(body.tags);
    if (tagGrade) rawGrade = tagGrade;
  }
  if (!rawGrade && body.description) {
    const descGrade = detectGradeFromString(body.description);
    if (descGrade) rawGrade = descGrade;
  }

  if (rawGrade) {
    const normalized = normalizeGrade(rawGrade);
    if (normalized) {
      data.grade = normalized;
      // D/E = mauvais états → désactivés d'office.
      if (normalized === 'D' || normalized === 'E') data.is_active = false;
    }
  }

  return data;
}

// ── Order Mappers ────────────────────────────────────────────────────────────

export interface SupabaseOrder {
  id: string;
  user_id: string;
  stripe_session_id?: string;
  stripe_payment_intent?: string;
  total_amount: number;
  status: string;
  fulfillment_status?: string;
  order_number?: string;
  shipping_method?: string;
  shipping_address?: any;
  tracking_number?: string;
  referral_code_used?: string;
  discount_amount?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  profile?: { email?: string; full_name?: string; phone?: string };
}

export interface SupabaseOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  price_at_purchase: number;
  // Snapshots frozen at purchase time — survive product deletion.
  product_name?: string | null;
  product_sku?: string | null;
  product?: {
    brand?: string;
    model?: string;
    sku?: string;
    images?: string[];
  } | null;
}

export interface FluxitronOrder {
  id: string;
  orderNumber: string;
  email: string | null;
  phone: string | null;
  financialStatus: string;
  fulfillmentStatus: string;
  currency: string;
  subtotalPrice: number;
  totalShippingPrice: number;
  totalPrice: number;
  lineItems: FluxitronLineItem[];
  shippingAddress: FluxitronAddress | null;
  billingAddress: FluxitronAddress | null;
  createdAt: string;
}

export interface FluxitronLineItem {
  id: string;
  productId: string;
  variantId: string;
  sku: string;
  title: string;
  quantity: number;
  price: number;
}

export interface FluxitronAddress {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  countryCode: string | null;
  zip: string | null;
  phone: string | null;
}

/**
 * Map Supabase order status to Fluxitron financialStatus.
 */
function mapFinancialStatus(status: string): string {
  const map: Record<string, string> = {
    pending: 'pending',
    awaiting_payment: 'pending',
    paid: 'paid',
    supplier_ordered: 'paid', // transmis au fournisseur, paiement déjà encaissé
    shipped: 'paid',
    delivered: 'paid',
    failed: 'voided',
    refunded: 'refunded',
    disputed: 'paid', // Financially still charged until resolved
    cancelled: 'voided',
  };
  return map[status] || 'pending';
}

/**
 * Convert a Supabase order + items to Fluxitron Order format.
 */
export function toFluxitronOrder(
  order: SupabaseOrder,
  items: SupabaseOrderItem[] = []
): FluxitronOrder {
  // Parse shipping address from JSONB
  const addr = order.shipping_address;
  let shippingAddress: FluxitronAddress | null = null;

  if (addr && typeof addr === 'object') {
    shippingAddress = {
      firstName: addr.firstName || addr.first_name || addr.full_name?.split(' ')[0] || null,
      lastName: addr.lastName || addr.last_name || addr.full_name?.split(' ').slice(1).join(' ') || null,
      company: addr.company || null,
      address1: addr.address1 || addr.street || null,
      address2: addr.address2 || null,
      city: addr.city || null,
      province: addr.province || addr.region || null,
      country: addr.country || 'France',
      countryCode: addr.countryCode || addr.country_code || 'FR',
      zip: addr.zip || addr.postal_code || null,
      phone: addr.phone || null,
    };
  }

  // Map line items
  const lineItems: FluxitronLineItem[] = items.map((item) => ({
    id: item.id,
    productId: item.product_id || '', // null if the product was deleted
    variantId: item.product_id || '', // 1 product = 1 variant
    sku: item.product?.sku || item.product_sku || '',
    title:
      [item.product?.brand, item.product?.model].filter(Boolean).join(' ') ||
      item.product_name ||
      'Produit',
    quantity: item.quantity,
    price: parseFloat(item.price_at_purchase.toString()),
  }));

  // Calculate subtotal from items
  const subtotalPrice = lineItems.reduce((sum, li) => sum + li.price * li.quantity, 0);
  const totalPrice = parseFloat(order.total_amount.toString());
  const totalShippingPrice = Math.max(0, totalPrice - subtotalPrice + (order.discount_amount || 0));

  return {
    id: order.id,
    orderNumber: order.order_number || `TC-${order.id.slice(0, 8).toUpperCase()}`,
    email: order.profile?.email || null,
    phone: order.profile?.phone || null,
    financialStatus: mapFinancialStatus(order.status),
    fulfillmentStatus: order.fulfillment_status || 'unfulfilled',
    currency: 'EUR',
    subtotalPrice,
    totalShippingPrice,
    totalPrice,
    lineItems,
    shippingAddress,
    billingAddress: shippingAddress, // Same as shipping for now
    createdAt: order.created_at,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Analyze a raw grade value coming from Foxway/Fluxitron.
//   { normalized: GradeLetter | null, rejectedAsCPlus: boolean }
//
// Délègue à la source unique `normalizeGrade` (lib/products) : les 6 grades
// (A+/A/B+/B/C+/C) sont conservés tels quels, le «+» n'est plus écrasé et le C+
// n'est plus rejeté. `rejectedAsCPlus` est conservé (toujours false) pour la
// compat des appelants/scripts existants.
export function analyzeGradeValue(
  raw: string | null | undefined
): { normalized: GradeLetter | null; rejectedAsCPlus: boolean } {
  return { normalized: normalizeGrade(raw), rejectedAsCPlus: false };
}

// Back-compat thin wrapper — existing callers expect the letter return.
export function sanitizeGrade(raw: string): GradeLetter | null {
  return normalizeGrade(raw);
}

function generateHandle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function generateSku(p: SupabaseProduct): string {
  return [p.brand, p.model, p.storage_capacity, p.grade || 'STD']
    .filter(Boolean)
    .join('-')
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function mapCategoryToProductType(category: string): string {
  const map: Record<string, string> = {
    telephones: 'Smartphone',
    accessoires: 'Accessoire',
  };
  return map[category] || 'Other';
}
