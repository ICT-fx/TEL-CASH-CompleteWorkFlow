// Fetch helpers for the "related" carousels on the product page.
// Pure data — no React. Returned shapes match RawProduct from productVariants.

import type { RawProduct } from './productVariants';
import { getIphoneSpecs } from './iphoneSpecs';

// In-memory cache so multiple sections on the same page don't re-fetch.
let CACHED_ALL: RawProduct[] | null = null;
let CACHE_PROMISE: Promise<RawProduct[]> | null = null;

async function fetchAllProducts(): Promise<RawProduct[]> {
  if (CACHED_ALL) return CACHED_ALL;
  if (CACHE_PROMISE) return CACHE_PROMISE;
  CACHE_PROMISE = (async () => {
    try {
      const res = await fetch('/api/products?limit=all');
      if (!res.ok) return [];
      const data = await res.json();
      CACHED_ALL = (data.products as RawProduct[]) || [];
      return CACHED_ALL;
    } catch {
      return [];
    } finally {
      CACHE_PROMISE = null;
    }
  })();
  return CACHE_PROMISE;
}

export interface RelatedModel {
  brand: string;
  model: string;
  slug: string;
  representativeImage: string | null;
  minPrice: number;
  compareAtPrice: number;       // real compare_at_price of the cheapest SKU (0 if none)
  totalStock: number;
  colorSwatches: string[];      // up to 4 colors (English keys for colorToCss)
  totalColors: number;
  firstSkuId: string;
}

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string') { const n = parseFloat(v); return Number.isFinite(n) ? n : fallback; }
  return fallback;
}

// Pick iPhones in the same price range — same brand, different model.
// Up to N models, sorted by price proximity then by stock.
export async function getRelatedIphones(
  currentBrand: string,
  currentModel: string,
  currentPrice: number,
  limit = 6,
): Promise<RelatedModel[]> {
  const all = await fetchAllProducts();
  const phones = all.filter(
    (p) =>
      p.is_active &&
      p.brand?.toLowerCase() === currentBrand.toLowerCase() &&
      p.model?.toLowerCase() !== currentModel.toLowerCase(),
  );

  // Group by model
  const buckets = new Map<string, RawProduct[]>();
  for (const p of phones) {
    const k = `${p.brand}|${p.model}`;
    const arr = buckets.get(k);
    if (arr) arr.push(p); else buckets.set(k, [p]);
  }

  const models: RelatedModel[] = [];
  buckets.forEach((bucket) => {
    const first = bucket[0];
    const withPrice = bucket.filter((s) => asNumber(s.price) > 0);
    const prices = withPrice.map((s) => asNumber(s.price));
    const minPrice = prices.length ? Math.min(...prices) : 0;
    // Real compare_at_price of the cheapest SKU (never invented). 0 if absent.
    const cheapest = withPrice.sort((a, b) => asNumber(a.price) - asNumber(b.price))[0];
    const cmp = cheapest ? asNumber((cheapest as { compare_at_price?: number | string }).compare_at_price) : 0;
    const compareAtPrice = cmp > minPrice ? cmp : 0;
    const totalStock = bucket.reduce((sum, s) => sum + asNumber(s.stock), 0);
    const colors = Array.from(new Set(bucket.map((s) => (s.color || '').trim()).filter(Boolean)));
    const inStock = bucket.find((s) => asNumber(s.stock) > 0);
    const repImage = (inStock?.images?.[0] || bucket[0]?.images?.[0] || null) as string | null;

    models.push({
      brand: first.brand || '',
      model: first.model || '',
      slug: `${first.brand}-${first.model}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      representativeImage: repImage,
      minPrice,
      compareAtPrice,
      totalStock,
      colorSwatches: colors.slice(0, 4),
      totalColors: colors.length,
      firstSkuId: (inStock?.id || bucket[0].id) as string,
    });
  });

  // Closest by price first, drop out-of-stock to the end
  return models
    .sort((a, b) => {
      const stockDiff = (b.totalStock > 0 ? 1 : 0) - (a.totalStock > 0 ? 1 : 0);
      if (stockDiff !== 0) return stockDiff;
      return Math.abs(a.minPrice - currentPrice) - Math.abs(b.minPrice - currentPrice);
    })
    .slice(0, limit);
}

// Return all in-stock accessories (category='accessoires'), ordered by type
// then price ascending.
const TYPE_ORDER: Record<string, number> = {
  coque: 1, verre: 2, chargeur: 3, cable: 4, ecouteurs: 5, batterie: 6,
};

export async function getAccessories(): Promise<RawProduct[]> {
  const all = await fetchAllProducts();
  return all
    .filter((p) => p.is_active && (p.category as string) === 'accessoires')
    .sort((a, b) => {
      const at = TYPE_ORDER[(a.product_type as string) ?? 'zzz'] ?? 99;
      const bt = TYPE_ORDER[(b.product_type as string) ?? 'zzz'] ?? 99;
      if (at !== bt) return at - bt;
      return asNumber(a.price) - asNumber(b.price);
    });
}

// Pick the single best companion accessory for a given iPhone : prefer a
// coque (case), then a verre (screen protector). Used by "Souvent achetés ensemble".
export async function getBundleAccessory(): Promise<RawProduct | null> {
  const accs = await getAccessories();
  const coque = accs.find((p) => (p.product_type as string) === 'coque');
  if (coque) return coque;
  const verre = accs.find((p) => (p.product_type as string) === 'verre');
  if (verre) return verre;
  return accs[0] ?? null;
}

// ── Bundle "Souvent achetés ensemble" : téléphone + prise secteur + câble ───
// compatible avec le port du téléphone.

export type PhonePort = 'usb-c' | 'lightning';

// Port de charge du téléphone. iPhone : on s'appuie sur les fiches techniques
// officielles (iphoneSpecs.connectique) ; à défaut, sur le n° de génération
// (≥ 15 et « Air » = USB-C ; 11→14 = Lightning). Tout non-iPhone (Samsung,
// Pixel, Xiaomi…) est en USB-C.
export function detectPhonePort(brand?: string | null, model?: string | null): PhonePort {
  const b = (brand || '').toLowerCase();
  const m = (model || '').trim();
  const isApple = b.includes('apple') || /iphone/i.test(m);
  if (!isApple) return 'usb-c';

  const spec = getIphoneSpecs(m);
  if (spec) return /usb-?c/i.test(spec.connectique) ? 'usb-c' : 'lightning';

  if (/iphone\s*air/i.test(m)) return 'usb-c';
  const gen = m.match(/iphone\s*(\d{1,2})/i);
  if (gen) return parseInt(gen[1], 10) >= 15 ? 'usb-c' : 'lightning';
  // SE et iPhone non identifié (anciens) → Lightning.
  return 'lightning';
}

const hasValidPrice = (p: RawProduct) => asNumber(p.price) > 0;

const isPlug = (p: RawProduct) =>
  /\b(prise|chargeur|adaptateur)\s+secteur\b/i.test(p.model || '');

// Câble : un seul embout (USB-C pur) vs câble à embout Lightning (le 2-en-1
// Type-C + Lightning est le seul du catalogue compatible iPhone Lightning).
const isLightningCable = (p: RawProduct) =>
  /c[âa]ble/i.test(p.model || '') && /lightning/i.test(p.model || '');
const isUsbcCable = (p: RawProduct) =>
  /c[âa]ble/i.test(p.model || '') &&
  /usb-?c|type-?c/i.test(p.model || '') &&
  !/lightning/i.test(p.model || '');

// Verre / protection d'écran (universel, compatible smartphone).
const isScreenProtector = (p: RawProduct) =>
  (p.product_type as string) === 'verre' ||
  /\bverre\b|prot[èe]ge[- ]?[ée]cran|protection\s+[ée]cran/i.test(p.model || '');

// Le bundle = prise secteur + câble COMPATIBLE avec le port du téléphone + verre
// de protection.
// - Port USB-C  → câble USB-C pur.
// - Port Lightning → câble 2-en-1 Type-C + Lightning (jamais un USB-C pur).
// Un accessoire n'est proposé que s'il a un prix valide (> 0) : les accessoires
// « Bientôt disponible » (prix à définir) sont exclus — le verre n'apparaît donc
// dans le bundle QUE s'il a un prix. Renvoie [] si rien de pertinent (la section
// se masque).
export async function getBundleAccessories(
  brand?: string | null,
  model?: string | null,
): Promise<RawProduct[]> {
  const accs = (await getAccessories()).filter(hasValidPrice);
  const byPrice = (a: RawProduct, b: RawProduct) => asNumber(a.price) - asNumber(b.price);

  // Prise : on privilégie une vraie « prise secteur » nue, sinon un chargeur
  // secteur, du moins cher au plus cher.
  const plug = accs
    .filter(isPlug)
    .sort((a, b) => {
      const ap = /^\s*prise/i.test(a.model || '') ? 0 : 1;
      const bp = /^\s*prise/i.test(b.model || '') ? 0 : 1;
      return ap - bp || byPrice(a, b);
    })[0] ?? null;

  const port = detectPhonePort(brand, model);
  const cable = accs
    .filter(port === 'lightning' ? isLightningCable : isUsbcCable)
    .sort(byPrice)[0] ?? null;

  // Verre de protection : le moins cher avec un prix valide (déjà filtré).
  const screen = accs.filter(isScreenProtector).sort(byPrice)[0] ?? null;

  return [plug, cable, screen].filter((x): x is RawProduct => !!x);
}
