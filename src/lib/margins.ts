// Logique pure des marges — aucune dépendance React/DB, entièrement testable.
import { displayGrade, type DisplayGrade } from './products';

export type ScopeLevel = 'global' | 'brand' | 'model' | 'product';
export type MarginType = 'percent' | 'fixed' | 'combined';
export type Rounding = 'cent' | 'decicent' | 'euro' | 'five_euro' | 'ten_euro' | 'ends_99';

// Arrondit une valeur selon le mode choisi.
export function applyRounding(value: number, mode: Rounding): number {
  if (!Number.isFinite(value)) return 0;
  switch (mode) {
    case 'cent':
      return Math.round(value * 100) / 100;
    case 'decicent':
      return Math.round(value * 1000) / 1000;
    case 'euro':
      return Math.round(value);
    case 'five_euro':
      return Math.round(value / 5) * 5;
    case 'ten_euro':
      return Math.round(value / 10) * 10;
    case 'ends_99': {
      // Arrondi à l'euro le plus proche puis −0,01 → prix en X,99.
      const euros = Math.round(value);
      return Math.max(0, euros) - 0.01;
    }
  }
}
