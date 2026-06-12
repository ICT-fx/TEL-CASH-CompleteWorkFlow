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
// Rempli le 12/06/2026 : 127 couples modèle×couleur couverts par des
// packshots OFFICIELS Apple (store.storeimages.cdn-apple.com — PNG fond
// transparent, cf. public/image-sources.json). Les couples restants sont
// listés dans scripts/photos-missing-report.json (placeholder en attendant).
//
// IMPORTANT : ne JAMAIS ajouter d'entrée « modèle seul » (sans couleur) — elle
// écraserait l'image couleur correcte du SKU et afficherait une teinte fausse.
// ─────────────────────────────────────────────────────────────────────────

export const MODEL_IMAGES: Record<string, string> = {
  "apple|iphone 11 pro max|gold": "/images/apple-iphone-11-pro-max-gold.png",
  "apple|iphone 11 pro max|midnight green": "/images/apple-iphone-11-pro-max-midnight-green.png",
  "apple|iphone 11 pro max|silver": "/images/apple-iphone-11-pro-max-silver.png",
  "apple|iphone 11 pro|gold": "/images/apple-iphone-11-pro-gold.png",
  "apple|iphone 11 pro|midnight green": "/images/apple-iphone-11-pro-midnight-green.png",
  "apple|iphone 11 pro|silver": "/images/apple-iphone-11-pro-silver.png",
  "apple|iphone 11|black": "/images/apple-iphone-11-black.png",
  "apple|iphone 11|green": "/images/apple-iphone-11-green.png",
  "apple|iphone 11|product red": "/images/apple-iphone-11-product-red.png",
  "apple|iphone 11|purple": "/images/apple-iphone-11-purple.png",
  "apple|iphone 11|white": "/images/apple-iphone-11-white.png",
  "apple|iphone 11|yellow": "/images/apple-iphone-11-yellow.png",
  "apple|iphone 12 mini|black": "/images/apple-iphone-12-mini-black.png",
  "apple|iphone 12 mini|blue": "/images/apple-iphone-12-mini-blue.png",
  "apple|iphone 12 mini|green": "/images/apple-iphone-12-mini-green.png",
  "apple|iphone 12 mini|product red": "/images/apple-iphone-12-mini-product-red.png",
  "apple|iphone 12 mini|purple": "/images/apple-iphone-12-mini-purple.png",
  "apple|iphone 12 mini|white": "/images/apple-iphone-12-mini-white.png",
  "apple|iphone 12|black": "/images/apple-iphone-12-black.png",
  "apple|iphone 12|blue": "/images/apple-iphone-12-blue.png",
  "apple|iphone 12|green": "/images/apple-iphone-12-green.png",
  "apple|iphone 12|product red": "/images/apple-iphone-12-product-red.png",
  "apple|iphone 12|purple": "/images/apple-iphone-12-purple.png",
  "apple|iphone 12|white": "/images/apple-iphone-12-white.png",
  "apple|iphone 13 mini|blue": "/images/apple-iphone-13-mini-blue.png",
  "apple|iphone 13 mini|green": "/images/apple-iphone-13-mini-green.png",
  "apple|iphone 13 mini|midnight": "/images/apple-iphone-13-mini-midnight.png",
  "apple|iphone 13 mini|pink": "/images/apple-iphone-13-mini-pink.png",
  "apple|iphone 13 mini|product red": "/images/apple-iphone-13-mini-product-red.png",
  "apple|iphone 13 mini|starlight": "/images/apple-iphone-13-mini-starlight.png",
  "apple|iphone 13 pro max|alpine green": "/images/apple-iphone-13-pro-max-alpine-green.png",
  "apple|iphone 13 pro max|gold": "/images/apple-iphone-13-pro-max-gold.png",
  "apple|iphone 13 pro max|graphite": "/images/apple-iphone-13-pro-max-graphite.png",
  "apple|iphone 13 pro max|sierra blue": "/images/apple-iphone-13-pro-max-sierra-blue.png",
  "apple|iphone 13 pro max|silver": "/images/apple-iphone-13-pro-max-silver.png",
  "apple|iphone 13 pro|alpine green": "/images/apple-iphone-13-pro-alpine-green.png",
  "apple|iphone 13 pro|gold": "/images/apple-iphone-13-pro-gold.png",
  "apple|iphone 13 pro|graphite": "/images/apple-iphone-13-pro-graphite.png",
  "apple|iphone 13 pro|sierra blue": "/images/apple-iphone-13-pro-sierra-blue.png",
  "apple|iphone 13 pro|silver": "/images/apple-iphone-13-pro-silver.png",
  "apple|iphone 13|blue": "/images/apple-iphone-13-blue.png",
  "apple|iphone 13|green": "/images/apple-iphone-13-green.png",
  "apple|iphone 13|midnight": "/images/apple-iphone-13-midnight.png",
  "apple|iphone 13|pink": "/images/apple-iphone-13-pink.png",
  "apple|iphone 13|product red": "/images/apple-iphone-13-product-red.png",
  "apple|iphone 13|starlight": "/images/apple-iphone-13-starlight.png",
  "apple|iphone 14 plus|blue": "/images/apple-iphone-14-plus-blue.png",
  "apple|iphone 14 plus|midnight": "/images/apple-iphone-14-plus-midnight.png",
  "apple|iphone 14 plus|product red": "/images/apple-iphone-14-plus-product-red.png",
  "apple|iphone 14 plus|purple": "/images/apple-iphone-14-plus-purple.png",
  "apple|iphone 14 plus|starlight": "/images/apple-iphone-14-plus-starlight.png",
  "apple|iphone 14 plus|yellow": "/images/apple-iphone-14-plus-yellow.png",
  "apple|iphone 14 pro max|deep purple": "/images/apple-iphone-14-pro-max-deep-purple.png",
  "apple|iphone 14 pro max|gold": "/images/apple-iphone-14-pro-max-gold.png",
  "apple|iphone 14 pro max|silver": "/images/apple-iphone-14-pro-max-silver.png",
  "apple|iphone 14 pro max|space black": "/images/apple-iphone-14-pro-max-space-black.png",
  "apple|iphone 14 pro|deep purple": "/images/apple-iphone-14-pro-deep-purple.png",
  "apple|iphone 14 pro|gold": "/images/apple-iphone-14-pro-gold.png",
  "apple|iphone 14 pro|silver": "/images/apple-iphone-14-pro-silver.png",
  "apple|iphone 14 pro|space black": "/images/apple-iphone-14-pro-space-black.png",
  "apple|iphone 14|blue": "/images/apple-iphone-14-blue.png",
  "apple|iphone 14|midnight": "/images/apple-iphone-14-midnight.png",
  "apple|iphone 14|product red": "/images/apple-iphone-14-product-red.png",
  "apple|iphone 14|purple": "/images/apple-iphone-14-purple.png",
  "apple|iphone 14|starlight": "/images/apple-iphone-14-starlight.png",
  "apple|iphone 14|yellow": "/images/apple-iphone-14-yellow.png",
  "apple|iphone 15 plus|black": "/images/apple-iphone-15-plus-black.png",
  "apple|iphone 15 plus|blue": "/images/apple-iphone-15-plus-blue.png",
  "apple|iphone 15 plus|green": "/images/apple-iphone-15-plus-green.png",
  "apple|iphone 15 plus|pink": "/images/apple-iphone-15-plus-pink.png",
  "apple|iphone 15 plus|yellow": "/images/apple-iphone-15-plus-yellow.png",
  "apple|iphone 15 pro max|black titanium": "/images/apple-iphone-15-pro-max-black-titanium.png",
  "apple|iphone 15 pro max|blue titanium": "/images/apple-iphone-15-pro-max-blue-titanium.png",
  "apple|iphone 15 pro max|natural titanium": "/images/apple-iphone-15-pro-max-natural-titanium.png",
  "apple|iphone 15 pro max|white titanium": "/images/apple-iphone-15-pro-max-white-titanium.png",
  "apple|iphone 15 pro|black titanium": "/images/apple-iphone-15-pro-black-titanium.png",
  "apple|iphone 15 pro|blue titanium": "/images/apple-iphone-15-pro-blue-titanium.png",
  "apple|iphone 15 pro|natural titanium": "/images/apple-iphone-15-pro-natural-titanium.png",
  "apple|iphone 15 pro|white titanium": "/images/apple-iphone-15-pro-white-titanium.png",
  "apple|iphone 15|black": "/images/apple-iphone-15-black.png",
  "apple|iphone 15|blue": "/images/apple-iphone-15-blue.png",
  "apple|iphone 15|green": "/images/apple-iphone-15-green.png",
  "apple|iphone 15|pink": "/images/apple-iphone-15-pink.png",
  "apple|iphone 15|yellow": "/images/apple-iphone-15-yellow.png",
  "apple|iphone 16 plus|black": "/images/apple-iphone-16-plus-black.png",
  "apple|iphone 16 plus|pink": "/images/apple-iphone-16-plus-pink.png",
  "apple|iphone 16 plus|teal": "/images/apple-iphone-16-plus-teal.png",
  "apple|iphone 16 plus|ultramarine": "/images/apple-iphone-16-plus-ultramarine.png",
  "apple|iphone 16 plus|white": "/images/apple-iphone-16-plus-white.png",
  "apple|iphone 16 pro max|black titanium": "/images/apple-iphone-16-pro-max-black-titanium.png",
  "apple|iphone 16 pro max|desert titanium": "/images/apple-iphone-16-pro-max-desert-titanium.png",
  "apple|iphone 16 pro max|natural titanium": "/images/apple-iphone-16-pro-max-natural-titanium.png",
  "apple|iphone 16 pro max|white titanium": "/images/apple-iphone-16-pro-max-white-titanium.png",
  "apple|iphone 16 pro|black titanium": "/images/apple-iphone-16-pro-black-titanium.png",
  "apple|iphone 16 pro|desert titanium": "/images/apple-iphone-16-pro-desert-titanium.png",
  "apple|iphone 16 pro|natural titanium": "/images/apple-iphone-16-pro-natural-titanium.png",
  "apple|iphone 16 pro|white titanium": "/images/apple-iphone-16-pro-white-titanium.png",
  "apple|iphone 16|black": "/images/apple-iphone-16-black.png",
  "apple|iphone 16|pink": "/images/apple-iphone-16-pink.png",
  "apple|iphone 16|teal": "/images/apple-iphone-16-teal.png",
  "apple|iphone 16|ultramarine": "/images/apple-iphone-16-ultramarine.png",
  "apple|iphone 16|white": "/images/apple-iphone-16-white.png",
  "apple|iphone 7|black": "/images/apple-iphone-7-black.png",
  "apple|iphone 7|gold": "/images/apple-iphone-7-gold.png",
  "apple|iphone 7|jet black": "/images/apple-iphone-7-jet-black.png",
  "apple|iphone 7|rose gold": "/images/apple-iphone-7-rose-gold.png",
  "apple|iphone 7|silver": "/images/apple-iphone-7-silver.png",
  "apple|iphone 8|gold": "/images/apple-iphone-8-gold.png",
  "apple|iphone 8|product red": "/images/apple-iphone-8-product-red.png",
  "apple|iphone 8|silver": "/images/apple-iphone-8-silver.png",
  "apple|iphone se (2nd generation)|black": "/images/apple-iphone-se-2nd-generation-black.png",
  "apple|iphone se (2nd generation)|product red": "/images/apple-iphone-se-2nd-generation-product-red.png",
  "apple|iphone se (2nd generation)|white": "/images/apple-iphone-se-2nd-generation-white.png",
  "apple|iphone se (3rd generation)|midnight": "/images/apple-iphone-se-3rd-generation-midnight.png",
  "apple|iphone se (3rd generation)|product red": "/images/apple-iphone-se-3rd-generation-product-red.png",
  "apple|iphone se (3rd generation)|starlight": "/images/apple-iphone-se-3rd-generation-starlight.png",
  "apple|iphone x|silver": "/images/apple-iphone-x-silver.png",
  "apple|iphone xr|black": "/images/apple-iphone-xr-black.png",
  "apple|iphone xr|blue": "/images/apple-iphone-xr-blue.png",
  "apple|iphone xr|coral": "/images/apple-iphone-xr-coral.png",
  "apple|iphone xr|product red": "/images/apple-iphone-xr-product-red.png",
  "apple|iphone xr|white": "/images/apple-iphone-xr-white.png",
  "apple|iphone xr|yellow": "/images/apple-iphone-xr-yellow.png",
  "apple|iphone xs max|gold": "/images/apple-iphone-xs-max-gold.png",
  "apple|iphone xs max|silver": "/images/apple-iphone-xs-max-silver.png",
  "apple|iphone xs|gold": "/images/apple-iphone-xs-gold.png",
  "apple|iphone xs|silver": "/images/apple-iphone-xs-silver.png",
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
