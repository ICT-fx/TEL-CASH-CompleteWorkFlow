// Display helpers shared between the front catalog, the product detail page,
// and the admin catalog. Keep these pure — no React, no DB access.

// ── Source unique de vérité des grades ───────────────────────────────────────
// 6 paliers, ordonnés du MEILLEUR au PIRE. Le « + » = un cran au-dessus de la
// lettre (A+ > A > B+ > B > C+ > C). Toute la logique de grade (ingestion,
// affichage, admin) doit dériver de ce tableau — ne pas recoder ['A','B','C']
// en dur ailleurs.
export type GradeLetter = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'E';

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
  { letter: 'D',  label: 'Mauvais état',        sub: 'Usure importante',          battery: 82 },
  { letter: 'E',  label: 'Très mauvais état',   sub: 'Défauts marqués',           battery: 79 },
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

  // Lettres canoniques avec «+» éventuel (gère "A +", "GRADE B+", "AB"→A,
  // "BC"→B, "CD"→C : on garde la 1ʳᵉ lettre A/B/C).
  const m = g.match(/\b(?:GRADE\s*)?([ABC])\s*(\+)?/);
  if (m) {
    const letter = `${m[1]}${m[2] ? '+' : ''}` as GradeLetter;
    if (GRADE_BY_LETTER[letter]) return letter;
  }

  // Grades Foxway D et E = mauvais états, CONSERVÉS tels quels (paliers à part
  // entière). Les produits D/E sont désactivés d'office à l'import (jamais publiés).
  const de = g.match(/\b(?:GRADE\s*)?([DE])\b/);
  if (de) return de[1] as GradeLetter;

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

// ── Affichage CLIENT : 3 grades consolidés (A / B / C) ───────────────────────
// La boutique ne montre QUE 3 états. Les sous-grades techniques de l'ingestion
// (A+, B+, C+) et les paliers internes (D/E, désactivés à l'import) sont REPLIÉS
// ici — UNIQUEMENT pour le front client. L'ingestion / l'admin / Fluxitron
// conservent les 6+2 paliers via normalizeGrade(). Ne PAS toucher à ça.
//   A+ , A           → A « Comme neuf »     (batterie ≥ 100 %)
//   B+ , B           → B « Très bon état »  (batterie ≥ 92 %)
//   C+ , C , D , E   → C « État correct »   (batterie ≥ 85 %)
export type DisplayGrade = 'A' | 'B' | 'C';

export interface DisplayGradeMeta {
  letter: DisplayGrade;
  badge: string;   // symbole court pour les médaillons étroits (A / B / C)
  label: string;
  sub: string;
  battery: number; // minimum garanti (%)
}

export const DISPLAY_GRADES: DisplayGradeMeta[] = [
  { letter: 'A', badge: 'A', label: 'Comme neuf',    sub: "Aucune trace d'usure",     battery: 100 },
  { letter: 'B', badge: 'B', label: 'Très bon état', sub: 'Micro-rayures discrètes',  battery: 92 },
  { letter: 'C', badge: 'C', label: 'État correct',  sub: 'Traces visibles assumées', battery: 85 },
];

export const DISPLAY_GRADE_ORDER: DisplayGrade[] = ['A', 'B', 'C'];

const DISPLAY_GRADE_BY_LETTER: Record<DisplayGrade, DisplayGradeMeta> = DISPLAY_GRADES.reduce(
  (acc, g) => ({ ...acc, [g.letter]: g }),
  {} as Record<DisplayGrade, DisplayGradeMeta>
);

// Replie n'importe quelle valeur de grade vers l'un des 3 grades client.
// S'appuie sur normalizeGrade (qui gère lettres + libellés FR legacy).
export function displayGrade(raw: string | null | undefined): DisplayGrade | null {
  const g = normalizeGrade(raw);
  if (!g) return null;
  if (g === 'A+' || g === 'A') return 'A';
  if (g === 'B+' || g === 'B') return 'B';
  return 'C'; // C+, C, D, E
}

export function displayGradeMeta(raw: string | null | undefined): DisplayGradeMeta | null {
  const L = displayGrade(raw);
  return L ? DISPLAY_GRADE_BY_LETTER[L] : null;
}

// Libellé client (« Comme neuf » / « Très bon état » / « État correct »).
export function displayGradeLabelFr(raw: string | null | undefined): string {
  return displayGradeMeta(raw)?.label ?? 'Inconnu';
}

// Map French/English color names to a CSS color for the swatch dot.
// Falls back to a neutral slate if the color isn't in the dictionary.
// Mapping nom de couleur → code CSS pour la pastille. Couvre iPhone, Samsung,
// Pixel, Xiaomi, OnePlus (noms FR + EN + marketing). Un repli par MOT-CLÉ
// (contains) garantit qu'une couleur inconnue reçoit toujours une teinte
// plausible — jamais une pastille « blanche » (bug iPhone 17 Pro « Orange »).
const COLOR_CSS: Record<string, string> = {
  'noir': '#0a0a0a', 'black': '#0a0a0a',
  'jet black': '#080808', 'noir intense': '#080808', 'space black': '#1c1c1e', 'noir sidéral': '#1c1c1e',
  'phantom black': '#0c0c0c', 'obsidian': '#0b0b0d', 'midnight black': '#0a0a0a',
  'blanc': '#f1f5f9', 'white': '#f1f5f9', 'porcelain': '#f3efe9', 'snow': '#f4f6f8', 'ceramic white': '#f3f4f6',
  'gris': '#94a3b8', 'gray': '#94a3b8', 'grey': '#94a3b8', 'space gray': '#4b5563', 'space grey': '#4b5563',
  'gris sidéral': '#4b5563', 'graphite': '#374151', 'titanium gray': '#6b7280', 'hazel': '#6f6a5f',
  'argent': '#cbd5e1', 'silver': '#cbd5e1', 'platinum': '#d4d7dc',
  'or': '#d4af37', 'gold': '#d4af37', 'or rose': '#e8b4b8', 'rose gold': '#e8b4b8',
  'bleu': '#3b82f6', 'blue': '#3b82f6', 'bleu nuit': '#1e3a8a', 'midnight': '#1e293b', 'minuit': '#1e293b',
  'midnight blue': '#1e3a8a', 'navy': '#1e3a8a', 'deep blue': '#1e3a8a', 'bleu intense': '#1e3a8a',
  'sierra blue': '#60a5fa', 'bleu sierra': '#60a5fa', 'pacific blue': '#0e7490', 'bleu pacifique': '#0e7490',
  'ice blue': '#bcdcec', 'bleu glacier': '#bcdcec', 'sky blue': '#7dd3fc', 'light blue': '#93c5fd',
  'ultramarine': '#5860c2', 'cobalt': '#3a4cc0', 'bay': '#7aa5d2',
  'rouge': '#ef4444', 'red': '#ef4444', 'product red': '#dc2626', '(product)red': '#dc2626',
  'vert': '#22c55e', 'green': '#22c55e', 'vert alpin': '#166534', 'alpine green': '#166534',
  'midnight green': '#0c3b32', 'vert nuit': '#0c3b32', 'sage': '#9aa886', 'mint': '#a7e8c8', 'menthe': '#a7e8c8',
  'aloe': '#c7d6b8', 'lemongrass': '#c9d6a0', 'lime': '#bef264', 'vert citron': '#bef264', 'emerald': '#10b981',
  'jaune': '#eab308', 'yellow': '#eab308', 'gold yellow': '#f5c542',
  'violet': '#8b5cf6', 'purple': '#8b5cf6', 'deep purple': '#5b21b6', 'mauve': '#a78bfa', 'lilas': '#c4b5fd',
  'lavender': '#c4b5fd', 'lavande': '#c4b5fd', 'lilac': '#c4b5fd', 'peony': '#e8a0c8',
  'rose': '#ec4899', 'pink': '#ec4899', 'rose quartz': '#f0c4d4', 'cotton pink': '#f4c2d0',
  'corail': '#fb7185', 'coral': '#fb7185',
  'orange': '#f97316', 'cosmic orange': '#f25b1e', 'orange cosmique': '#f25b1e', 'sunset': '#fb923c',
  'beige': '#d9c7a8', 'desert titanium': '#b78b5a', 'titane désert': '#b78b5a', 'desert': '#c9a06a',
  'starlight': '#f5f0e6', 'lumière stellaire': '#f5f0e6', 'cream': '#f1e9d6', 'crème': '#f1e9d6',
  'brown': '#92400e', 'marron': '#92400e', 'bronze': '#a97142',
  'teal': '#0ea5b7', 'bleu canard': '#0ea5b7', 'cyan': '#06b6d4',
  'titane': '#9ca3af', 'titanium': '#9ca3af', 'titane naturel': '#a3a3a3', 'natural titanium': '#a3a3a3',
  'titane noir': '#1f2937', 'black titanium': '#1f2937',
  'titane blanc': '#e5e7eb', 'white titanium': '#e5e7eb',
  'titane bleu': '#1e40af', 'blue titanium': '#1e40af',
};

// Repli par mot-clé : si le nom exact est inconnu, on cherche une teinte de base
// par sous-chaîne (« cosmic orange » → orange). Ordonné du + spécifique au + large.
const COLOR_KEYWORDS: [string, string][] = [
  ['jet black', '#080808'], ['space black', '#1c1c1e'], ['titanium', '#9ca3af'],
  ['orange', '#f97316'], ['rose gold', '#e8b4b8'], ['rose', '#ec4899'], ['pink', '#ec4899'],
  ['midnight', '#1e293b'], ['navy', '#1e3a8a'], ['sierra', '#60a5fa'], ['ice', '#bcdcec'],
  ['blue', '#3b82f6'], ['bleu', '#3b82f6'],
  ['mint', '#a7e8c8'], ['sage', '#9aa886'], ['lime', '#bef264'], ['green', '#22c55e'], ['vert', '#22c55e'],
  ['purple', '#8b5cf6'], ['violet', '#8b5cf6'], ['lavender', '#c4b5fd'], ['mauve', '#a78bfa'],
  ['red', '#ef4444'], ['rouge', '#ef4444'], ['yellow', '#eab308'], ['jaune', '#eab308'],
  ['gold', '#d4af37'], ['beige', '#d9c7a8'], ['desert', '#b78b5a'], ['brown', '#92400e'], ['bronze', '#a97142'],
  ['silver', '#cbd5e1'], ['argent', '#cbd5e1'], ['graphite', '#374151'],
  ['grey', '#94a3b8'], ['gray', '#94a3b8'], ['gris', '#94a3b8'],
  ['black', '#0a0a0a'], ['noir', '#0a0a0a'], ['white', '#f1f5f9'], ['blanc', '#f1f5f9'], ['starlight', '#f5f0e6'],
  ['teal', '#0ea5b7'],
];

// Map French/English color names to a CSS color for the swatch dot.
// Falls back to a keyword guess, then a neutral slate as a last resort.
export function colorToCss(name: string): string {
  const n = (name || '').toLowerCase().trim();
  if (!n) return '#e2e8f0';
  if (COLOR_CSS[n]) return COLOR_CSS[n];
  for (const [kw, css] of COLOR_KEYWORDS) {
    if (n.includes(kw)) return css;
  }
  return '#e2e8f0';
}

// Slugify a model name for URL or React keys.
export function modelSlug(brand: string, model: string): string {
  return `${brand}-${model}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
