import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { displayGrade, DISPLAY_GRADE_ORDER, type DisplayGrade } from '@/lib/products';
import { normalizeStorage } from '@/lib/productVariants';

// ── Types de réponse (consommés par src/app/admin/prix/page.tsx) ─────────────
export interface PrixColorStock {
  color: string | null;
  productId: string;
  stock: number;
}
export interface PrixGroup {
  model: string;
  brand: string;
  storage: string | null;          // null = pas de stockage (ex. S25 Ultra)
  grade: DisplayGrade;             // 'A' | 'B' | 'C'
  price: number;                   // prix partagé du (modèle, stockage, grade)
  compareAtPrice: number | null;   // prix barré partagé (ou null)
  colors: PrixColorStock[];        // détail stock par couleur
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
  stock: number | null;
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

// PostgREST plafonne chaque requête à ~1000 lignes : on pagine comme
// fetchAllProductRows() dans margins-db.ts (ORDER BY id déterministe).
const PAGE = 1000;
async function fetchActiveTelephoneRows(db: AdminDb): Promise<Row[]> {
  const all: Row[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await db
      .from('products')
      .select('id, brand, model, storage_capacity, color, grade, price, compare_at_price, stock')
      .eq('is_active', true)
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
// Regroupe le catalogue téléphone actif en une entrée par (modèle, stockage,
// grade affiché A/B/C), avec prix/compare_at partagés + stock par couleur.
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const db = createAdminClient();
  const rows = await fetchActiveTelephoneRows(db);

  // Clé de groupe = model | storage normalisé | grade affiché.
  const map = new Map<string, {
    brand: string; model: string; storage: string | null; grade: DisplayGrade;
    prices: number[]; compareAts: number[];
    colors: Map<string, PrixColorStock>;
  }>();

  for (const r of rows) {
    const model = (r.model ?? '').trim();
    if (!model) continue;
    const g = displayGrade(r.grade);
    if (!g) continue; // grade illisible/null → exclu ; D/E eux sont exclus en amont par trg_grade_de_inactive + is_active=true
    const storage = normalizeStorage(r.storage_capacity);
    const key = `${model.toLowerCase()}|${storage ?? ''}|${g}`;

    let grp = map.get(key);
    if (!grp) {
      grp = {
        brand: (r.brand ?? '').trim(), model, storage, grade: g,
        prices: [], compareAts: [], colors: new Map(),
      };
      map.set(key, grp);
    }
    grp.prices.push(num(r.price));
    if (r.compare_at_price != null) grp.compareAts.push(num(r.compare_at_price));

    // Une entrée stock par couleur. Pré-migration plusieurs lignes peuvent
    // partager une couleur : on garde la 1re (ORDER BY id) et on somme le stock.
    const colorKey = r.color ?? '';
    const existing = grp.colors.get(colorKey);
    if (existing) {
      existing.stock += num(r.stock);
    } else {
      grp.colors.set(colorKey, { color: r.color, productId: r.id, stock: num(r.stock) });
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
    colors: Array.from(grp.colors.values()).sort((a, b) =>
      (a.color ?? '').localeCompare(b.color ?? '')
    ),
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

// ── Corps de la requête PUT (discriminé par `kind`) ──────────────────────────
type PutBody =
  | { kind: 'price'; model: string; storage: string | null; grade: DisplayGrade; price: number; compare_at_price?: number | null }
  | { kind: 'stock'; productId: string; stock: number };

// PUT /api/admin/prix
//  - kind:'price' → résout TOUS les ids couleur actifs du (modèle, stockage,
//    grade) puis écrit price (+compare_at) en masse via bulk_update_prices.
//  - kind:'stock' → update stock sur un seul productId.
export async function PUT(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = (await request.json().catch(() => null)) as PutBody | null;
  if (!body || (body.kind !== 'price' && body.kind !== 'stock')) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const db = createAdminClient();

  if (body.kind === 'stock') {
    if (!body.productId || !Number.isFinite(Number(body.stock))) {
      return NextResponse.json({ error: 'productId/stock invalides' }, { status: 400 });
    }
    const stock = Math.max(0, Math.trunc(Number(body.stock)));
    const { error } = await db
      .from('products')
      .update({ stock, updated_at: new Date().toISOString() })
      .eq('id', body.productId)
      .eq('category', 'telephones');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ updated: 1 });
  }

  // kind === 'price'
  const price = Number(body.price);
  if (!body.model || !body.grade || !Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: 'model/grade/price invalides' }, { status: 400 });
  }
  const hasCap = body.compare_at_price !== undefined;
  const cap = hasCap && body.compare_at_price != null ? Number(body.compare_at_price) : null;

  // Résoudre TOUS les ids couleur actifs du groupe. On filtre côté SQL sur
  // model + is_active + catégorie, puis côté JS sur le stockage NORMALISÉ et
  // le grade AFFICHÉ (les valeurs brutes en base sont sales : '256 GO', 'A+'…).
  const targetStorage = body.storage; // déjà normalisé côté UI (ex. '128 Go' | null)
  const { data: candidates, error: selErr } = await db
    .from('products')
    .select('id, storage_capacity, grade')
    .eq('is_active', true)
    .eq('category', 'telephones')
    .eq('model', body.model);
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 400 });

  const ids = (candidates ?? [])
    .filter((c) =>
      normalizeStorage(c.storage_capacity as string | null) === targetStorage &&
      displayGrade(c.grade as string | null) === body.grade
    )
    .map((c) => c.id as string);

  if (ids.length === 0) {
    return NextResponse.json({ error: 'Aucune ligne active pour ce groupe' }, { status: 404 });
  }

  // Écriture EN MASSE via le RPC bulk_update_prices (1 seul UPDATE serveur).
  const updates = ids.map((id) => {
    const payload: { id: string; price: number; compare_at_price?: number | null } = { id, price };
    if (hasCap) payload.compare_at_price = cap;
    return payload;
  });
  const { error: rpcErr } = await db.rpc('bulk_update_prices', { updates });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 400 });

  return NextResponse.json({ updated: ids.length });
}
