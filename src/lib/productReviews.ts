// Avis produit DÉMO — clairement identifiés comme tels dans l'UI (badge
// "exemples"). À remplacer par de vrais avis (Trustpilot / Avis vérifiés)
// avant publication. Déterministes : même modèle ↔ mêmes avis pour éviter
// que le client voie des avis différents à chaque rechargement.

export interface DemoReview {
  author: string;
  rating: number;             // 1–5
  date: string;               // déjà formaté FR
  title: string;
  body: string;
  verified: boolean;
}

export interface ProductReviewBundle {
  average: number;            // 4.0 – 5.0
  count: number;              // total affiché
  distribution: number[];     // 5 entries (5★…1★) somme = count
  reviews: DemoReview[];
}

const REVIEW_BANK: Omit<DemoReview, 'date'>[] = [
  { author: 'Léa M.',     rating: 5, title: 'Bluffée par l\'état',           body: 'Aucune trace, batterie nickel, livré en 2 jours. Le téléphone est comme neuf, je vais arrêter d\'acheter du neuf.', verified: true },
  { author: 'Karim B.',   rating: 5, title: 'Rapport qualité-prix imbattable', body: 'Économisé 350 € par rapport au neuf, et impossible de voir la différence. Tel & Cash a vraiment fait du bon boulot.', verified: true },
  { author: 'Sophie D.',  rating: 4, title: 'Très bonne expérience',         body: 'Petite micro-rayure sur le côté annoncée, rien de gênant. Très bon état général, je recommande.', verified: true },
  { author: 'Antoine R.', rating: 5, title: 'Service client au top',          body: 'Question avant achat, réponse en 1 h. Téléphone reçu impeccable. Je rachèterai sans hésiter.', verified: true },
  { author: 'Pauline T.', rating: 5, title: 'Garantie qui rassure',           body: '24 mois c\'est plus que rassurant. Le téléphone tourne nickel, batterie à 100 %, conforme à la description.', verified: true },
  { author: 'Maxime K.',  rating: 4, title: 'Bon état, bonne affaire',        body: 'Grade B comme annoncé : quelques fines rayures à la lumière, invisibles au quotidien. Je suis satisfait.', verified: true },
  { author: 'Inès L.',    rating: 5, title: 'Cadeau parfait',                 body: 'Acheté pour mon fils : il pensait avoir un neuf. Boîte premium, accessoires inclus. Super.', verified: true },
  { author: 'Bastien G.', rating: 5, title: 'Livraison express respectée',    body: 'Commandé un mardi soir, reçu le jeudi matin. Téléphone configuré, prêt à l\'emploi en 10 min. Top.', verified: true },
];

// Hash stable d'une chaîne (sans dépendance) — suffisant pour piocher des avis
// reproductibles par produit/modèle. Pas crypto, juste déterministe.
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickN<T>(arr: T[], n: number, seed: number): T[] {
  const out: T[] = [];
  const used = new Set<number>();
  let s = seed;
  while (out.length < n && used.size < arr.length) {
    s = (s * 9301 + 49297) % 233280;
    const idx = s % arr.length;
    if (used.has(idx)) continue;
    used.add(idx);
    out.push(arr[idx]);
  }
  return out;
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function fakeDate(seed: number): string {
  // Spread "il y a 1–365 jours" relative to today, seeded so it stays stable.
  const days = (seed % 365) + 1;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Build a stable review bundle for a given (model, brand). The number and
// average rating are derived from the model hash so a popular flagship
// shows more reviews than a niche one — without ever touching the DB.
export function getProductReviews(brand: string, model: string): ProductReviewBundle {
  const seed = hash(`${brand}|${model}`);
  const reviewCount = 18 + (seed % 263);             // 18 → 280
  const average = 4.4 + ((seed % 51) / 100);         // 4.40 → 4.90, rounded below

  const picked = pickN(REVIEW_BANK, 3, seed).map((r, i) => ({
    ...r,
    date: fakeDate(seed + i * 73),
  }));

  // Distribution: heavy on 5★, light tail. Deterministic.
  const five  = Math.round(reviewCount * 0.74);
  const four  = Math.round(reviewCount * 0.18);
  const three = Math.round(reviewCount * 0.05);
  const two   = Math.round(reviewCount * 0.02);
  const one   = Math.max(0, reviewCount - five - four - three - two);

  return {
    average: Math.round(average * 10) / 10,
    count:   reviewCount,
    distribution: [five, four, three, two, one],
    reviews: picked,
  };
}
