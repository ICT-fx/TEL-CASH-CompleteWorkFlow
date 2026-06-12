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

// Mise à jour 12/06/2026 : les 4 fichiers historiques (11 green/white,
// 11 pro midnight green, xs max gold) ont été REMPLACÉS par des packshots
// officiels Apple → débloqués. Restent bloquées les photos amateurs
// (blister, posé sur table, recadrage) sans remplaçant officiel trouvé —
// cf. scripts/photos-missing-report.json pour la liste « à fournir ».
export const BLOCKED_IMAGE_FILES = new Set<string>([
  'apple-iphone-7-plus-black.png',
  'apple-iphone-7-plus-rose-gold.png',
  'apple-iphone-8-plus-space-gray.png',
  'apple-iphone-8-plus-silver.png',
  'apple-iphone-x-space-gray.png',
  'apple-iphone-11-pro-max-space-gray.png',
  'apple-iphone-12-pro-pacific-blue.png',
  'apple-iphone-12-pro-max-pacific-blue.png',
]);

// iPhone 7 et SE (2e gen) débloqués : toutes leurs couleurs (ou presque) ont
// désormais un packshot officiel mappé dans MODEL_IMAGES. Le blocage fichier
// ci-dessus suffit pour les photos amateurs restantes (7 Plus, 8 Plus…).
export const BLOCKED_MODELS = new Set<string>([]);

export function isBlockedImageFile(url: string | null | undefined): boolean {
  if (!url) return false;
  const base = url.split('/').pop()?.split('?')[0]?.toLowerCase() ?? '';
  return BLOCKED_IMAGE_FILES.has(base);
}

export function isBlockedModel(model: string | null | undefined): boolean {
  if (!model) return false;
  return BLOCKED_MODELS.has(model.trim());
}
