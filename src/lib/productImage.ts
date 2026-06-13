// Resolves which image URL to display for a product.
// Single source of truth for product imagery across the storefront — replaces
// the old hardcoded blue-iPhone fallback that made imageless products (Sony,
// Samsung…) look like the wrong device.

import type { SyntheticEvent } from 'react';

import { MODEL_IMAGES, modelImageKey } from './modelImages';
import { isBlockedImageFile, isBlockedModel } from './imageBlocklist';

export interface ProductImageInput {
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  images?: string[] | null;
}

// Trim a model name to a clean length, breaking on a word boundary.
function truncateLabel(raw: string, max = 28): string {
  const s = raw.replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > 14 ? cut.slice(0, sp) : cut.trim()) + '…';
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Neutral phone-silhouette placeholder as an inline SVG data URI, with the
// model name shown below the silhouette. Works directly as an <img src>.
// Never a real device — just a generic outline.
export function phonePlaceholder(label?: string | null): string {
  const name = label ? xmlEscape(truncateLabel(label)) : '';
  const caption = name
    ? `<text x="200" y="336" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="20" font-weight="500" fill="#475569">${name}</text>`
    : '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">` +
    `<rect width="400" height="400" fill="#f1f5f9"/>` +
    `<g transform="translate(140 64)">` +
    `<rect x="0" y="0" width="120" height="208" rx="22" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>` +
    `<rect x="13" y="22" width="94" height="144" rx="7" fill="#e2e8f0"/>` +
    `<rect x="49" y="11" width="22" height="4" rx="2" fill="#cbd5e1"/>` +
    `<circle cx="60" cy="187" r="10" fill="none" stroke="#cbd5e1" stroke-width="3"/>` +
    `<circle cx="40" cy="52" r="8" fill="#cbd5e1"/>` +
    `<path d="M20 140 L50 98 L72 126 L86 112 L100 140 Z" fill="#cbd5e1"/>` +
    `</g>` +
    caption +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Generic placeholder without a model name (used when no product is known).
export const PLACEHOLDER_PHONE = phonePlaceholder();

// onError handler for product <img>/<motion.img>: when the source URL is dead
// (404, missing file), swap to the neutral SVG placeholder instead of letting
// the browser fall back to the alt text ("Apple iPhone X"). The data-fallback
// guard prevents an infinite error loop if the placeholder itself ever fails.
export function onImageErrorToPlaceholder(label?: string | null) {
  const fallback = phonePlaceholder(label || null);
  return (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.dataset.fallback === '1') return;
    img.dataset.fallback = '1';
    img.srcset = '';
    img.src = fallback;
  };
}

// Alias couleur : Foxway/la base stockent des couleurs GÉNÉRIQUES (Black, Grey,
// Blue…) alors que nos packshots officiels sont nommés à la mode Apple
// (Midnight, Space Black, Natural Titanium…). Pour une couleur générique donnée,
// on essaie ces variantes Apple DANS L'ORDRE — la première qui existe pour CE
// modèle gagne. C'est sûr : par modèle il n'y a qu'UNE photo « famille noire »
// (ex. iPhone 13 → midnight), donc aucun risque de teinte fausse. Sans
// correspondance, on retombe sur le placeholder (jamais la photo d'une autre
// couleur).
const COLOR_ALIASES: Record<string, string[]> = {
  black: ['midnight', 'space black', 'black titanium', 'jet black'],
  grey: ['natural titanium', 'space gray', 'graphite'],
  gray: ['natural titanium', 'space gray', 'graphite'],
  white: ['starlight', 'white titanium', 'silver'],
  blue: ['sierra blue', 'pacific blue', 'blue titanium', 'midnight blue'],
  purple: ['deep purple'],
  beige: ['desert titanium'],
  red: ['product red'],
  green: ['alpine green', 'midnight green'],
  gold: ['desert titanium'],
  silver: ['white titanium', 'natural titanium'],
  graphite: ['space black', 'natural titanium'],
  'jet black': ['space black', 'black titanium'],
};

// Alias de NOM DE MODÈLE : la base (Foxway) nomme certains modèles autrement que
// nos packshots officiels. Ex. « iPhone SE (2022) » ↔ « iPhone SE (3rd
// generation) ». Mapping sûr (même appareil), pour ne pas perdre une photo
// existante à cause d'un libellé différent.
const MODEL_ALIASES: Record<string, string> = {
  'iphone se (2020)': 'iphone se (2nd generation)',
  'iphone se (2022)': 'iphone se (3rd generation)',
  'iphone se 2020': 'iphone se (2nd generation)',
  'iphone se 2022': 'iphone se (3rd generation)',
};
function aliasModel(model: string): string {
  return MODEL_ALIASES[model.toLowerCase().trim()] || model;
}

// Cherche un packshot OFFICIEL pour exactly ce (modèle, couleur), couleur exacte
// d'abord puis alias Apple. Renvoie null si rien — JAMAIS la photo d'une autre
// couleur.
function curatedColorImage(brand: string, model: string, color: string): string | null {
  const m = aliasModel(model);
  const exact = MODEL_IMAGES[modelImageKey(brand, m, color)];
  if (exact && !isBlockedImageFile(exact)) return exact;
  for (const alt of COLOR_ALIASES[color.toLowerCase().trim()] || []) {
    const hit = MODEL_IMAGES[modelImageKey(brand, m, alt)];
    if (hit && !isBlockedImageFile(hit)) return hit;
  }
  return null;
}

// Returns the best image URL for a product, by priority:
//   a) official mapping — model + color (exact, puis alias couleur Apple)
//   --- en mode STRICT, on s'arrête ici → placeholder si pas de photo de CETTE
//       couleur (règle : jamais une photo « gamme » ni une autre couleur).
//   b) official mapping — model only
//   c) the product's first non-empty Foxway image
//   d) neutral placeholder showing the model name (never a real iPhone)
//
// `strict` (fiche produit, par couleur) : n'autorise QUE la photo officielle de
// la couleur exacte (a). Sinon placeholder neutre. Évite les bugs « photo d'une
// autre couleur » / « visuel gamme » signalés sur iPhone 14 Plus / 17 Pro.
export function resolveProductImage(
  product: ProductImageInput | null | undefined,
  selectedColor?: string | null,
  opts?: { strict?: boolean },
): string {
  if (!product) return PLACEHOLDER_PHONE;

  const brand = (product.brand || '').trim();
  const model = (product.model || '').trim();
  const color = (selectedColor ?? product.color ?? '') || '';
  const label = [brand, model].filter(Boolean).join(' ');
  const strict = opts?.strict ?? false;

  const skipCurated = isBlockedModel(model);

  // a) Official mapping — model + color (exact + alias Apple)
  if (!skipCurated && brand && model && color) {
    const hit = curatedColorImage(brand, model, color);
    if (hit) return hit;
  }

  // En mode strict, pas de repli sur une image « modèle seul » ou Foxway :
  // si on n'a pas la VRAIE photo de cette couleur, on montre le placeholder.
  if (strict) return phonePlaceholder(label || null);

  // b) Official mapping — model only
  if (!skipCurated && brand && model) {
    const hit = MODEL_IMAGES[modelImageKey(brand, aliasModel(model))];
    if (hit && !isBlockedImageFile(hit)) return hit;
  }

  // c) First usable Foxway image (sauf fichier listé « fond non uniforme »)
  const first = product.images?.find(
    (u) => typeof u === 'string' && u.trim().length > 0 && !isBlockedImageFile(u),
  );
  if (first) return first;

  // d) Neutral placeholder with the model name
  return phonePlaceholder(label || null);
}
