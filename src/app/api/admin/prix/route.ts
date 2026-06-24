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
      .select('id, brand, model, storage_capacity, color, grade, price, compare_at_price, is_active, price_updated_at')
      .eq('category', 'telephones')
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
      };
      map.set(key, grp);
    }
    grp.prices.push(num(r.price));
    if (r.compare_at_price != null) grp.compareAts.push(num(r.compare_at_price));
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
// Deux opérations, discriminées par `kind` :
//  • rowPrices   → écrit les prix d'une ligne (modèle, stockage)
//  • toggleModel → (dés)active TOUTES les variantes d'un modèle au catalogue
type PutBody =
  | {
      kind: 'rowPrices';
      model: string;
      storage: string | null;
      prices: Array<{ grade: DisplayGrade; price: number; compare_at_price?: number | null }>;
    }
  | { kind: 'toggleModel'; model: string; active: boolean };

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
  if (!body || (body.kind !== 'rowPrices' && body.kind !== 'toggleModel') || !body.model) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const db = createAdminClient();
  const nowIso = new Date().toISOString();

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
          source: rep.source ?? 'manual',
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
