// ─────────────────────────────────────────────────────────────────────────
// Official curated product images (brand + model [+ color] → image URL).
//
// WHY: Foxway/Fluxitron only ships one generic photo per product (shared by
// every color), and ~15% of the catalog has no photo at all. This map lets us
// override with our own clean photos as they become available.
//
// HOW TO ADD AN ENTRY:
//   1. Build the key with modelImageKey(brand, model[, color]):
//        - brand + model            → applies to every color of that model
//        - brand + model + color    → applies to one specific color (wins)
//      Keys are lowercased & trimmed automatically by modelImageKey().
//   2. `color` must match the product's STORED color value (English, e.g.
//      "Black", "Green") — that is what resolveProductImage() passes in.
//   3. The value is the image URL: a local path under /public (recommended,
//      e.g. "/products/official/iphone-14-pro.jpg") or an absolute URL.
//
// resolveProductImage() (see productImage.ts) reads this map BEFORE the
// Foxway images and the neutral placeholder.
//
// This map is intentionally EMPTY for now — fill it once real photos exist.
// ─────────────────────────────────────────────────────────────────────────

export const MODEL_IMAGES: Record<string, string> = {
  // ── Examples (commented — copy the format, then uncomment) ───────────────
  //
  // Model + specific color (most precise — wins over the model-only entry):
  //   'apple|iphone 14 pro|space grey': '/products/official/iphone-14-pro-space-grey.jpg',
  //
  // Model only (used for every color that has no color-specific entry):
  //   'apple|iphone 14 pro': '/products/official/iphone-14-pro.jpg',
  //   'samsung|galaxy z fold3 5g 512gb f926b ds': '/products/official/galaxy-z-fold3.jpg',
};

// Build the lookup key for MODEL_IMAGES. Color is optional.
export function modelImageKey(
  brand: string,
  model: string,
  color?: string | null,
): string {
  const base = `${(brand || '').trim().toLowerCase()}|${(model || '').trim().toLowerCase()}`;
  const c = (color || '').trim().toLowerCase();
  return c ? `${base}|${c}` : base;
}
