// Display helpers shared between the front catalog, the product detail page,
// and the admin catalog. Keep these pure — no React, no DB access.

// ── Source unique de vérité des grades ───────────────────────────────────────
// 6 paliers, ordonnés du MEILLEUR au PIRE. Le « + » = un cran au-dessus de la
// lettre (A+ > A > B+ > B > C+ > C). Toute la logique de grade (ingestion,
// affichage, admin) doit dériver de ce tableau — ne pas recoder ['A','B','C']
// en dur ailleurs.
export type GradeLetter = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C';

export interface GradeMeta {
  letter: GradeLetter;
  label: string;   // nom commercial affiché
  sub: string;     // sous-texte d'usure
  battery: number; // batterie « catalogue » dérivée du grade (convention d'affichage)
}

export const GRADES: GradeMeta[] = [
  { letter: 'A+', label: 'Comme neuf',          sub: "Aucune trace d'usure",      battery: 100 },
  { letter: 'A',  label: 'Excellent état',      sub: 'Traces quasi invisibles',   battery: 97 },
  { letter: 'B+', label: 'Très bon état',       sub: 'Micro-rayures discrètes',   battery: 94 },
  { letter: 'B',  label: 'Bon état',            sub: "Légères marques d'usage",   battery: 91 },
  { letter: 'C+', label: 'État correct',        sub: 'Traces visibles assumées',  battery: 88 },
  { letter: 'C',  label: 'État correct (usé)',  sub: 'Marques marquées assumées', battery: 85 },
];

// Ordre canonique (meilleur → pire) — pour trier le sélecteur / le filtre.
export const GRADE_ORDER: GradeLetter[] = GRADES.map((g) => g.letter);

const GRADE_BY_LETTER: Record<GradeLetter, GradeMeta> = GRADES.reduce(
  (acc, g) => ({ ...acc, [g.letter]: g }),
  {} as Record<GradeLetter, GradeMeta>
);

// Normalise n'importe quelle valeur stockée (lettres avec/sans «+», libellés FR
// legacy) vers l'un des 6 grades canoniques. Renvoie null si non reconnu.
export function normalizeGrade(raw: string | null | undefined): GradeLetter | null {
  if (!raw) return null;
  const g = String(raw).toUpperCase().replace(/\s+/g, ' ').trim();

  // Lettres canoniques avec «+» éventuel (gère "A +", "GRADE B+", etc.)
  const m = g.match(/\b(?:GRADE\s*)?([ABC])\s*(\+)?/);
  if (m) {
    const letter = `${m[1]}${m[2] ? '+' : ''}` as GradeLetter;
    if (GRADE_BY_LETTER[letter]) return letter;
  }

  // Libellés FR legacy (anciens produits saisis à la main)
  if (g.startsWith('PARFAIT') || g.startsWith('EXCELLENT')) return 'A';
  if (g.startsWith('TRÈS BON') || g.startsWith('TRES BON')) return 'B+';
  if (g.startsWith('BON ') || g === 'BON') return 'B';
  if (g.includes('CORRECT')) return 'C';
  return null;
}

// Compat : ancien nom. Renvoie désormais un grade complet (avec «+»).
export function normalizeGradeLetter(raw: string | null | undefined): GradeLetter | null {
  return normalizeGrade(raw);
}

// Métadonnées (libellé / sous-texte / batterie) d'un grade. Tolère le brut.
export function gradeMeta(g: string | null | undefined): GradeMeta | null {
  const letter = normalizeGrade(g);
  return letter ? GRADE_BY_LETTER[letter] : null;
}

// Customer-facing label for each canonical grade.
export function gradeLabelFr(g: string | null | undefined): string {
  return gradeMeta(g)?.label ?? 'Inconnu';
}

// Map French/English color names to a CSS color for the swatch dot.
// Falls back to a neutral slate if the color isn't in the dictionary.
export function colorToCss(name: string): string {
  const n = name.toLowerCase().trim();
  const map: Record<string, string> = {
    'noir': '#0a0a0a', 'black': '#0a0a0a',
    'blanc': '#f8fafc', 'white': '#f8fafc',
    'gris': '#94a3b8', 'gray': '#94a3b8', 'grey': '#94a3b8', 'space gray': '#4b5563', 'gris sidéral': '#4b5563',
    'argent': '#cbd5e1', 'silver': '#cbd5e1',
    'or': '#d4af37', 'gold': '#d4af37', 'or rose': '#e8b4b8', 'rose gold': '#e8b4b8',
    'bleu': '#3b82f6', 'blue': '#3b82f6', 'bleu nuit': '#1e3a8a', 'midnight': '#1e3a8a', 'minuit': '#1e3a8a',
    'rouge': '#ef4444', 'red': '#ef4444', 'product red': '#dc2626',
    'vert': '#22c55e', 'green': '#22c55e', 'vert alpin': '#166534', 'alpine green': '#166534',
    'jaune': '#eab308', 'yellow': '#eab308',
    'violet': '#8b5cf6', 'purple': '#8b5cf6', 'mauve': '#a78bfa', 'lilas': '#c4b5fd',
    'rose': '#ec4899', 'pink': '#ec4899',
    'corail': '#fb7185', 'coral': '#fb7185',
    'titane': '#9ca3af', 'titanium': '#9ca3af', 'titane naturel': '#a3a3a3', 'natural titanium': '#a3a3a3',
    'titane noir': '#1f2937', 'black titanium': '#1f2937',
    'titane blanc': '#e5e7eb', 'white titanium': '#e5e7eb',
    'titane bleu': '#1e40af', 'blue titanium': '#1e40af',
    'graphite': '#374151',
    'sierra blue': '#60a5fa', 'bleu sierra': '#60a5fa',
    'pacific blue': '#0e7490', 'bleu pacifique': '#0e7490',
  };
  return map[n] || '#e2e8f0';
}

// Slugify a model name for URL or React keys.
export function modelSlug(brand: string, model: string): string {
  return `${brand}-${model}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
