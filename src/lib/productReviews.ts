// Avis produit — adossés aux VRAIS avis de la boutique (cf. realReviews.ts).
// Ce ne sont plus des avis fabriqués : on pioche un sous-ensemble stable des
// avis Google réels par modèle. L'API (getProductReviews) reste identique pour
// les composants existants (fiche, cartes « vous aimerez aussi »).

import {
  REAL_REVIEWS,
  getRealReviewSummary,
  pickRealReviews,
} from './realReviews';

export interface DemoReview {
  author: string;
  rating: number;
  date: string;  // vide : les avis Google n'ont pas de date saisie
  title: string; // vide : pas de titre sur ces avis
  body: string;
  verified: boolean;
}

export interface ProductReviewBundle {
  average: number;
  count: number;
  distribution: number[]; // 5 entries (5★…1★)
  reviews: DemoReview[];
}

// Renvoie un bundle d'avis RÉELS pour un (modèle, marque). Le score et le
// nombre sont ceux des vrais avis de la boutique (identiques partout, honnêtes).
export function getProductReviews(brand: string, model: string): ProductReviewBundle {
  const summary = getRealReviewSummary();
  const picked = pickRealReviews(`${brand}|${model}`, 3).map((r) => ({
    author: r.name,
    rating: r.rating,
    date: '',
    title: '',
    body: r.text,
    verified: true,
  }));

  return {
    average: summary.average,
    count: summary.count,
    distribution: summary.distribution,
    reviews: picked.length ? picked : REAL_REVIEWS.slice(0, 3).map((r) => ({
      author: r.name, rating: r.rating, date: '', title: '', body: r.text, verified: true,
    })),
  };
}
