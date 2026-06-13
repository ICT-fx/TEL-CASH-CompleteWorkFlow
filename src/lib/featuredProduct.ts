// Shared loader for the homepage "featured product" — powers the
// "Le choix de l'excellence" (BestSeller) block.
//
// SELECTION LOGIC (automatic):
//   Candidates = active products (is_active = true), brand "Apple",
//                model containing "iPhone".
//   1. Among candidates that HAVE a grade set (grade not null/empty),
//      take the one with the most stock — its model is featured. This
//      guarantees a real grade is displayed in the showcase.
//   2. Fallback: if no graded iPhone exists, take the active iPhone with
//      the most stock. The grade will appear once the Supabase data is
//      reconciled.
// Once a model is picked, ALL its active SKUs are returned so BestSeller
// can build the full variant matrix (colors / storages / grades).
//
// MANUAL OVERRIDE: set FEATURED_OVERRIDE to { brand, model } to force a
// specific model. Leave it null to keep automatic selection.

import type { RawProduct } from './productVariants';

// Vedette « Le choix de l'excellence » : iPhone 14 — best-seller (gros stock),
// récent, et surtout couverture photo COMPLÈTE (ses 6 couleurs ont toutes un vrai
// packshot relié à la couleur, zéro placeholder). On force ce modèle plutôt que
// le « plus de stock » automatique (qui tombait sur l'iPhone SE 2022, aux photos
// incomplètes). Pour changer la vedette, garder un modèle à couverture complète.
const FEATURED_OVERRIDE: { brand: string; model: string } | null = { brand: 'Apple', model: 'iPhone 14' };

export interface FeaturedProduct {
  brand: string;
  model: string;
  skus: RawProduct[];
}

function stockOf(p: RawProduct): number {
  return Number(p.stock) || 0;
}

function isActiveAppleIphone(p: RawProduct): boolean {
  return (
    p.is_active === true &&
    (p.brand || '').trim().toLowerCase() === 'apple' &&
    (p.model || '').toLowerCase().includes('iphone')
  );
}

function hasGrade(p: RawProduct): boolean {
  return p.grade != null && String(p.grade).trim() !== '';
}

export async function loadFeaturedProduct(): Promise<FeaturedProduct | null> {
  try {
    const res = await fetch('/api/products?limit=all');
    if (!res.ok) return null;
    const all: RawProduct[] = (await res.json()).products || [];

    // Manual override — use it if the model exists, else fall through.
    if (FEATURED_OVERRIDE) {
      const skus = all.filter(
        (p) =>
          p.is_active &&
          (p.brand || '').trim().toLowerCase() === FEATURED_OVERRIDE.brand.toLowerCase() &&
          (p.model || '').trim().toLowerCase() === FEATURED_OVERRIDE.model.toLowerCase(),
      );
      if (skus.length > 0) {
        return { brand: FEATURED_OVERRIDE.brand, model: FEATURED_OVERRIDE.model, skus };
      }
    }

    // Automatic selection.
    const iphones = all.filter(isActiveAppleIphone);
    if (iphones.length === 0) return null;

    const graded = iphones.filter(hasGrade);
    const pool = graded.length > 0 ? graded : iphones;

    // Highest-stock candidate decides the featured model.
    const winner = [...pool].sort((a, b) => stockOf(b) - stockOf(a))[0];
    const brand = (winner.brand || 'Apple').trim();
    const model = (winner.model || '').trim();

    // Return every active SKU of that model for the variant matrix.
    const skus = all.filter(
      (p) =>
        p.is_active &&
        (p.brand || '').trim() === brand &&
        (p.model || '').trim() === model,
    );

    return { brand, model, skus };
  } catch {
    return null;
  }
}
