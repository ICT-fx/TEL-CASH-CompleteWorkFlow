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
}

type AdminDb = ReturnType<typeof createAdminClient>;

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
      .select('id, brand, model, storage_capacity, color, grade, price, compare_at_price, is_active')
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
// (modèle, stockage, grade affiché A/B/C), avec prix/compare_at partagés et un
// drapeau `active` (≥ 1 SKU actif) pour le filtre activés/désactivés.
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const db = createAdminClient();
  const rows = await fetchTelephoneRows(db);

  // Clé de groupe = model | storage normalisé | grade affiché.
  const map = new Map<string, {
    brand: string; model: string; storage: string | null; grade: DisplayGrade;
    prices: number[]; compareAts: number[]; active: boolean;
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
        prices: [], compareAts: [], active: false,
      };
      map.set(key, grp);
    }
    grp.prices.push(num(r.price));
    if (r.compare_at_price != null) grp.compareAts.push(num(r.compare_at_price));
    if (r.is_active) grp.active = true;
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

// ── Corps de la requête PUT : prix d'une ligne (modèle, stockage) ────────────
type PutBody = {
  kind: 'rowPrices';
  model: string;
  storage: string | null;
  prices: Array<{ grade: DisplayGrade; price: number; compare_at_price?: number | null }>;
};

// PUT /api/admin/prix — écrit les prix des grades fournis pour une ligne
// (modèle, stockage). Résout TOUS les SKU couleur (actifs ET inactifs, pour
// pouvoir tarifer un modèle désactivé), puis 1 seul bulk_update_prices.
export async function PUT(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = (await request.json().catch(() => null)) as PutBody | null;
  if (!body || body.kind !== 'rowPrices' || !body.model || !Array.isArray(body.prices) || body.prices.length === 0) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const db = createAdminClient();

  // Tous les SKU téléphone du modèle (couleurs + stockages + grades confondus).
  // On filtre ensuite en JS sur le stockage NORMALISÉ et le grade AFFICHÉ
  // (valeurs brutes en base sales : '256 GO', 'A+'…).
  const { data: candidates, error: selErr } = await db
    .from('products')
    .select('id, storage_capacity, grade')
    .eq('category', 'telephones')
    .eq('model', body.model);
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 400 });

  const updates: Array<{ id: string; price: number; compare_at_price?: number | null }> = [];
  for (const entry of body.prices) {
    const price = Number(entry.price);
    if (!entry.grade || !Number.isFinite(price) || price < 0) continue;
    const hasCap = entry.compare_at_price !== undefined;
    const cap = hasCap && entry.compare_at_price != null ? Number(entry.compare_at_price) : null;

    const ids = (candidates ?? [])
      .filter((c) =>
        normalizeStorage(c.storage_capacity as string | null) === body.storage &&
        displayGrade(c.grade as string | null) === entry.grade
      )
      .map((c) => c.id as string);

    for (const id of ids) {
      const payload: { id: string; price: number; compare_at_price?: number | null } = { id, price };
      if (hasCap) payload.compare_at_price = cap;
      updates.push(payload);
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'Aucune ligne pour cette saisie' }, { status: 404 });
  }

  const { error: rpcErr } = await db.rpc('bulk_update_prices', { updates });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 400 });

  return NextResponse.json({ updated: updates.length, grades: body.prices.length });
}
