// Resolves which image URL to display for a product.
// Single source of truth for product imagery across the storefront — replaces
// the old hardcoded blue-iPhone fallback that made imageless products (Sony,
// Samsung…) look like the wrong device.

import { MODEL_IMAGES, modelImageKey } from './modelImages';

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

// Returns the best image URL for a product, by priority:
//   a) official mapping — model + color
//   b) official mapping — model only
//   c) the product's first non-empty Foxway image
//   d) neutral placeholder showing the model name (never a real iPhone)
export function resolveProductImage(
  product: ProductImageInput | null | undefined,
  selectedColor?: string | null,
): string {
  if (!product) return PLACEHOLDER_PHONE;

  const brand = (product.brand || '').trim();
  const model = (product.model || '').trim();
  const color = (selectedColor ?? product.color ?? '') || '';

  // a) Official mapping — model + color
  if (brand && model && color) {
    const hit = MODEL_IMAGES[modelImageKey(brand, model, color)];
    if (hit) return hit;
  }

  // b) Official mapping — model only
  if (brand && model) {
    const hit = MODEL_IMAGES[modelImageKey(brand, model)];
    if (hit) return hit;
  }

  // c) First usable Foxway image
  const first = product.images?.find(
    (u) => typeof u === 'string' && u.trim().length > 0,
  );
  if (first) return first;

  // d) Neutral placeholder with the model name
  const label = [brand, model].filter(Boolean).join(' ');
  return phonePlaceholder(label || null);
}
