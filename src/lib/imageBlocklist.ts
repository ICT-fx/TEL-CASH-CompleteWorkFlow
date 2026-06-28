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
  // Débloqués le 28/06/2026 : remplacés par les packshots OFFICIELS Apple
  // (store.storeimages.cdn-apple.com, png-alpha, format diagonal dos+face,
  // recadrés 720×720) — 12/12 mini Purple, SE 3 Midnight, 13/13 mini Green,
  // 13 Pro/Pro Max Alpine Green (token couleur Apple = « green »). Vérifiés
  // image par image.
  // ── Audit 24/06/2026 : MAUVAIS MODÈLE / MAUVAISE COULEUR ───────────────────
  // Photos importées le 15/06 (commits d9ec500 / 922ceb6 / c0d6245) qui ne
  // montrent PAS le bon produit (vérifié visuellement, image par image). Aucune
  // version correcte n'existe dans l'historique git → placeholder neutre en
  // attendant un vrai packshot. RÈGLE : jamais la photo d'un autre modèle/couleur.
  'google-pixel-9-pro-xl-5g-grey.png',        // montre un Pixel 9 Pro FOLD (pliable), pas un Pro XL
  'google-pixel-9-pro-fold-5g-black.png',     // montre un Pixel classique (barre photo), pas un Fold
  'google-pixel-7a-5g-white.png',             // montre un Pixel 7 PRO (module pleine largeur), pas un 7a
  'samsung-galaxy-a56-5g-black.png',          // montre un Galaxy A55 (objectifs séparés), pas l'A56
  'samsung-galaxy-s25-ultra-5g-green.png',    // appareil NOIR, pas vert
  'samsung-galaxy-s26-plus-5g-silver.png',    // châssis quad-objectif type Ultra, pas un S26+
  'samsung-galaxy-z-flip4-5g-rose-gold.png',  // montre un Flip6 argent, pas un Flip4 rose gold
  'samsung-galaxy-z-fold7-5g-green.png',      // render Fold3 (watermark OnLeaks), pas un Fold7
  'xiaomi-14-pro-5g-black.png',               // montre un Redmi (logo « Redmi 5G »), pas le Xiaomi 14 Pro
  'apple-iphone-8-product-red.png',           // composite incluant un iPhone 8 PLUS (double caméra)
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
