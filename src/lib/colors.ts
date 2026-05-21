// Customer-facing French color labels. Product colors are stored in English
// (or mixed) in the database — we translate only at display time, never in the
// DB. Pairs with colorToCss() in lib/products.ts (CSS swatch color).

const COLOR_LABELS: Record<string, string> = {
  // Base colors
  black: 'Noir', noir: 'Noir',
  white: 'Blanc', blanc: 'Blanc',
  green: 'Vert', vert: 'Vert',
  red: 'Rouge', rouge: 'Rouge',
  blue: 'Bleu', bleu: 'Bleu',
  yellow: 'Jaune', jaune: 'Jaune',
  purple: 'Violet', violet: 'Violet',
  grey: 'Gris', gray: 'Gris', gris: 'Gris',
  gold: 'Or', or: 'Or',
  pink: 'Rose', rose: 'Rose',
  silver: 'Argent', argent: 'Argent',
  orange: 'Orange',
  coral: 'Corail', corail: 'Corail',
  graphite: 'Graphite',
  mauve: 'Mauve',
  lilac: 'Lilas', lilas: 'Lilas',
  // Compound / brand colors
  'space grey': 'Gris sidéral', 'space gray': 'Gris sidéral',
  'gris sidéral': 'Gris sidéral', 'gris sideral': 'Gris sidéral',
  'rose gold': 'Or rose', 'or rose': 'Or rose',
  midnight: 'Minuit', minuit: 'Minuit',
  'midnight blue': 'Bleu nuit', 'bleu nuit': 'Bleu nuit',
  'product red': 'Rouge', '(product)red': 'Rouge',
  'alpine green': 'Vert alpin', 'vert alpin': 'Vert alpin',
  'sierra blue': 'Bleu Sierra', 'bleu sierra': 'Bleu Sierra',
  'pacific blue': 'Bleu Pacifique', 'bleu pacifique': 'Bleu Pacifique',
  titanium: 'Titane', titane: 'Titane',
  'natural titanium': 'Titane naturel', 'titane naturel': 'Titane naturel',
  'black titanium': 'Titane noir', 'titane noir': 'Titane noir',
  'white titanium': 'Titane blanc', 'titane blanc': 'Titane blanc',
  'blue titanium': 'Titane bleu', 'titane bleu': 'Titane bleu',
  'desert titanium': 'Titane désert',
};

// Translate a stored color value to a French display label.
// Unknown values fall back to the original string, capitalised word by word.
// Empty / null values return an em-dash placeholder.
export function colorLabelFr(value: string | null | undefined): string {
  if (value == null) return '—';
  const raw = String(value).trim();
  if (!raw) return '—';

  const mapped = COLOR_LABELS[raw.toLowerCase()];
  if (mapped) return mapped;

  return raw
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
