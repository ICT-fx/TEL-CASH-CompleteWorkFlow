// D3 — Photos « pas pro » à remplacer par le placeholder neutre.
//
// On NE supprime pas les fichiers : resolveProductImage() renvoie simplement le
// placeholder silhouette au lieu de ces images. Édite ces listes pour ajuster
// (re-bascule possible à tout moment, sans toucher au catalogue ni aux SKU).
//
// Sources :
//   - BLOCKED_IMAGE_FILES : public/images/_fond-non-uniforme.json
//       (fond complexe / lifestyle / dégradé → détourage non fiable).
//   - BLOCKED_MODELS : modèles signalés comme photographiés « à l'amateur »
//       (téléphone posé sur une table). Concerne TOUTES les couleurs du modèle.

export const BLOCKED_IMAGE_FILES = new Set<string>([
  'apple-iphone-11-green.png',
  'apple-iphone-11-pro-midnight-green.png',
  'apple-iphone-11-white.png',
  'apple-iphone-xs-max-gold.png',
]);

export const BLOCKED_MODELS = new Set<string>([
  'iPhone 7',
  'iPhone 7 Plus',
  'iPhone SE (2nd generation)',
]);

export function isBlockedImageFile(url: string | null | undefined): boolean {
  if (!url) return false;
  const base = url.split('/').pop()?.split('?')[0]?.toLowerCase() ?? '';
  return BLOCKED_IMAGE_FILES.has(base);
}

export function isBlockedModel(model: string | null | undefined): boolean {
  if (!model) return false;
  return BLOCKED_MODELS.has(model.trim());
}
