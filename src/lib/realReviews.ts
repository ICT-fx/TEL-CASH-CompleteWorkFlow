// Avis clients RÉELS de la boutique Tel & Cash (Angers) — saisis à la main
// d'après les avis Google. Source de vérité unique, partagée par la page
// d'accueil (Reviews.tsx) et la fiche produit (ProductReviews.tsx).
//
// Pas de photos clients (non disponibles) : on affiche un avatar avec les
// initiales, jamais une fausse photo de stock.

export interface RealReview {
  id: string;
  name: string;
  rating: number; // 1–5
  text: string;
}

export const REAL_REVIEWS: RealReview[] = [
  { id: '1', name: 'Mélanie C.', rating: 5, text: "Très professionnel et patient. L'équipe a pris le temps de trouver une solution à mon problème et est même restée après la fermeture pour terminer la réparation. Un vrai sens du service, rare et précieux. Je recommande les yeux fermés !" },
  { id: '2', name: 'Stéphanie G.', rating: 5, text: "Excellent accueil et très bons conseils. Mon téléphone avec l'écran cassé a été réparé à un prix très raisonnable. Une équipe jeune, dynamique et efficace. Je recommande." },
  { id: '3', name: 'Salomé P.', rating: 5, text: "Un bout de chargeur coincé dans mon téléphone, impossible à enlever seule. L'équipe de Tel & Cash l'a retiré en deux temps trois mouvements, et gratuitement ! Tout simplement magique. Je conseille cet établissement à 100%." },
  { id: '4', name: 'Eulalie D.', rating: 5, text: "J'étais complètement perdue pour l'achat d'un nouveau téléphone. L'équipe a été très à l'écoute de mes attentes et de très bon conseil. Je suis ravie de mon achat et je les recommanderai sans hésiter à mes proches." },
  { id: '5', name: 'Isaac B.', rating: 5, text: "Super expérience chez Tel & Cash à Angers ! Que ce soit pour l'achat, la vente ou la réparation, l'équipe est accueillante, rapide et très professionnelle. Les prix sont corrects et le service vraiment efficace. Je recommande sans hésiter." },
  { id: '6', name: 'Éliane C.', rating: 5, text: "J'ai fait changer la batterie de mon téléphone et j'ai été très satisfaite. Mon père a ensuite fait de même. En plus d'un travail de qualité, l'accueil est chaleureux et le personnel vraiment à l'écoute. Je recommande." },
  { id: '7', name: 'Lucas D.', rating: 5, text: "Agréablement surpris, je recommande fortement. Je suis venu faire réparer mon iPhone 13 et tout s'est passé de façon fluide et transparente. Ayant essayé d'autres boutiques avant, je ne pense pas en changer à l'avenir." },
  { id: '8', name: 'Enzo C.', rating: 5, text: "La boutique était sur le point de fermer et j'avais besoin d'une réparation en urgence. L'équipe a été très compréhensive et a tout fait pour répondre à ma demande. D'habitude je ne laisse pas d'avis, mais cette fois-ci c'était mérité. Très belle expérience." },
  { id: '9', name: 'Mendy R.', rating: 5, text: "Très bonne expérience. L'accueil est chaleureux et professionnel, on se sent tout de suite à l'aise. Le service est rapide et efficace, avec de bons conseils à la clé. Je recommande sans hésiter." },
  { id: '10', name: 'Hugo B.', rating: 5, text: "Une équipe vraiment accueillante et très professionnelle. J'ai longtemps hésité à prendre un téléphone reconditionné, mais j'ai sauté le pas les yeux fermés — et tout était parfait. Toujours de bons conseils et une vraie volonté de trouver la meilleure solution. Je recommande à 100%." },
];

// Initiales pour l'avatar (ex. « Mélanie C. » → « MC »).
export function reviewInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// Couleur d'avatar stable, dérivée du nom (palette charte bleu/vert/navy).
const AVATAR_BG = ['#2F6BFF', '#0B1437', '#16A34A', '#0e7490', '#4B7BFF', '#1e3a8a'];
export function reviewAvatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_BG[h % AVATAR_BG.length];
}

export interface RealReviewSummary {
  average: number;
  count: number;
  distribution: number[]; // [5★,4★,3★,2★,1★]
}

export function getRealReviewSummary(): RealReviewSummary {
  const count = REAL_REVIEWS.length;
  const sum = REAL_REVIEWS.reduce((a, r) => a + r.rating, 0);
  const distribution = [5, 4, 3, 2, 1].map((s) => REAL_REVIEWS.filter((r) => r.rating === s).length);
  return { average: Math.round((sum / count) * 10) / 10, count, distribution };
}

// Sous-ensemble stable d'avis pour une fiche (déterministe par modèle, mais
// toujours de VRAIS avis — pas de fabrication).
export function pickRealReviews(seed: string, n = 3): RealReview[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const start = (h >>> 0) % REAL_REVIEWS.length;
  return Array.from({ length: Math.min(n, REAL_REVIEWS.length) }, (_, i) => REAL_REVIEWS[(start + i) % REAL_REVIEWS.length]);
}
