// Filtre d'AFFICHAGE de la boutique : on retire du storefront les iPhone
// antérieurs à l'iPhone 11 (X, XS, XS Max, XR, 8/8 Plus, 7/7 Plus, 6s, SE 1re
// génération…). On garde iPhone 11 et plus récents, ainsi que l'iPhone SE
// 2020 (2e gén.) et 2022 (3e gén.).
//
// Filtre à la SOURCE (une seule fonction, par modèle) — PAS un masquage fiche
// par fiche. N'affecte QUE l'affichage storefront : l'ingestion Fluxitron et
// l'admin continuent de voir tout le catalogue (back-end intact).

export function isAllowedPhone(
  brand: string | null | undefined,
  model: string | null | undefined,
): boolean {
  const b = (brand || '').trim().toLowerCase();
  const m = (model || '').trim().toLowerCase();

  // On ne filtre QUE les iPhone — les autres marques passent toutes.
  if (b !== 'apple') return true;
  if (!m.includes('iphone')) return true;

  // iPhone SE : on garde la 2e gén. (2020) et la 3e gén. (2022),
  // on retire la 1re gén. (2016, libellée « iPhone SE » sans année).
  if (m.includes('iphone se')) {
    return /\b(2020|2022|2nd|3rd|2e|3e)\b/.test(m);
  }

  // Génération numérique : iPhone 11+ (couvre 11 → 17, 16e, 17e, etc.).
  const num = m.match(/iphone\s+(\d+)/);
  if (num) return parseInt(num[1], 10) >= 11;

  // Modèles « lettrés » antérieurs au 11 : X, XS, XS Max, XR.
  if (/iphone\s+x/.test(m)) return false;

  // iPhone Air (récent) ou tout libellé inattendu : on garde par prudence
  // (ne jamais masquer un modèle récent à cause d'un nom non reconnu).
  return true;
}
