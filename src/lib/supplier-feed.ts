/**
 * Parsing & normalisation du Catalog Feed Fluxitron (Foxway) — logique PURE,
 * sans I/O, partagée entre le puller (/api/cron/supplier-feed) et le dry-run
 * (scripts/feed-coverage-dryrun.ts).
 *
 * Réplique EXACTE des fonctions SQL de normalisation (migration 022) côté JS,
 * pour filtrer/agréger en mémoire avec la MÊME clé canonique que la base
 * (sinon le miroir et le catalogue ne se rejoignent pas dans v_supplier_variant_stock).
 *
 * Forme réelle du feed (constatée) :
 *   title = "Samsung Galaxy S24 Ultra 5G 256GB S928B"   ← stockage DANS le titre
 *   dimensions = { Boxed, Color, Appearance, Cloud Lock, Functionality }  ← pas de storage
 * Le modèle se reconstruit : titre − marque − stockage − couleur − « DS » − code final.
 */

export interface FeedEntry {
  foxwaySku?: string;
  title?: string;
  manufacturer?: string;
  itemGroup?: string;
  grade?: string;
  dimensions?: { Color?: string; color?: string; Appearance?: string;[k: string]: unknown };
  price?: { final?: number; cost?: number; currency?: string };
  stock?: number;
  images?: string[];
}

// fn_norm_text : minuscule, espaces compactés, vide -> null.
export function normText(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).toLowerCase().replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
}

// fn_canonical_model : fn_norm_text + alias générations iPhone SE.
export function canonicalModel(raw: unknown): string | null {
  let m = normText(raw);
  if (m == null) return null;
  m = m
    .replaceAll('(2nd generation)', '2020').replaceAll('2nd generation', '2020')
    .replaceAll('(3rd generation)', '2022').replaceAll('3rd generation', '2022')
    .replaceAll('(2020)', '2020').replaceAll('(2022)', '2022');
  return m.replace(/\s+/g, ' ').trim();
}

// fn_grade_tier : A+/A->A, B+/B->B, C+/C->C ; D/E/inconnu/NULL -> null.
export function gradeTier(raw: unknown): 'A' | 'B' | 'C' | null {
  if (raw == null) return null;
  const g = String(raw).toUpperCase().replace(/\s+/g, ' ').trim();
  const m = g.match(/\b(?:GRADE\s*)?([ABC])\s*\+?/);
  return m ? (m[1] as 'A' | 'B' | 'C') : null;
}

// fn_norm_storage, à partir d'une chaîne libre (le titre) : "256GB" -> "256 Go", "1TB" -> "1 To".
export function storageFromString(s: string): string | null {
  const m = s.match(/\b(\d{1,4})\s*(go|gb|to|tb)\b/i);
  if (!m) return null;
  let gb = parseInt(m[1], 10);
  if (/to|tb/i.test(m[2])) gb *= 1024;
  if (gb <= 0) return null;
  return gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024} To` : `${gb} Go`;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Un token = code modèle Foxway (S928B, A2849, P600, C65…) — PAS "5g" ni "max/pro/plus".
const CODE_RE = /^[a-z]{1,3}\d{2,4}[a-z]?$/;

// Modèle « cœur » canonique : titre − marque − stockage − couleur − « DS » (dual sim).
export function feedModelCore(e: FeedEntry): string {
  let t = String(e?.title ?? '');
  const brand = String(e?.manufacturer ?? '');
  const color = String(e?.dimensions?.Color ?? e?.dimensions?.color ?? '');
  if (brand && t.toLowerCase().startsWith(brand.toLowerCase())) t = t.slice(brand.length);
  t = t.replace(/\b\d{1,4}\s*(gb|go|tb|to)\b/gi, ' ');                          // stockage
  if (color) t = t.replace(new RegExp(`\\b${escapeRe(color)}\\b`, 'gi'), ' ');  // couleur
  t = t.replace(/\bds\b/gi, ' ');                                               // Dual SIM
  return canonicalModel(t) ?? '';
}

// Candidats de modèle canonique : la forme complète + (si le dernier token est un
// code modèle) la forme sans ce code. Couvre "galaxy s24 ultra 5g s928b"
// → {…, "galaxy s24 ultra 5g"} sans jamais rogner "max/plus/pro/5g".
export function modelCandidates(core: string): string[] {
  const toks = core.split(' ').filter(Boolean);
  const out = [core];
  if (toks.length >= 2 && CODE_RE.test(toks[toks.length - 1])) out.push(toks.slice(0, -1).join(' '));
  return out;
}

export function feedColor(e: FeedEntry): string | null {
  const c = e?.dimensions?.Color ?? e?.dimensions?.color;
  return c ? String(c) : null;
}
