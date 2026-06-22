# Refonte page admin « Prix » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refaire l'écran admin `/admin/prix` (renommé « Prix ») : tableau compact, lignes fines, filtre marque + filtre statut, un seul bouton « Appliquer » par ligne de stockage qui écrit les prix grade A/B/C d'un coup, prix barré discret, stock retiré.

**Architecture:** Le prix est stocké brut sur chaque SKU `products.price` ; les catalogues magasin et client le lisent directement (cascade automatique, pas de table de prix séparée). L'API GET regroupe les SKU téléphone par `(modèle, stockage, grade affiché)` et inclut désormais les modèles désactivés (drapeau `active`). Un nouveau PUT `kind:'rowPrices'` résout tous les SKU d'une ligne `(modèle, stockage)` pour les grades fournis et fait un seul `bulk_update_prices`. La page React filtre côté client et rend une carte par modèle.

**Tech Stack:** Next.js 15 App Router (route handlers + client component), Supabase admin client, RPC `bulk_update_prices`, TypeScript, styles inline (cohérent avec l'existant).

## Global Constraints

- UI 100 % en français (textes, libellés, messages d'erreur).
- Pas de test runner dans ce repo : la vérification se fait via `npx tsc --noEmit --skipLibCheck` (le `npm run lint` est cassé — cf. mémoire) + vérif manuelle en dev.
- Grades affichés : `'A' | 'B' | 'C'` via `displayGrade()` ; les grades D/E sont exclus en amont (`displayGrade` renvoie `null`).
- Stockage normalisé via `normalizeStorage()` (valeurs brutes en base sales : `'256 GO'`…).
- Écriture des prix uniquement via le RPC `bulk_update_prices` (1 seul UPDATE serveur).
- Route inchangée : `/admin/prix`. Catégorie ciblée : `category = 'telephones'`.
- Toutes les routes `/api/admin/*` passent par `requireAdmin()`.

---

### Task 1: API GET — inclure les modèles désactivés + drapeau `active`, retirer le stock

**Files:**
- Modify: `src/app/api/admin/prix/route.ts` (types `PrixGroup`/`PrixColorStock`, `Row`, `fetchActiveTelephoneRows`, `GET`)

**Interfaces:**
- Produces: type `PrixGroup` (consommé par la page en Task 3) :
  ```ts
  export interface PrixGroup {
    model: string;
    brand: string;
    storage: string | null;        // normalisé | null
    grade: DisplayGrade;           // 'A' | 'B' | 'C'
    price: number;                 // MIN des SKU du groupe
    compareAtPrice: number | null; // prix barré partagé
    active: boolean;               // au moins un SKU actif dans le groupe
  }
  ```
- `GET /api/admin/prix` → `{ groups: PrixGroup[] }`, trié modèle → stockage → grade.

- [ ] **Step 1: Remplacer les types de réponse et l'interface Row**

Dans `src/app/api/admin/prix/route.ts`, remplacer le bloc des types `PrixColorStock` + `PrixGroup` (≈ lignes 7-21) par :

```ts
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
```

Et ajouter `is_active` à l'interface `Row` (≈ lignes 25-35) :

```ts
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
```

(Le champ `stock` est retiré de `Row` : la page ne gère plus le stock.)

- [ ] **Step 2: Récupérer aussi les SKU inactifs**

Renommer `fetchActiveTelephoneRows` en `fetchTelephoneRows`, retirer le filtre `is_active`, sélectionner `is_active` au lieu de `stock` :

```ts
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
```

- [ ] **Step 3: Réécrire le corps de GET (groupement sans stock, avec `active`)**

Remplacer tout le corps de `export async function GET()` par :

```ts
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
```

- [ ] **Step 4: Vérifier la compilation**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS (aucune erreur). Note : la page `page.tsx` importe encore `PrixColorStock` (supprimé) — elle sera réécrite en Task 3 ; si tsc remonte cette erreur d'import dans `page.tsx`, c'est attendu et résolu en Task 3. Le fichier `route.ts` lui-même doit compiler.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/prix/route.ts
git commit -m "feat(admin/prix): GET inclut modèles désactivés + drapeau active, retire le stock

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: API PUT — écriture groupée des prix d'une ligne `(modèle, stockage)`

**Files:**
- Modify: `src/app/api/admin/prix/route.ts` (type `PutBody`, fonction `PUT`)

**Interfaces:**
- Consumes: `PrixGroup` (Task 1), helpers `displayGrade`, `normalizeStorage`, RPC `bulk_update_prices`.
- Produces: contrat PUT consommé par la page (Task 3) :
  ```ts
  type PutBody = {
    kind: 'rowPrices';
    model: string;
    storage: string | null;
    prices: Array<{ grade: DisplayGrade; price: number; compare_at_price?: number | null }>;
  };
  // réponse succès : { updated: number; grades: number }
  // réponse erreur : { error: string } (status 400/404)
  ```

- [ ] **Step 1: Remplacer le type `PutBody`**

Remplacer le bloc `type PutBody = …` (≈ lignes 137-139) par :

```ts
// ── Corps de la requête PUT : prix d'une ligne (modèle, stockage) ────────────
type PutBody = {
  kind: 'rowPrices';
  model: string;
  storage: string | null;
  prices: Array<{ grade: DisplayGrade; price: number; compare_at_price?: number | null }>;
};
```

- [ ] **Step 2: Réécrire la fonction PUT**

Remplacer entièrement `export async function PUT(request: Request) { … }` par :

```ts
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
```

- [ ] **Step 3: Vérifier la compilation de route.ts**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: `route.ts` compile. (Erreurs d'import résiduelles uniquement dans `page.tsx`, résolues en Task 3.)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/prix/route.ts
git commit -m "feat(admin/prix): PUT rowPrices écrit les prix A/B/C d'une ligne en 1 requête

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Page UI — refonte « Prix » (filtres, cartes modèle, ligne fine, Appliquer unique, Promo)

**Files:**
- Modify (réécriture complète): `src/app/admin/prix/page.tsx`
- Modify: `src/app/admin/layout.tsx:27` (libellé nav `Prix & stock` → `Prix`)

**Interfaces:**
- Consumes: `PrixGroup` (Task 1) ; contrat PUT `kind:'rowPrices'` (Task 2) ; `DISPLAY_GRADE_ORDER`, `DisplayGrade` (`@/lib/products`).

- [ ] **Step 1: Renommer l'entrée de menu**

Dans `src/app/admin/layout.tsx`, ligne 27, remplacer :

```ts
  { href: '/admin/prix', label: 'Prix & stock', icon: Tag, badgeKey: null },
```

par :

```ts
  { href: '/admin/prix', label: 'Prix', icon: Tag, badgeKey: null },
```

- [ ] **Step 2: Réécrire entièrement `src/app/admin/prix/page.tsx`**

Remplacer tout le contenu du fichier par :

```tsx
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { PrixGroup } from '@/app/api/admin/prix/route';
import { DISPLAY_GRADE_ORDER, type DisplayGrade } from '@/lib/products';

const NO_STORE: RequestInit = { cache: 'no-store' };
const GRADES: DisplayGrade[] = DISPLAY_GRADE_ORDER;
type StatusFilter = 'all' | 'active' | 'inactive';

const C = {
  ink: '#0f172a', sub: '#64748b', mute: '#94a3b8', line: '#e2e8f0',
  rowLine: '#f1f5f9', head: '#f8fafc', green: '#16a34a', red: '#dc2626',
};
const inputStyle: React.CSSProperties = {
  width: '100%', maxWidth: 96, padding: '5px 8px',
  border: `1px solid #cbd5e1`, borderRadius: 6, fontSize: '0.82rem',
};

// ── Page ─────────────────────────────────────────────────────────────────────
export default function PrixPage() {
  const [groups, setGroups] = useState<PrixGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<{ msg: string; ok: boolean } | null>(null);
  const [brandFilter, setBrandFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/prix', NO_STORE);
    const d = await r.json();
    setGroups(d.groups ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Regroupe les groupes par modèle (le GET trie déjà modèle→stockage→grade).
  const models = useMemo(() => {
    const byModel = new Map<string, PrixGroup[]>();
    for (const g of groups) {
      const arr = byModel.get(g.model);
      if (arr) arr.push(g); else byModel.set(g.model, [g]);
    }
    return Array.from(byModel.entries()).map(([model, gs]) => ({
      model, brand: gs[0].brand, groups: gs, active: gs.some((x) => x.active),
    }));
  }, [groups]);

  const brands = useMemo(
    () => Array.from(new Set(groups.map((g) => g.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [groups]
  );

  const visible = models.filter((m) =>
    (brandFilter === '' || m.brand === brandFilter) &&
    (statusFilter === 'all' || (statusFilter === 'active' ? m.active : !m.active))
  );

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: C.ink, marginBottom: 4 }}>Prix</h1>
        <p style={{ fontSize: '0.85rem', color: C.sub }}>
          Saisis le prix de vente par (modèle, stockage, grade). Il s&apos;applique aussitôt
          au catalogue magasin et au catalogue client.
        </p>
      </div>

      {/* Barre de filtres */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center',
        padding: '12px 16px', background: C.head, border: `1px solid ${C.line}`,
        borderRadius: 12, marginBottom: 16,
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: C.sub }}>
          Marque
          <select
            value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}
            style={{ padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.82rem', background: 'white' }}
          >
            <option value="">Toutes</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: C.sub }}>
          Statut
          <div style={{ display: 'inline-flex', border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
            {([['all', 'Tous'], ['active', 'Activés'], ['inactive', 'Désactivés']] as const).map(([val, label]) => (
              <button
                key={val} onClick={() => setStatusFilter(val)}
                style={{
                  padding: '5px 12px', border: 'none', cursor: 'pointer', fontSize: '0.8rem',
                  fontWeight: statusFilter === val ? 600 : 400,
                  background: statusFilter === val ? C.ink : 'white',
                  color: statusFilter === val ? 'white' : C.sub,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: C.mute }}>
          {visible.length} modèle{visible.length > 1 ? 's' : ''}
        </span>
      </div>

      {flash && (
        <p style={{ color: flash.ok ? C.green : C.red, fontSize: '0.85rem', marginBottom: 12 }}>{flash.msg}</p>
      )}

      {loading ? (
        <p style={{ color: C.mute, fontSize: '0.9rem' }}>Chargement…</p>
      ) : visible.length === 0 ? (
        <p style={{ color: C.mute, fontSize: '0.9rem' }}>Aucun modèle pour ces filtres.</p>
      ) : (
        visible.map((m) => (
          <ModelCard key={m.model} model={m.model} brand={m.brand} active={m.active}
            groups={m.groups} onSaved={(msg, ok) => setFlash({ msg, ok })} />
        ))
      )}
    </div>
  );
}

// ── Carte modèle ─────────────────────────────────────────────────────────────
function ModelCard({ model, brand, active, groups, onSaved }: {
  model: string; brand: string; active: boolean; groups: PrixGroup[];
  onSaved: (msg: string, ok: boolean) => void;
}) {
  const [open, setOpen] = useState(true);

  // Stockages distincts (string | null), triés.
  const storages = useMemo(() => {
    const seen = new Map<string, string | null>();
    for (const g of groups) seen.set(g.storage ?? '', g.storage);
    return Array.from(seen.values()).sort((a, b) => (a ?? '').localeCompare(b ?? ''));
  }, [groups]);

  const byKey = useMemo(
    () => new Map(groups.map((g) => [`${g.storage ?? ''}|${g.grade}`, g] as const)),
    [groups]
  );

  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, marginBottom: 14, overflow: 'hidden', background: 'white' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', background: 'white', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '0.7rem', color: C.mute, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▶</span>
        <span style={{ fontSize: '0.72rem', color: C.sub, textTransform: 'uppercase', letterSpacing: '.03em' }}>{brand}</span>
        <span style={{ fontSize: '0.98rem', fontWeight: 600, color: C.ink }}>{model}</span>
        <span style={{
          marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: '0.74rem', fontWeight: 600, color: active ? C.green : C.mute,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: active ? C.green : C.mute }} />
          {active ? 'Activé' : 'Désactivé'}
        </span>
      </button>

      {open && (
        <div style={{ overflowX: 'auto', borderTop: `1px solid ${C.rowLine}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: C.head, textAlign: 'left', color: C.sub }}>
                <th style={{ padding: '8px 12px', fontWeight: 500 }}>Stockage</th>
                {GRADES.map((g) => <th key={g} style={{ padding: '8px 12px', fontWeight: 500 }}>Grade {g}</th>)}
                <th style={{ padding: '8px 12px' }} />
              </tr>
            </thead>
            <tbody>
              {storages.map((s) => (
                <StorageRow
                  key={s ?? '∅'} model={model} storage={s}
                  groupByGrade={Object.fromEntries(
                    GRADES.map((g) => [g, byKey.get(`${s ?? ''}|${g}`)])
                  ) as Partial<Record<DisplayGrade, PrixGroup>>}
                  onSaved={onSaved}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Ligne stockage : prix A/B/C + 1 bouton Appliquer + dépliable Promo ───────
function StorageRow({ model, storage, groupByGrade, onSaved }: {
  model: string; storage: string | null;
  groupByGrade: Partial<Record<DisplayGrade, PrixGroup>>;
  onSaved: (msg: string, ok: boolean) => void;
}) {
  const present = GRADES.filter((g) => groupByGrade[g]);
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(GRADES.map((g) => [g, groupByGrade[g]?.price != null ? String(groupByGrade[g]!.price) : '']))
  );
  const [compareAts, setCompareAts] = useState<Record<string, string>>(() =>
    Object.fromEntries(GRADES.map((g) => [g, groupByGrade[g]?.compareAtPrice != null ? String(groupByGrade[g]!.compareAtPrice) : '']))
  );
  const [promoOpen, setPromoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flashOk, setFlashOk] = useState(false);

  const apply = async () => {
    const entries = present
      .filter((g) => prices[g].trim() !== '')
      .map((g) => {
        const e: { grade: DisplayGrade; price: number; compare_at_price?: number | null } = {
          grade: g, price: Number(prices[g]),
        };
        if (promoOpen) e.compare_at_price = compareAts[g].trim() === '' ? null : Number(compareAts[g]);
        return e;
      });
    if (entries.length === 0) { onSaved('Aucun prix à enregistrer sur cette ligne.', false); return; }

    setBusy(true);
    const r = await fetch('/api/admin/prix', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'rowPrices', model, storage, prices: entries }),
    });
    const d = await r.json();
    setBusy(false);
    if (d.error) {
      onSaved(`Erreur : ${d.error}`, false);
    } else {
      setFlashOk(true);
      setTimeout(() => setFlashOk(false), 1500);
      onSaved(`${storage ?? '—'} : ${d.grades} grade(s) enregistré(s) (${d.updated} variante(s)).`, true);
    }
  };

  return (
    <>
      <tr style={{ borderTop: `1px solid ${C.rowLine}` }}>
        <td style={{ padding: '6px 12px', fontWeight: 500, color: C.ink, whiteSpace: 'nowrap' }}>{storage ?? '—'}</td>
        {GRADES.map((g) => (
          <td key={g} style={{ padding: '6px 12px' }}>
            {groupByGrade[g] ? (
              <input
                type="number" step="0.01" min={0} placeholder="Prix"
                value={prices[g]} onChange={(e) => setPrices((p) => ({ ...p, [g]: e.target.value }))}
                style={inputStyle}
              />
            ) : (
              <span style={{ color: '#cbd5e1' }}>—</span>
            )}
          </td>
        ))}
        <td style={{ padding: '6px 12px', whiteSpace: 'nowrap', textAlign: 'right' }}>
          <button
            onClick={apply} disabled={busy}
            style={{
              padding: '5px 12px', background: flashOk ? C.green : C.ink, color: 'white',
              border: 'none', borderRadius: 6, cursor: busy ? 'wait' : 'pointer',
              fontWeight: 500, fontSize: '0.78rem',
            }}
          >
            {busy ? 'Enregistrement…' : flashOk ? '✓ Enregistré' : 'Appliquer'}
          </button>
          {present.length > 0 && (
            <button
              onClick={() => setPromoOpen((o) => !o)}
              style={{ marginLeft: 10, padding: 0, background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.74rem' }}
            >
              {promoOpen ? 'Masquer promo' : 'Promo'}
            </button>
          )}
        </td>
      </tr>
      {promoOpen && (
        <tr style={{ background: '#fbfdff' }}>
          <td style={{ padding: '4px 12px 8px', fontSize: '0.72rem', color: C.mute }}>Prix barré</td>
          {GRADES.map((g) => (
            <td key={g} style={{ padding: '4px 12px 8px' }}>
              {groupByGrade[g] ? (
                <input
                  type="number" step="0.01" min={0} placeholder="—"
                  value={compareAts[g]} onChange={(e) => setCompareAts((p) => ({ ...p, [g]: e.target.value }))}
                  style={{ ...inputStyle, color: C.mute }}
                />
              ) : null}
            </td>
          ))}
          <td />
        </tr>
      )}
    </>
  );
}
```

- [ ] **Step 3: Vérifier la compilation (tout le projet)**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS, aucune erreur (les imports `PrixColorStock` ont disparu, `PrixGroup` a son nouveau champ `active`).

- [ ] **Step 4: Vérification manuelle en dev**

```bash
npm run dev
```

Ouvrir `http://localhost:3000/admin/prix` (connecté en admin) et vérifier :
- Le menu et le titre affichent « Prix ».
- Une carte par modèle, lignes fines, colonnes Grade A/B/C.
- Filtre **Marque** : sélectionner une marque masque les autres.
- Filtre **Statut** : « Désactivés » montre les modèles sans SKU actif (badge gris) ; « Activés » les masque.
- Sur une ligne, modifier les prix A et B, cliquer **Appliquer** une seule fois → bouton « ✓ Enregistré », message vert, et l'onglet Réseau montre **une seule** requête PUT.
- Recharger la page → les prix saisis sont persistés.
- Vérifier la répercussion : ouvrir la fiche client du modèle (`/products/...`) et le catalogue magasin (`/admin/products`) → le nouveau prix apparaît.
- Déplier **Promo**, saisir un prix barré, Appliquer → barré persisté.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/prix/page.tsx src/app/admin/layout.tsx
git commit -m "feat(admin/prix): refonte page Prix — filtres marque/statut, ligne fine, 1 Appliquer par ligne, promo dépliable

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage :**
- Renommage « Prix » → Task 3 (nav + titre). ✓
- Esthétique plus jolie / lignes fines → Task 3 (cartes, table compacte, padding réduit). ✓
- Filtre marque → Task 3 (select). ✓
- Filtre activés/désactivés → Task 1 (drapeau `active`) + Task 3 (segmenté). ✓
- Prix grade A/B/C par stockage, 1 seul bouton Appliquer → Task 2 (PUT rowPrices) + Task 3 (bouton ligne). ✓
- Cascade catalogue magasin + client → automatique (prix brut sur `products.price`) ; vérifiée en Task 3 Step 4. ✓
- Prix barré discret (dépliable Promo) → Task 3 (StorageRow). ✓
- Stock retiré → Task 1 (GET sans stock) + Task 3 (UI sans stock). ✓

**Placeholder scan :** aucun TODO/TBD ; tout le code est complet. ✓

**Type consistency :** `PrixGroup` (champ `active`, sans `colors`) défini en Task 1, consommé en Task 3 ; `PutBody.kind = 'rowPrices'` avec `prices: Array<{grade, price, compare_at_price?}>` défini en Task 2, envoyé à l'identique en Task 3 ; réponse `{updated, grades}` lue en Task 3. `DISPLAY_GRADE_ORDER`/`DisplayGrade` importés de `@/lib/products`. Cohérent. ✓
