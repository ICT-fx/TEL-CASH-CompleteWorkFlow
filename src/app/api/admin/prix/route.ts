import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { displayGrade, DISPLAY_GRADE_ORDER, type DisplayGrade } from '@/lib/products';
import { normalizeStorage } from '@/lib/productVariants';

// ── Type de réponse (consommé par src/app/admin/prix/page.tsx) ───────────────
export interface PrixGroup {
  model: string;
  brand: string;
  storage: string | null;          // null = pas de stockage (ex. S25 Ultra)
  grade: DisplayGrade;             // 'A' | 'B' | 'C'
  price: number;                   // prix partagé du (modèle, stockage, grade)
  compareAtPrice: number | null;   // prix barré partagé (ou null)
  active: boolean;                 // au moins un SKU actif dans ce groupe
  priceUpdatedAt: string | null;   // ISO de la dernière mise à jour du prix (max du groupe)
  adjustPercent: number | null;    // ajustement ±X % actif sur ce groupe (products.price_adjust_pct)
}

type AdminDb = ReturnType<typeof createAdminClient>;

// Batterie minimale garantie par grade affiché → battery_health par défaut des
// variantes créées à la volée (cf. DISPLAY_GRADES dans src/lib/products.ts).
const GRADE_MIN_BATTERY: Record<DisplayGrade, number> = { A: 100, B: 92, C: 85 };

interface Row {
  id: string;
  brand: string | null;
  model: string | null;
  storage_capacity: string | null;
  color: string | null;
  grade: string | null;
  price: number | string | null;
  compare_at_price: number | string | null;
  is_active: boolean | null;
  price_updated_at: string | null;
  price_adjust_pct: number | string | null;
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

// PostgREST plafonne chaque requête à ~1000 lignes : on pagine comme
// fetchAllProductRows() dans margins-db.ts (ORDER BY id déterministe).
const PAGE = 1000;
async function fetchTelephoneRows(db: AdminDb): Promise<Row[]> {
  const all: Row[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await db
      .from('products')
      .select('id, brand, model, storage_capacity, color, grade, price, compare_at_price, is_active, price_updated_at, price_adjust_pct')
      .eq('category', 'telephones')
      .eq('source', 'manual') // grille de prix = catalogue magasin, jamais le miroir Fluxitron
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    all.push(...(data as Row[]));
    if (data.length < PAGE) break;
    from += PAGE;
    if (from > 100_000) break; // garde-fou
  }
  return all;
}

// GET /api/admin/prix
// Regroupe le catalogue téléphone (actif ET inactif) en une entrée par
// (modèle, stockage, grade affiché A/B/C), avec prix/compare_at partagés, un
// drapeau `active` (≥ 1 SKU actif) et la date de dernière mise à jour du prix.
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const db = createAdminClient();
  const rows = await fetchTelephoneRows(db);

  // Clé de groupe = model | storage normalisé | grade affiché.
  const map = new Map<string, {
    brand: string; model: string; storage: string | null; grade: DisplayGrade;
    prices: number[]; compareAts: number[]; active: boolean; priceUpdatedAt: string | null;
    adjustPercent: number | null;
  }>();

  for (const r of rows) {
    const model = (r.model ?? '').trim();
    if (!model) continue;
    const g = displayGrade(r.grade);
    if (!g) continue; // grade illisible/null ou D/E → exclu
    const storage = normalizeStorage(r.storage_capacity);
    const key = `${model.toLowerCase()}|${storage ?? ''}|${g}`;

    let grp = map.get(key);
    if (!grp) {
      grp = {
        brand: (r.brand ?? '').trim(), model, storage, grade: g,
        prices: [], compareAts: [], active: false, priceUpdatedAt: null,
        adjustPercent: null,
      };
      map.set(key, grp);
    }
    grp.prices.push(num(r.price));
    if (r.compare_at_price != null) grp.compareAts.push(num(r.compare_at_price));
    // Toutes les lignes d'un groupe portent le même pct (écrit en masse par la
    // RPC) → le premier non-null suffit.
    if (grp.adjustPercent == null && r.price_adjust_pct != null) {
      const pct = num(r.price_adjust_pct);
      if (pct !== 0) grp.adjustPercent = pct;
    }
    if (r.is_active) grp.active = true;
    if (r.price_updated_at && (!grp.priceUpdatedAt || Date.parse(r.price_updated_at) > Date.parse(grp.priceUpdatedAt))) {
      grp.priceUpdatedAt = r.price_updated_at;
    }
  }

  const groups: PrixGroup[] = Array.from(map.values()).map((grp) => ({
    brand: grp.brand,
    model: grp.model,
    storage: grp.storage,
    grade: grp.grade,
    // Prix « à partir de » = MIN (uniforme après migration → MIN == valeur unique).
    price: grp.prices.length ? Math.min(...grp.prices) : 0,
    compareAtPrice: grp.compareAts.length ? Math.min(...grp.compareAts) : null,
    active: grp.active,
    priceUpdatedAt: grp.priceUpdatedAt,
    adjustPercent: grp.adjustPercent,
  }));

  // Tri stable : modèle, puis stockage, puis grade A/B/C.
  const gradeRank = (g: DisplayGrade) => DISPLAY_GRADE_ORDER.indexOf(g);
  groups.sort((a, b) =>
    a.model.localeCompare(b.model) ||
    (a.storage ?? '').localeCompare(b.storage ?? '') ||
    gradeRank(a.grade) - gradeRank(b.grade)
  );

  return NextResponse.json({ groups });
}

// ── Corps de la requête PUT ──────────────────────────────────────────────────
// Quatre opérations, discriminées par `kind` :
//  • rowPrices    → écrit les prix d'une ligne (modèle, stockage)
//  • toggleModel  → (dés)active TOUTES les variantes d'un modèle au catalogue
//  • globalAdjust → applique ±X % sur une portée : tout le catalogue, des
//                   marques, ou des modèles précis (RPC apply_price_adjustment)
//  • globalRevert → restaure TOUTES les lignes ajustées (RPC revert_price_adjustments)
//  • commitAdjust → fige les prix ajustés d'un modèle comme nouveaux prix
//                   définitifs (sort du périmètre de « Tout revenir à la normale »)
//  • revertModel  → annule l'ajustement d'UN modèle : restaure ses prix de
//                   référence (sans toucher aux autres modèles ajustés)
type PutBody =
  | {
      kind: 'rowPrices';
      model: string;
      storage: string | null;
      prices: Array<{ grade: DisplayGrade; price: number; compare_at_price?: number | null }>;
    }
  | { kind: 'toggleModel'; model: string; active: boolean }
  | { kind: 'globalAdjust'; percent: number; brands?: string[]; models?: string[] }
  | { kind: 'globalRevert' }
  | { kind: 'commitAdjust'; model: string }
  | { kind: 'revertModel'; model: string };

// Nettoie une liste de portée (marques ou modèles) : chaînes non vides,
// dédupliquées, bornées. Retourne null si la liste est vide/absente (= pas de
// filtre sur cette dimension).
function cleanScope(v: unknown, max = 500): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = Array.from(new Set(
    v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean)
  )).slice(0, max);
  return out.length > 0 ? out : null;
}

// Bornes de l'ajustement global (la RPC re-vérifie côté SQL).
const ADJUST_MIN = -90;
const ADJUST_MAX = 200;

// Ligne candidate du modèle (sélection enrichie pour permettre le clonage).
interface Candidate {
  id: string;
  storage_capacity: string | null;
  grade: string | null;
  color: string | null;
  brand: string | null;
  model: string | null;
  warranty: string | null;
  condition_description: string | null;
  images: string[] | null;
  source: string | null;
  is_active: boolean | null;
}

// PUT /api/admin/prix — écrit les prix des grades fournis pour une ligne
// (modèle, stockage). Pour un grade DÉJÀ présent : met à jour le prix sur tous
// ses SKU couleur (bulk_update_prices). Pour un grade ABSENT : crée la variante
// pour chaque couleur du (modèle, stockage), stock 0, is_active=true (vendable
// en sell-to-order), avec le prix saisi.
export async function PUT(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = (await request.json().catch(() => null)) as PutBody | null;
  const kinds = ['rowPrices', 'toggleModel', 'globalAdjust', 'globalRevert', 'commitAdjust', 'revertModel'] as const;
  if (!body || !kinds.includes(body.kind)) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  if (body.kind !== 'globalAdjust' && body.kind !== 'globalRevert' && !body.model) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const db = createAdminClient();
  const nowIso = new Date().toISOString();

  // ── globalAdjust : ±X % sur une portée (catalogue / marques / modèles) ─────
  // Recalcule toujours depuis price_base (figé au 1er ajustement d'une ligne) →
  // changer de pourcentage n'est jamais cumulatif. Les variantes grisées
  // (prix 0) sont ignorées. Le pct appliqué est mémorisé par ligne
  // (price_adjust_pct) → plusieurs ajustements ciblés peuvent coexister.
  if (body.kind === 'globalAdjust') {
    const percent = Number(body.percent);
    if (!Number.isFinite(percent) || percent === 0 || percent < ADJUST_MIN || percent > ADJUST_MAX) {
      return NextResponse.json(
        { error: `Pourcentage invalide (attendu : entre ${ADJUST_MIN} et +${ADJUST_MAX}, non nul).` },
        { status: 400 }
      );
    }
    const rounded = Math.round(percent * 100) / 100;
    // Des modèles précis priment sur le filtre marque (déjà un sous-ensemble).
    const models = cleanScope(body.models);
    const brands = models ? null : cleanScope(body.brands);
    const { data, error } = await db.rpc('apply_price_adjustment', {
      pct: rounded, p_brands: brands, p_models: models,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ adjusted: data ?? 0, percent: rounded, appliedAt: nowIso });
  }

  // ── globalRevert : restaure toutes les lignes ajustées puis vide les bases ──
  if (body.kind === 'globalRevert') {
    const { data, error } = await db.rpc('revert_price_adjustments');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ reverted: data ?? 0 });
  }

  // ── commitAdjust : les prix ajustés du modèle deviennent DÉFINITIFS ────────
  // Le prix courant (ajusté) ne bouge pas ; on vide price_base/price_adjust_pct
  // → le modèle sort du périmètre de « Tout revenir à la normale ».
  if (body.kind === 'commitAdjust') {
    const { count, error } = await db
      .from('products')
      .update({ price_base: null, price_adjust_pct: null, updated_at: nowIso }, { count: 'exact' })
      .eq('category', 'telephones')
      .eq('source', 'manual')
      .eq('model', body.model)
      .not('price_base', 'is', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ committed: count ?? 0 });
  }

  // ── revertModel : annule l'ajustement d'un seul modèle ─────────────────────
  // Restaure price = price_base via bulk_update_prices, qui vide aussi
  // price_base/price_adjust_pct (une saisie = nouveau prix de référence).
  if (body.kind === 'revertModel') {
    const { data: rows, error: selErr } = await db
      .from('products')
      .select('id, price_base')
      .eq('category', 'telephones')
      .eq('source', 'manual')
      .eq('model', body.model)
      .not('price_base', 'is', null);
    if (selErr) return NextResponse.json({ error: selErr.message }, { status: 400 });

    const updates = (rows ?? [])
      .map((r) => ({ id: r.id as string, price: num(r.price_base) }))
      .filter((u) => u.price > 0);
    if (updates.length === 0) {
      return NextResponse.json({ error: 'Aucun ajustement actif sur ce modèle' }, { status: 404 });
    }
    const { error: rpcErr } = await db.rpc('bulk_update_prices', { updates });
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 400 });
    return NextResponse.json({ reverted: updates.length });
  }

  // ── toggleModel : (dés)active toutes les variantes du modèle au catalogue ──
  // À la réactivation, le trigger DB `trg_grade_de_inactive` re-désactive
  // automatiquement les grades D/E — comportement voulu, aucune exception ici.
  if (body.kind === 'toggleModel') {
    if (typeof body.active !== 'boolean') {
      return NextResponse.json({ error: '`active` doit être un booléen' }, { status: 400 });
    }
    const { count, error } = await db
      .from('products')
      .update({ is_active: body.active, updated_at: nowIso }, { count: 'exact' })
      .eq('category', 'telephones')
      .eq('source', 'manual') // ne jamais (dés)activer une ligne miroir Fluxitron
      .eq('model', body.model);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ toggled: count ?? 0, active: body.active });
  }

  // ── rowPrices : prix d'une ligne (modèle, stockage) ───────────────────────
  if (!Array.isArray(body.prices) || body.prices.length === 0) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  // Tous les SKU téléphone du modèle (couleurs + stockages + grades confondus).
  // On filtre ensuite en JS sur le stockage NORMALISÉ et le grade AFFICHÉ
  // (valeurs brutes en base sales : '256 GO', 'A+'…).
  const { data: candidatesRaw, error: selErr } = await db
    .from('products')
    .select('id, storage_capacity, grade, color, brand, model, warranty, condition_description, images, source, is_active')
    .eq('category', 'telephones')
    .eq('source', 'manual') // candidats = catalogue magasin (jamais le miroir Fluxitron)
    .eq('model', body.model);
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 400 });
  const candidates = (candidatesRaw ?? []) as Candidate[];

  // SKU du (modèle, stockage) ciblé, tous grades confondus → sert au clonage des
  // couleurs quand un grade doit être créé. Représentant par couleur : on
  // préfère une ligne active (images consolidées) mais on accepte une inactive.
  const siblings = candidates.filter((c) => normalizeStorage(c.storage_capacity) === body.storage);
  const repByColor = new Map<string, Candidate>();
  for (const c of siblings) {
    const ck = c.color ?? '';
    const cur = repByColor.get(ck);
    if (!cur || (!cur.is_active && c.is_active)) repByColor.set(ck, c);
  }

  const updates: Array<{ id: string; price: number; compare_at_price?: number | null }> = [];
  const inserts: Record<string, unknown>[] = [];

  for (const entry of body.prices) {
    const price = Number(entry.price);
    if (!entry.grade || !Number.isFinite(price) || price < 0) continue;
    const hasCap = entry.compare_at_price !== undefined;
    const cap = hasCap && entry.compare_at_price != null ? Number(entry.compare_at_price) : null;

    const ids = siblings
      .filter((c) => displayGrade(c.grade) === entry.grade)
      .map((c) => c.id);

    if (ids.length > 0) {
      // Grade déjà présent → mise à jour de prix en masse.
      for (const id of ids) {
        const payload: { id: string; price: number; compare_at_price?: number | null } = { id, price };
        if (hasCap) payload.compare_at_price = cap;
        updates.push(payload);
      }
    } else if (repByColor.size > 0) {
      // Grade absent → création d'une variante par couleur (clonage d'un voisin).
      for (const rep of repByColor.values()) {
        inserts.push({
          brand: rep.brand,
          model: rep.model,
          storage_capacity: rep.storage_capacity,
          color: rep.color,
          grade: entry.grade,
          battery_health: GRADE_MIN_BATTERY[entry.grade],
          warranty: rep.warranty,
          condition_description: rep.condition_description,
          images: rep.images ?? [],
          price,
          compare_at_price: cap,
          stock: 0,
          is_active: true,
          category: 'telephones',
          source: 'manual', // toujours magasin (un représentant Fluxitron ne doit pas créer de SKU miroir)
          price_updated_at: nowIso,
          updated_at: nowIso,
        });
      }
    }
  }

  if (updates.length === 0 && inserts.length === 0) {
    return NextResponse.json({ error: 'Aucune ligne pour cette saisie' }, { status: 404 });
  }

  if (updates.length > 0) {
    const { error: rpcErr } = await db.rpc('bulk_update_prices', { updates });
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 400 });
  }

  let created = 0;
  if (inserts.length > 0) {
    const { data: ins, error: insErr } = await db.from('products').insert(inserts).select('id');
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
    created = ins?.length ?? 0;
  }

  return NextResponse.json({
    updated: updates.length,
    created,
    grades: body.prices.length,
    priceUpdatedAt: nowIso,
  });
}
