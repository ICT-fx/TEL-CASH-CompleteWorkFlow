// Helper CENTRAL des URLs produit en slug SEO. TOUS les liens vers une fiche
// produit passent par productUrl() — aucune URL construite à la main ailleurs.
//
// Format : /products/<modèle>-<stockage>-<gradeLabel>-<6hex>
//   ex. /products/iphone-16-128go-tres-bon-etat-ff8604
// Le suffixe = 6 premiers caractères hex de l'UUID du SKU → unicité garantie
// sans colonne slug ni migration. La résolution se fait par PLAGE d'UUID
// (gte/lt), supportée nativement par PostgREST sur une colonne uuid.

import { displayGradeLabelFr } from '@/lib/products';
import { normalizeStorage } from '@/lib/productVariants';

export interface ProductUrlInput {
  id: string;
  // brand non utilisé dans le slug (le modèle suffit, cf. exemple) mais accepté
  // pour que les appelants passent simplement l'objet produit.
  brand?: string | null;
  model?: string | null;
  storage_capacity?: string | null;
  grade?: string | null;
  color?: string | null;
}

// Normalise un texte en token de slug : minuscules, sans accents, alphanum + tirets.
function slugify(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// 6 premiers hex de l'UUID (sans les tirets), en minuscules.
export function productSuffix(id: string): string {
  return (id || '').replace(/-/g, '').slice(0, 6).toLowerCase();
}

// Partie texte + suffixe (sans le préfixe /products/).
export function productSlug(p: ProductUrlInput): string {
  const parts: string[] = [];
  if (p.model) parts.push(slugify(p.model));

  const storage = normalizeStorage(p.storage_capacity ?? null); // "128 Go" | "2 To" | null
  if (storage) parts.push(storage.replace(/[^a-z0-9]/gi, '').toLowerCase()); // "128go"

  if (p.grade) {
    const g = slugify(displayGradeLabelFr(p.grade)); // "comme-neuf" | "tres-bon-etat" | "etat-correct"
    if (g && g !== 'inconnu') parts.push(g);
  }

  const base = parts.filter(Boolean).join('-');
  const suffix = productSuffix(p.id);
  return base ? `${base}-${suffix}` : suffix;
}

// URL complète (chemin) d'une fiche produit.
export function productUrl(p: ProductUrlInput): string {
  return `/products/${productSlug(p)}`;
}

// Extrait le suffixe 6-hex d'un segment d'URL (dernier groupe après le dernier '-').
export function suffixFromSlug(param: string): string | null {
  const seg = (param || '').split('-').pop() || '';
  return /^[0-9a-f]{6}$/i.test(seg) ? seg.toLowerCase() : null;
}

// Intervalle d'UUID couvrant tous les ids dont les 6 premiers hex == suffix.
// Permet un lookup déterministe via .gte('id', lo).lt('id', hi) sur la colonne uuid.
export function uuidRangeFromSuffix(suffix: string): { lo: string; hi: string | null } | null {
  if (!/^[0-9a-f]{6}$/i.test(suffix)) return null;
  const s = suffix.toLowerCase();
  const lo = `${s}00-0000-0000-0000-000000000000`;
  const nextNum = parseInt(s, 16) + 1;
  if (nextNum > 0xffffff) return { lo, hi: null }; // suffix === 'ffffff' : pas de borne haute
  const hiPrefix = nextNum.toString(16).padStart(6, '0');
  return { lo, hi: `${hiPrefix}00-0000-0000-0000-000000000000` };
}

// Regex UUID canonique (anciennes URLs indexées).
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
