// Source UNIQUE du prix client. Règle absolue : un prix invalide
// (0, négatif, null, undefined, NaN, chaîne vide) ne doit JAMAIS s'afficher
// « 0 € ». On le traite comme « pas de prix » → le caller masque le produit
// (par défaut) ou affiche « Bientôt disponible » (non achetable).
//
// Utiliser ces helpers PARTOUT où un prix est affiché ou filtré côté client,
// pour couvrir tout le site d'un seul endroit.

// Valeur numérique du prix, ou null si invalide (≤ 0 inclus).
export function priceValue(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Un produit (ou une valeur) a-t-il un prix vendable ?
export function hasValidPrice(input: unknown): boolean {
  if (input && typeof input === 'object' && 'price' in input) {
    return priceValue((input as { price?: unknown }).price) !== null;
  }
  return priceValue(input) !== null;
}

// Prix formaté en euros FR (« 20 € » ou « 20,50 € »), ou null si invalide.
// decimals : 0 par défaut (cartes), 2 pour un montant précis.
export function formatEur(v: unknown, opts?: { decimals?: 0 | 2 }): string | null {
  const n = priceValue(v);
  if (n === null) return null;
  const d = opts?.decimals ?? 0;
  return `${n.toFixed(d).replace('.', ',')} €`;
}
