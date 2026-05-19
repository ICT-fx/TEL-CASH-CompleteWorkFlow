// Display helpers shared between the front catalog, the product detail page,
// and the admin catalog. Keep these pure — no React, no DB access.

// Normalise any stored grade value (legacy FR labels or A/B/C) to a letter.
// Used wherever we need to compare grades regardless of how they're stored.
export function normalizeGradeLetter(raw: string | null | undefined): 'A' | 'B' | 'C' | null {
  if (!raw) return null;
  const g = String(raw).toUpperCase().trim();
  if (g === 'A' || g.startsWith('PARFAIT')) return 'A';
  if (g === 'B' || g.startsWith('TRÈS BON') || g.startsWith('TRES BON') || g.startsWith('BON ')) return 'B';
  if (g === 'C' || g.includes('CORRECT') || g.includes('ÉTAT CORRECT')) return 'C';
  if (g.startsWith('A')) return 'A';
  if (g.startsWith('B') || g.startsWith('C+')) return 'B';
  if (g.startsWith('C')) return 'C';
  return null;
}

// Customer-facing label for each canonical grade letter.
export function gradeLabelFr(g: string | null | undefined): string {
  const letter = normalizeGradeLetter(g);
  if (letter === 'A') return 'Parfait État';
  if (letter === 'B') return 'Très Bon État';
  if (letter === 'C') return 'État Correct';
  return 'Inconnu';
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
