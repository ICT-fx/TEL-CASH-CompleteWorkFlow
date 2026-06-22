# Formulaire d'ajout produit boutique : multi-variantes + caractéristiques — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre la page admin « Nouveau produit » boutique pour saisir plusieurs capacités × grades × couleurs en une fois (1 ligne DB par combinaison, sans gestion de stock), avec une section caractéristiques techniques auto-remplie/éditable, et regrouper le catalogue admin boutique par (stockage, grade).

**Architecture:** Une colonne `specs jsonb` sur `products` stocke les caractéristiques (fallback dictionnaire iPhone si nulle). Le `POST /api/admin/products` accepte un tableau `variants[]` inséré en un seul appel. Le formulaire est décomposé en 3 composants réutilisables (`ChipPicker`, `PriceGrid`, `SpecsEditor`). Le regroupement admin gagne un paramètre de granularité, appliqué seulement aux onglets boutique.

**Tech Stack:** Next.js 15 App Router, React client components, Supabase (PostgreSQL + admin client), TypeScript, Tailwind + CSS admin existant, lucide-react.

## Global Constraints

- **Langue** : tout le texte UI / messages d'erreur en **français**.
- **Pas de harness de test** dans ce repo. Le « cycle de test » de chaque tâche est :
  `npx tsc --noEmit --skipLibCheck` (le `npm run lint` est cassé — convention établie) **+** une vérification manuelle décrite. N'inventez pas de framework de test.
- **Path alias** : `@/*` → `./src/*`.
- **Grades vendables** : `A+, A, B+, B, C+, C` uniquement (D/E exclus — règle métier existante).
- **Source unique grades** : dériver de `GRADE_ORDER` / `GRADES` ([src/lib/products.ts](../../../src/lib/products.ts)) — ne jamais recoder `['A','B','C']` en dur.
- **Stock boutique** : `MANUAL_DEFAULT_STOCK = 999` ; toute variante boutique = « toujours disponible ».
- **Périmètre** : ne **rien** changer au comportement Fluxitron (regroupement par stockage, affichage chiffré du stock).
- **Couleurs** : stockées telles que saisies (libellés FR acceptés — `colorLabelFr`/`colorToCss` gèrent FR+EN).
- **Spec de référence** : [docs/superpowers/specs/2026-06-22-admin-product-multivariant-specs-design.md](../specs/2026-06-22-admin-product-multivariant-specs-design.md).

---

### Task 1: Migration — colonne `specs jsonb` sur `products`

**Files:**
- DB uniquement (Supabase MCP). Projet : `klungktcrjlwxqfbbbec`.

**Interfaces:**
- Produces : colonne `products.specs jsonb` nullable, lue par les tâches 3, 4, 9.

- [ ] **Step 1: Appliquer la migration**

Via le tool MCP Supabase `apply_migration` (projet `klungktcrjlwxqfbbbec`), name `add_products_specs`, query :

```sql
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS specs jsonb;
```

- [ ] **Step 2: Vérifier la colonne**

Via MCP `execute_sql` (projet `klungktcrjlwxqfbbbec`) :

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'specs';
```

Attendu : 1 ligne `specs | jsonb`.

- [ ] **Step 3: Commit**

Rien à committer (changement DB appliqué via MCP, tracé dans l'historique des migrations Supabase). Passer à la tâche suivante.

---

### Task 2: Type `ProductSpecs` + helpers

**Files:**
- Create: `src/lib/productSpecs.ts`

**Interfaces:**
- Consumes : `getIphoneSpecs` de [src/lib/iphoneSpecs.ts](../../../src/lib/iphoneSpecs.ts).
- Produces :
  - `interface ProductSpecs { ecran: string; resistance: string; poids: string; puce: string; reseau: '4G'|'5G'|''; connectique: string; photo: string; selfie: string; video: string; autonomie: string; annee: number | null }`
  - `const EMPTY_SPECS: ProductSpecs`
  - `type SpecFieldType = 'text' | 'number' | 'reseau'`
  - `interface SpecField { key: keyof ProductSpecs; label: string; type: SpecFieldType }`
  - `interface SpecTheme { title: string; fields: SpecField[] }`
  - `const SPEC_THEMES: SpecTheme[]`
  - `function specsFromIphone(model: string | null | undefined): ProductSpecs | null`
  - `function isSpecsEmpty(s: ProductSpecs | null | undefined): boolean`

- [ ] **Step 1: Créer le fichier**

`src/lib/productSpecs.ts` :

```ts
// Forme applicative des caractéristiques techniques stockées sur products.specs
// (jsonb). Miroir de IphoneSpec (cf. iphoneSpecs.ts) — la « Garantie » n'en fait
// PAS partie : elle est lue depuis products.warranty au moment de l'affichage.
// Pur — pas de React, pas de DB.

import { getIphoneSpecs } from './iphoneSpecs';

export interface ProductSpecs {
  ecran: string;
  resistance: string;
  poids: string;
  puce: string;
  reseau: '4G' | '5G' | '';
  connectique: string;
  photo: string;
  selfie: string;
  video: string;
  autonomie: string;
  annee: number | null;
}

export const EMPTY_SPECS: ProductSpecs = {
  ecran: '', resistance: '', poids: '',
  puce: '', reseau: '', connectique: '',
  photo: '', selfie: '', video: '',
  autonomie: '', annee: null,
};

export type SpecFieldType = 'text' | 'number' | 'reseau';

export interface SpecField {
  key: keyof ProductSpecs;
  label: string;
  type: SpecFieldType;
}

export interface SpecTheme {
  title: string;
  fields: SpecField[];
}

// Mêmes 4 thèmes que la fiche produit (sans la ligne « Garantie », gérée à part).
export const SPEC_THEMES: SpecTheme[] = [
  {
    title: 'Écran & design',
    fields: [
      { key: 'ecran', label: 'Écran', type: 'text' },
      { key: 'resistance', label: 'Résistance eau', type: 'text' },
      { key: 'poids', label: 'Poids', type: 'text' },
    ],
  },
  {
    title: 'Performances & réseau',
    fields: [
      { key: 'puce', label: 'Puce', type: 'text' },
      { key: 'reseau', label: 'Réseau', type: 'reseau' },
      { key: 'connectique', label: 'Connectique', type: 'text' },
    ],
  },
  {
    title: 'Photo & vidéo',
    fields: [
      { key: 'photo', label: 'Appareil photo', type: 'text' },
      { key: 'selfie', label: 'Caméra avant', type: 'text' },
      { key: 'video', label: 'Vidéo', type: 'text' },
    ],
  },
  {
    title: 'Autonomie & infos',
    fields: [
      { key: 'autonomie', label: 'Autonomie', type: 'text' },
      { key: 'annee', label: 'Année de sortie', type: 'number' },
    ],
  },
];

// Convertit l'entrée dictionnaire iPhone (si connue) vers ProductSpecs.
export function specsFromIphone(model: string | null | undefined): ProductSpecs | null {
  const s = getIphoneSpecs(model);
  if (!s) return null;
  return {
    ecran: s.ecran,
    resistance: s.resistance,
    poids: s.poids,
    puce: s.puce,
    reseau: s.reseau,
    connectique: s.connectique,
    photo: s.photo,
    selfie: s.selfie,
    video: s.video,
    autonomie: s.autonomie,
    annee: s.annee,
  };
}

// true si aucun champ utile n'est renseigné (sert à écrire NULL plutôt qu'un
// objet vide, et à préférer le dictionnaire à l'affichage).
export function isSpecsEmpty(s: ProductSpecs | null | undefined): boolean {
  if (!s) return true;
  const text = [
    s.ecran, s.resistance, s.poids, s.puce, s.reseau,
    s.connectique, s.photo, s.selfie, s.video, s.autonomie,
  ];
  return text.every((v) => !v || !v.trim()) && s.annee == null;
}
```

- [ ] **Step 2: Vérifier les types**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur (le fichier compile, imports résolus).

- [ ] **Step 3: Commit**

```bash
git add src/lib/productSpecs.ts
git commit -m "feat(specs): type ProductSpecs + helpers (themes, prefill iPhone)"
```

---

### Task 3: `POST /api/admin/products` — insertion en lot

**Files:**
- Modify: `src/app/api/admin/products/route.ts` (handler `POST`, ~lignes 46-104)

**Interfaces:**
- Consumes : colonne `products.specs` (Task 1).
- Produces : POST acceptant `{ brand, model, category, warranty, condition_description, images, specs, variants: [{ storage_capacity, grade, color, price, compare_at_price }] }` → insère N lignes `source:'manual'`, `stock:999`. Le POST mono-produit existant reste valide.

- [ ] **Step 1: Ajouter la constante de stock par défaut**

En haut de [src/app/api/admin/products/route.ts](../../../src/app/api/admin/products/route.ts), après les imports :

```ts
// Boutique = pas de gestion de quantité : chaque variante est « toujours dispo ».
// Stock élevé pour qu'une vente (décrément atomique) ne la mette pas en rupture.
const MANUAL_DEFAULT_STOCK = 999;
```

- [ ] **Step 2: Brancher le chemin « lot » au début du `POST`**

Dans `export async function POST`, juste après `const body = await request.json();` (et avant la déstructuration mono-produit existante), insérer :

```ts
    // ── Chemin « lot » : création de N variantes (storage × grade × couleur) ──
    if (Array.isArray(body.variants)) {
      const { brand, model, category, warranty, condition_description, images, specs, variants } = body;

      if (!brand || !model || !category) {
        return NextResponse.json(
          { error: 'brand, model et category sont requis' },
          { status: 400 }
        );
      }
      if (variants.length === 0) {
        return NextResponse.json({ error: 'Aucune variante à créer' }, { status: 400 });
      }
      for (const v of variants) {
        const price = parseFloat(v.price);
        if (!Number.isFinite(price) || price <= 0) {
          return NextResponse.json(
            { error: 'Chaque variante doit avoir un prix valide (> 0)' },
            { status: 400 }
          );
        }
      }

      const nullIfEmpty = (val: unknown) =>
        typeof val === 'string' && val.trim() === '' ? null : val;

      const supabase = createAdminClient();
      const rows = variants.map((v: any) => ({
        brand,
        model,
        category,
        storage_capacity: nullIfEmpty(v.storage_capacity),
        color: nullIfEmpty(v.color),
        grade: nullIfEmpty(v.grade),
        warranty: nullIfEmpty(warranty),
        condition_description: nullIfEmpty(condition_description),
        price: parseFloat(v.price),
        compare_at_price: v.compare_at_price ? parseFloat(v.compare_at_price) : null,
        stock: MANUAL_DEFAULT_STOCK,
        images: images || [],
        specs: specs ?? null,
        is_active: true,
        source: 'manual',
      }));

      const { data, error } = await supabase.from('products').insert(rows).select();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ products: data, count: data?.length ?? 0 }, { status: 201 });
    }
    // ── Chemin mono-produit (existant) ────────────────────────────────────────
```

Laisser le code mono-produit existant inchangé en dessous.

- [ ] **Step 3: Vérifier les types**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 4: Vérification manuelle (optionnelle, dev server)**

Avec `npm run dev` et une session admin, un POST « lot » crée bien N lignes. (À défaut de session, la vérif end-to-end se fera en Task 9.)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/products/route.ts
git commit -m "feat(api): POST products accepte un lot de variantes (stock 999, source manual)"
```

---

### Task 4: Fiche produit — specs override + garantie + hors-Apple

**Files:**
- Modify: `src/components/products/TechSpecs.tsx` (réécriture)
- Modify: `src/lib/productVariants.ts` (interface `RawProduct` : +`warranty`, +`specs`)
- Modify: `src/app/products/[id]/ProductDetailClient.tsx:515` (passer `specs` + `warranty`)

**Interfaces:**
- Consumes : `ProductSpecs`, `SPEC_THEMES`, `specsFromIphone`, `isSpecsEmpty` (Task 2).
- Produces : `<TechSpecs brand model specs warranty />` affiche l'override si présent, sinon le dictionnaire, et n'est plus limité à Apple.

- [ ] **Step 1: Étendre `RawProduct`**

Dans [src/lib/productVariants.ts](../../../src/lib/productVariants.ts), ajouter l'import en tête :

```ts
import type { ProductSpecs } from './productSpecs';
```

Puis, dans `export interface RawProduct { ... }`, ajouter avant la ligne `[extra: string]: unknown;` :

```ts
  warranty?: string | null;
  specs?: ProductSpecs | null;
```

- [ ] **Step 2: Réécrire `TechSpecs.tsx`**

Remplacer **tout** le contenu de [src/components/products/TechSpecs.tsx](../../../src/components/products/TechSpecs.tsx) par :

```tsx
// « Caractéristiques techniques » en accordéon FAQ. Source des valeurs :
//   1) override saisi à la main (products.specs) en priorité,
//   2) sinon le dictionnaire iPhone (iphoneSpecs.ts via specsFromIphone).
// Affiché dès qu'une source existe (override OU dictionnaire) → marche désormais
// aussi hors Apple. Aucune source → null (bloc masqué proprement).

import { Smartphone, Cpu, Camera, BatteryFull, ChevronDown, type LucideIcon } from 'lucide-react';
import { specsFromIphone, isSpecsEmpty, SPEC_THEMES, type ProductSpecs } from '@/lib/productSpecs';

interface Props {
  brand: string | null | undefined;
  model: string | null | undefined;
  specs?: ProductSpecs | null;
  warranty?: string | null;
}

interface Row { label: string; value: string }
interface Group { icon: LucideIcon; title: string; rows: Row[] }

const THEME_ICONS: LucideIcon[] = [Smartphone, Cpu, Camera, BatteryFull];

function fmt(v: string | number | null): string {
  if (v == null) return '';
  return typeof v === 'number' ? String(v) : v;
}

export function TechSpecs({ model, specs, warranty }: Props) {
  const override = isSpecsEmpty(specs) ? null : (specs as ProductSpecs);
  const data: ProductSpecs | null = override ?? specsFromIphone(model);
  if (!data) return null;

  const groups: Group[] = SPEC_THEMES.map((theme, i) => ({
    icon: THEME_ICONS[i] ?? Smartphone,
    title: theme.title,
    rows: theme.fields
      .map((f) => ({ label: f.label, value: fmt(data[f.key]) }))
      .filter((r) => r.value.trim() !== ''),
  }));

  // Ligne « Garantie » sous le dernier thème (Autonomie & infos).
  const last = groups[groups.length - 1];
  if (last) {
    last.rows.push({ label: 'Garantie', value: (warranty && warranty.trim()) || '24 mois incluse' });
  }

  const visible = groups.filter((g) => g.rows.length > 0);
  if (visible.length === 0) return null;

  return (
    <section className="mt-12 md:mt-16">
      <div className="flex items-baseline gap-3 mb-1">
        <h2 className="text-[22px] font-extrabold text-[#0B1437] tracking-tight">Caractéristiques techniques</h2>
        <span className="font-caveat text-[#4B7BFF] text-base">déroulez ce qui vous intéresse</span>
      </div>
      <div className="h-px bg-[#ECECEC] my-4" />

      <div>
        {visible.map((g, i) => {
          const Icon = g.icon;
          const summary = g.rows.map((r) => r.value).join(' · ');
          return (
            <details
              key={g.title}
              open={i === 0}
              className="group border border-[#E8E8E8] open:border-[#D6DEF0] rounded-[14px] bg-white mb-2.5 overflow-hidden"
            >
              <summary className="list-none cursor-pointer flex items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                <span className="w-10 h-10 rounded-[11px] bg-[#EBF1FF] text-[#2F6BFF] flex items-center justify-center flex-none">
                  <Icon className="w-[21px] h-[21px]" strokeWidth={2} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-extrabold text-[#0B1437] leading-tight">{g.title}</span>
                  <span className="block text-xs text-[#9AA3B2] mt-0.5 truncate">{summary}</span>
                </span>
                <ChevronDown className="w-5 h-5 text-[#B6BCC7] flex-none transition-transform duration-200 group-open:rotate-180 group-open:text-[#2F6BFF]" />
              </summary>
              <div className="px-4 pb-2 pl-4 md:pl-[69px]">
                {g.rows.map((r) => (
                  <div key={r.label} className="flex justify-between items-center gap-3.5 py-2.5 border-t border-[#F1F1F1]">
                    <span className="text-[13px] text-[#8A92A0] flex-none">{r.label}</span>
                    <b className="text-[13px] font-extrabold text-[#0B1437] text-right">{r.value}</b>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      <p className="text-[11px] text-[#9AA3B2] mt-3.5">
        Caractéristiques fabricant — peuvent évoluer suivant les versions logicielles.
      </p>
    </section>
  );
}
```

- [ ] **Step 3: Passer les props depuis `ProductDetailClient`**

Dans [src/app/products/[id]/ProductDetailClient.tsx](../../../src/app/products/[id]/ProductDetailClient.tsx#L515), remplacer :

```tsx
        <TechSpecs brand={initialSku.brand} model={initialSku.model} />
```

par :

```tsx
        <TechSpecs brand={initialSku.brand} model={initialSku.model} specs={initialSku.specs} warranty={initialSku.warranty} />
```

- [ ] **Step 4: Vérifier les types**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 5: Vérification manuelle**

`npm run dev` → ouvrir une fiche iPhone connue : les caractéristiques s'affichent comme avant (issues du dictionnaire). Le bloc reste identique visuellement.

- [ ] **Step 6: Commit**

```bash
git add src/components/products/TechSpecs.tsx src/lib/productVariants.ts src/app/products/[id]/ProductDetailClient.tsx
git commit -m "feat(fiche): TechSpecs lit products.specs (override) + garantie, marche hors Apple"
```

---

### Task 5: Catalogue admin — regroupement (stockage, grade) boutique + « Disponible »

**Files:**
- Modify: `src/app/admin/products/_lib/groupByModel.ts` (param de granularité, champ `grade`)
- Modify: `src/app/admin/products/page.tsx:429-432` (choisir la granularité selon la source)
- Modify: `src/app/admin/products/_components/ModelRow.tsx` (grade dans l'en-tête, badge « Disponible »)
- Modify: `src/app/admin/products/_components/SkuRow.tsx:93-97` (badge « Disponible » pour le manuel)

**Interfaces:**
- Consumes : rien des autres tâches.
- Produces : `groupProductsByModel(products, opts?: { granularity?: 'storage' | 'storage_grade' })` ; `ModelGroup.grade?: string`.

- [ ] **Step 1: Granularité dans `groupByModel.ts`**

Dans [src/app/admin/products/_lib/groupByModel.ts](../../../src/app/admin/products/_lib/groupByModel.ts) :

Ajouter le champ à `ModelGroup` (après `storage: string;`) :

```ts
  grade?: string;                 // présent si granularité = 'storage_grade'
```

Remplacer la signature et la clé de bucket. La fonction commence par :

```ts
export function groupProductsByModel(products: AdminProduct[]): ModelGroup[] {
```

Remplacer par :

```ts
export type GroupGranularity = 'storage' | 'storage_grade';

export function groupProductsByModel(
  products: AdminProduct[],
  opts: { granularity?: GroupGranularity } = {}
): ModelGroup[] {
  const granularity = opts.granularity ?? 'storage';
```

Dans la 1ʳᵉ boucle de bucketing, remplacer le bloc qui calcule `key` :

```ts
    const key = makeKey(brand, model, storage);
    const bucket = buckets.get(key);
```

par :

```ts
    const gradeKey = granularity === 'storage_grade'
      ? (normalizeGradeLetter(p.grade) || 'Sans grade')
      : '';
    const key = granularity === 'storage_grade'
      ? `${makeKey(brand, model, storage)}|${gradeKey.toLowerCase()}`
      : makeKey(brand, model, storage);
    const bucket = buckets.get(key);
```

Dans la 2ᵈ boucle (`buckets.forEach((variants, key) => {`), après `const storage = ...` ajouter :

```ts
    const groupGrade = granularity === 'storage_grade'
      ? (normalizeGradeLetter(first.grade) || 'Sans grade')
      : undefined;
```

Puis dans l'objet `groups.push({ ... })`, ajouter le champ après `storage,` :

```ts
      grade: groupGrade,
```

(`normalizeGradeLetter` est déjà importé en tête du fichier.)

- [ ] **Step 2: Choisir la granularité dans `page.tsx`**

Dans [src/app/admin/products/page.tsx](../../../src/app/admin/products/page.tsx#L429), remplacer le `useMemo` des `groups` :

```ts
  const groups = useMemo(
    () => sortModelGroups(groupProductsByModel(filtered as AdminProduct[]), groupSort),
    [filtered, groupSort]
  );
```

par :

```ts
  const groups = useMemo(
    () => sortModelGroups(
      groupProductsByModel(filtered as AdminProduct[], {
        granularity: currentTab.source === 'manual' ? 'storage_grade' : 'storage',
      }),
      groupSort
    ),
    [filtered, groupSort, currentTab.source]
  );
```

- [ ] **Step 3: En-tête de groupe + « Disponible » dans `ModelRow.tsx`**

Dans [src/app/admin/products/_components/ModelRow.tsx](../../../src/app/admin/products/_components/ModelRow.tsx) :

(a) En-tête : remplacer la ligne du nom (~ligne 94-96) :

```tsx
              <div className="product-name" style={{ fontWeight: 700 }}>
                {group.brand} {group.model} <span style={{ color: '#94a3b8', fontWeight: 500 }}>· {group.storage}</span>
              </div>
```

par :

```tsx
              <div className="product-name" style={{ fontWeight: 700 }}>
                {group.brand} {group.model}{' '}
                <span style={{ color: '#94a3b8', fontWeight: 500 }}>
                  · {group.storage}{group.grade && group.grade !== 'Sans grade' ? ` · Grade ${group.grade}` : ''}
                </span>
              </div>
```

(b) Badge stock : remplacer la cellule stock (~lignes 116-128) :

```tsx
        <td style={{ verticalAlign: 'middle' }}>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 8,
              background: stockStyle.bg, color: stockStyle.color,
              fontWeight: 700, fontSize: '0.82rem',
              whiteSpace: 'nowrap',
            }}
          >
            {stockStyle.label(group.totalStock)}
          </span>
        </td>
```

par :

```tsx
        <td style={{ verticalAlign: 'middle' }}>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 8,
              background: isManualGroup ? '#16a34a' : stockStyle.bg,
              color: '#fff',
              fontWeight: 700, fontSize: '0.82rem',
              whiteSpace: 'nowrap',
            }}
          >
            {isManualGroup ? 'Disponible' : stockStyle.label(group.totalStock)}
          </span>
        </td>
```

(c) Définir `isManualGroup` : juste après `const isFluxitron = group.representativeSource === 'fluxitron';` (~ligne 54), ajouter :

```tsx
  const isManualGroup = group.representativeSource === 'manual';
```

- [ ] **Step 4: Badge « Disponible » dans `SkuRow.tsx`**

Dans [src/app/admin/products/_components/SkuRow.tsx](../../../src/app/admin/products/_components/SkuRow.tsx#L93), remplacer la cellule stock (~lignes 93-97) :

```tsx
      <td>
        <span className={p.stock <= 2 ? 'admin-badge admin-badge-red' : p.stock <= 5 ? 'admin-badge admin-badge-yellow' : ''}>
          {p.stock}
        </span>
      </td>
```

par :

```tsx
      <td>
        {p.source === 'manual' ? (
          <span className="admin-badge admin-badge-green">Disponible</span>
        ) : (
          <span className={p.stock <= 2 ? 'admin-badge admin-badge-red' : p.stock <= 5 ? 'admin-badge admin-badge-yellow' : ''}>
            {p.stock}
          </span>
        )}
      </td>
```

- [ ] **Step 5: Vérifier les types**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 6: Vérification manuelle**

`npm run dev` → onglet « Téléphones boutique » : les lignes sont regroupées par (modèle, stockage, grade), badge « Disponible ». Onglet « Téléphones Fluxitron » : inchangé (regroupé par stockage, stock chiffré).

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/products/_lib/groupByModel.ts src/app/admin/products/page.tsx src/app/admin/products/_components/ModelRow.tsx src/app/admin/products/_components/SkuRow.tsx
git commit -m "feat(admin): catalogue boutique groupé par (stockage, grade) + badge Disponible"
```

---

### Task 6: Composant `ChipPicker` (multi-sélection avec ajout libre)

**Files:**
- Create: `src/app/admin/products/new/_components/ChipPicker.tsx`

**Interfaces:**
- Produces : `<ChipPicker label options selected onChange allowCustom? placeholder? renderLabel? />` où `selected: string[]`, `onChange: (next: string[]) => void`, `renderLabel?: (v: string) => string`.

- [ ] **Step 1: Créer le composant**

`src/app/admin/products/new/_components/ChipPicker.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface ChipPickerProps {
  label: string;
  options: string[];                       // chips prédéfinies
  selected: string[];
  onChange: (next: string[]) => void;
  allowCustom?: boolean;
  placeholder?: string;
  renderLabel?: (value: string) => string; // libellé affiché (valeur stockée inchangée)
}

export function ChipPicker({
  label, options, selected, onChange,
  allowCustom = true, placeholder = 'Ajouter…', renderLabel,
}: ChipPickerProps) {
  const [custom, setCustom] = useState('');

  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };

  const addCustom = () => {
    const v = custom.trim();
    if (v && !selected.includes(v)) onChange([...selected, v]);
    setCustom('');
  };

  // chips affichées = prédéfinies + valeurs custom déjà sélectionnées
  const extra = selected.filter((s) => !options.includes(s));
  const chips = [...options, ...extra];
  const lab = (v: string) => (renderLabel ? renderLabel(v) : v);

  return (
    <div className="admin-form-group">
      <label className="admin-form-label">{label}</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {chips.map((v) => {
          const active = selected.includes(v);
          return (
            <button
              type="button"
              key={v}
              onClick={() => toggle(v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 999,
                border: `1.5px solid ${active ? '#2563eb' : '#e2e8f0'}`,
                background: active ? '#dbeafe' : '#fff',
                color: active ? '#1d4ed8' : '#475569',
                fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              }}
            >
              {lab(v)}
              {active && <X className="w-3 h-3" />}
            </button>
          );
        })}
        {allowCustom && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <input
              className="admin-form-input"
              style={{ width: 150, padding: '7px 10px' }}
              placeholder={placeholder}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            />
            <button type="button" onClick={addCustom} className="admin-icon-btn" title="Ajouter">
              <Plus className="w-4 h-4" />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier les types**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/products/new/_components/ChipPicker.tsx
git commit -m "feat(admin/new): composant ChipPicker (multi-sélection + ajout libre)"
```

---

### Task 7: Composant `PriceGrid` (prix par stockage × grade)

**Files:**
- Create: `src/app/admin/products/new/_components/PriceGrid.tsx`

**Interfaces:**
- Produces :
  - `type PriceCell = { price: string; compareAt: string }`
  - `type PriceMap = Record<string, PriceCell>` (clé = `` `${storage}|${grade}` ``)
  - `function priceKey(storage: string, grade: string): string`
  - `<PriceGrid storages grades value onChange gradeLabel? />`

- [ ] **Step 1: Créer le composant**

`src/app/admin/products/new/_components/PriceGrid.tsx` :

```tsx
'use client';

export interface PriceCell { price: string; compareAt: string }
export type PriceMap = Record<string, PriceCell>;

export function priceKey(storage: string, grade: string): string {
  return `${storage}|${grade}`;
}

interface PriceGridProps {
  storages: string[];
  grades: string[];
  value: PriceMap;
  onChange: (next: PriceMap) => void;
  gradeLabel?: (g: string) => string;
}

export function PriceGrid({ storages, grades, value, onChange, gradeLabel }: PriceGridProps) {
  const setCell = (k: string, patch: Partial<PriceCell>) => {
    const cur = value[k] ?? { price: '', compareAt: '' };
    onChange({ ...value, [k]: { ...cur, ...patch } });
  };

  // Remplit toutes les cellules avec le 1er prix saisi (helper « appliquer à tout »).
  const applyAll = () => {
    const first = Object.values(value).find((c) => c && c.price.trim());
    if (!first) return;
    const next: PriceMap = { ...value };
    for (const s of storages) for (const g of grades) {
      const k = priceKey(s, g);
      next[k] = { price: first.price, compareAt: (value[k]?.compareAt ?? first.compareAt) };
    }
    onChange(next);
  };

  if (storages.length === 0 || grades.length === 0) {
    return <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Sélectionnez au moins une capacité et un grade.</p>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button type="button" className="admin-btn admin-btn-ghost" onClick={applyAll}>
          Appliquer le 1er prix à toutes les cases
        </button>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {storages.map((s) =>
          grades.map((g) => {
            const k = priceKey(s, g);
            const cell = value[k] ?? { price: '', compareAt: '' };
            return (
              <div
                key={k}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 130px 130px',
                  gap: 10, alignItems: 'center',
                  padding: '8px 12px', borderRadius: 10, background: '#f8fafc',
                }}
              >
                <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.88rem' }}>
                  {s} · {gradeLabel ? gradeLabel(g) : `Grade ${g}`}
                </div>
                <input
                  className="admin-form-input" type="number" step="0.01" min="0"
                  placeholder="Prix *" value={cell.price}
                  onChange={(e) => setCell(k, { price: e.target.value })}
                />
                <input
                  className="admin-form-input" type="number" step="0.01" min="0"
                  placeholder="Prix barré" value={cell.compareAt}
                  onChange={(e) => setCell(k, { compareAt: e.target.value })}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier les types**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/products/new/_components/PriceGrid.tsx
git commit -m "feat(admin/new): composant PriceGrid (prix/prix barré par stockage × grade)"
```

---

### Task 8: Composant `SpecsEditor` (4 thèmes, pré-remplissage)

**Files:**
- Create: `src/app/admin/products/new/_components/SpecsEditor.tsx`

**Interfaces:**
- Consumes : `SPEC_THEMES`, `ProductSpecs` (Task 2).
- Produces : `<SpecsEditor value onChange prefilledFrom? onPrefill? canPrefill? />`.

- [ ] **Step 1: Créer le composant**

`src/app/admin/products/new/_components/SpecsEditor.tsx` :

```tsx
'use client';

import { SPEC_THEMES, type ProductSpecs } from '@/lib/productSpecs';

interface SpecsEditorProps {
  value: ProductSpecs;
  onChange: (next: ProductSpecs) => void;
  prefilledFrom?: string | null;   // modèle source du pré-remplissage (bandeau)
  onPrefill?: () => void;          // « Réinitialiser depuis le modèle »
  canPrefill?: boolean;            // true si le modèle est connu du dictionnaire
}

export function SpecsEditor({ value, onChange, prefilledFrom, onPrefill, canPrefill }: SpecsEditorProps) {
  const setField = (key: keyof ProductSpecs, raw: string, isNumber: boolean) => {
    const v = isNumber ? (raw === '' ? null : Number(raw)) : raw;
    onChange({ ...value, [key]: v } as ProductSpecs);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        {prefilledFrom ? (
          <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>
            Pré-rempli depuis « {prefilledFrom} »
          </span>
        ) : <span />}
        {canPrefill && onPrefill && (
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onPrefill}>
            Réinitialiser depuis le modèle
          </button>
        )}
      </div>

      {SPEC_THEMES.map((theme) => (
        <div key={theme.title} style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem', marginBottom: 8 }}>
            {theme.title}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {theme.fields.map((f) => (
              <div className="admin-form-group" key={f.key}>
                <label className="admin-form-label">{f.label}</label>
                {f.type === 'reseau' ? (
                  <select
                    className="admin-form-select"
                    value={(value[f.key] as string) ?? ''}
                    onChange={(e) => setField(f.key, e.target.value, false)}
                  >
                    <option value="">—</option>
                    <option value="4G">4G</option>
                    <option value="5G">5G</option>
                  </select>
                ) : (
                  <input
                    className="admin-form-input"
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={value[f.key] == null ? '' : String(value[f.key])}
                    onChange={(e) => setField(f.key, e.target.value, f.type === 'number')}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Vérifier les types**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/products/new/_components/SpecsEditor.tsx
git commit -m "feat(admin/new): composant SpecsEditor (4 thèmes, pré-remplissage iPhone)"
```

---

### Task 9: Assembler le formulaire « Nouveau produit » (lot)

**Files:**
- Modify (réécriture): `src/app/admin/products/new/page.tsx`

**Interfaces:**
- Consumes : `ChipPicker` (T6), `PriceGrid` + `priceKey` + `PriceMap` (T7), `SpecsEditor` (T8), `ProductSpecs`/`EMPTY_SPECS`/`specsFromIphone`/`isSpecsEmpty` (T2), `gradeLabelFr`/`GRADE_ORDER` ([products.ts](../../../src/lib/products.ts)), `POST /api/admin/products` lot (T3).

- [ ] **Step 1: Réécrire `new/page.tsx`**

Remplacer **tout** le contenu de [src/app/admin/products/new/page.tsx](../../../src/app/admin/products/new/page.tsx) par :

```tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { GRADE_ORDER, gradeLabelFr } from '@/lib/products';
import { EMPTY_SPECS, isSpecsEmpty, specsFromIphone, type ProductSpecs } from '@/lib/productSpecs';
import { ChipPicker } from './_components/ChipPicker';
import { PriceGrid, priceKey, type PriceMap } from './_components/PriceGrid';
import { SpecsEditor } from './_components/SpecsEditor';

const PREDEFINED_BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'Google', 'OnePlus', 'Huawei', 'Oppo'];
const STORAGE_OPTIONS = ['64 Go', '128 Go', '256 Go', '512 Go', '1 To'];
const GRADE_OPTIONS = GRADE_ORDER.filter((g) => g !== 'D' && g !== 'E'); // A+ … C
const COLOR_OPTIONS = ['Noir', 'Blanc', 'Bleu', 'Rouge', 'Vert', 'Gris', 'Or', 'Rose', 'Argent', 'Violet', 'Minuit', 'Lumière stellaire', 'Graphite', 'Titane naturel'];

export default function AdminNewProductPage() {
  const router = useRouter();

  // Identité
  const [brand, setBrand] = useState('');
  const [customBrand, setCustomBrand] = useState(false);
  const [model, setModel] = useState('');
  const [category, setCategory] = useState<'telephones' | 'accessoires'>('telephones');

  // Déclinaisons
  const [storages, setStorages] = useState<string[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [priceMap, setPriceMap] = useState<PriceMap>({});

  // Specs
  const [specs, setSpecs] = useState<ProductSpecs>(EMPTY_SPECS);
  const [specsTouched, setSpecsTouched] = useState(false);
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null);

  // Partagés
  const [warranty, setWarranty] = useState('');
  const [conditionDescription, setConditionDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragover, setDragover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isApple = brand.trim().toLowerCase() === 'apple';
  const canPrefill = isApple && specsFromIphone(model) != null;

  // Auto-pré-remplissage des specs depuis le dictionnaire iPhone tant que
  // l'utilisateur n'a pas édité la section à la main.
  useEffect(() => {
    if (specsTouched) return;
    const s = isApple ? specsFromIphone(model) : null;
    if (s) { setSpecs(s); setPrefilledFrom(model); }
    else { setSpecs(EMPTY_SPECS); setPrefilledFrom(null); }
  }, [brand, model, specsTouched, isApple]);

  const variantCount = storages.length * grades.length * colors.length;

  // ── Upload images ──────────────────────────────────────────────────────────
  const uploadFile = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (res.ok && data.url) return data.url as string;
    throw new Error(data.error || 'Upload failed');
  };
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setUploading(true);
    setError('');
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) urls.push(await uploadFile(file));
      setImages((prev) => [...prev, ...urls]);
    } catch (err: any) {
      setError(err.message || 'Erreur upload');
    }
    setUploading(false);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragover(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // ── Soumission ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!brand.trim() || !model.trim()) { setError('Marque et modèle sont requis.'); return; }
    if (storages.length === 0) { setError('Sélectionnez au moins une capacité.'); return; }
    if (grades.length === 0) { setError('Sélectionnez au moins un grade.'); return; }
    if (colors.length === 0) { setError('Sélectionnez au moins une couleur.'); return; }

    // Toutes les cases (capacité × grade) doivent avoir un prix > 0.
    for (const s of storages) for (const g of grades) {
      const price = parseFloat(priceMap[priceKey(s, g)]?.price ?? '');
      if (!Number.isFinite(price) || price <= 0) {
        setError(`Prix manquant pour ${s} · Grade ${g}.`);
        return;
      }
    }

    const variants: Array<{ storage_capacity: string; grade: string; color: string; price: string; compare_at_price: string | null }> = [];
    for (const s of storages) for (const g of grades) {
      const cell = priceMap[priceKey(s, g)];
      for (const c of colors) {
        variants.push({
          storage_capacity: s,
          grade: g,
          color: c,
          price: cell.price,
          compare_at_price: cell.compareAt?.trim() ? cell.compareAt : null,
        });
      }
    }

    setSaving(true);
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: brand.trim(),
        model: model.trim(),
        category,
        warranty,
        condition_description: conditionDescription,
        images,
        specs: isSpecsEmpty(specs) ? null : specs,
        variants,
      }),
    });

    if (res.ok) {
      router.push('/admin/products');
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Erreur lors de la création.');
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 24 }}>
        Nouveau produit
      </h1>

      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Identité */}
        <div className="admin-panel">
          <div className="admin-panel-header"><div className="admin-panel-title">Informations générales</div></div>
          <div style={{ padding: 24 }}>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Marque *</label>
                <select
                  className="admin-form-select"
                  value={PREDEFINED_BRANDS.includes(brand) ? brand : (customBrand ? 'Autre' : '')}
                  onChange={(e) => {
                    if (e.target.value === 'Autre') { setBrand(''); setCustomBrand(true); }
                    else { setBrand(e.target.value); setCustomBrand(false); }
                  }}
                >
                  <option value="">Sélectionner...</option>
                  {PREDEFINED_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                  <option value="Autre">Autre (préciser)...</option>
                </select>
                {customBrand && (
                  <input className="admin-form-input" style={{ marginTop: 8 }} placeholder="Saisissez la marque..."
                    value={brand} onChange={(e) => setBrand(e.target.value)} required />
                )}
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Modèle *</label>
                <input className="admin-form-input" value={model} onChange={(e) => setModel(e.target.value)}
                  required placeholder="iPhone 11" />
              </div>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Catégorie *</label>
              <select className="admin-form-select" value={category}
                onChange={(e) => setCategory(e.target.value as 'telephones' | 'accessoires')}>
                <option value="telephones">Téléphones</option>
                <option value="accessoires">Accessoires</option>
              </select>
            </div>
          </div>
        </div>

        {/* Déclinaisons */}
        <div className="admin-panel">
          <div className="admin-panel-header"><div className="admin-panel-title">Déclinaisons</div></div>
          <div style={{ padding: 24, display: 'grid', gap: 16 }}>
            <ChipPicker label="Capacités *" options={STORAGE_OPTIONS} selected={storages} onChange={setStorages} placeholder="ex. 1 To" />
            <ChipPicker label="Grades *" options={GRADE_OPTIONS} selected={grades} onChange={setGrades} allowCustom={false} renderLabel={(g) => `Grade ${g}`} />
            <ChipPicker label="Couleurs *" options={COLOR_OPTIONS} selected={colors} onChange={setColors} placeholder="ex. Bleu nuit" />
            {variantCount > 0 && (
              <div style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: 600 }}>
                Cette saisie créera {variantCount} variante{variantCount > 1 ? 's' : ''} ({storages.length} × {grades.length} × {colors.length}).
              </div>
            )}
          </div>
        </div>

        {/* Prix */}
        <div className="admin-panel">
          <div className="admin-panel-header"><div className="admin-panel-title">Prix par capacité × grade</div></div>
          <div style={{ padding: 24 }}>
            <PriceGrid storages={storages} grades={grades} value={priceMap} onChange={setPriceMap} gradeLabel={(g) => `Grade ${g}`} />
            <p style={{ marginTop: 12, fontSize: '0.8rem', color: '#94a3b8' }}>
              Le prix est partagé entre couleurs. Pas de stock à saisir : les produits boutique sont toujours disponibles.
            </p>
          </div>
        </div>

        {/* Caractéristiques techniques */}
        <div className="admin-panel">
          <div className="admin-panel-header"><div className="admin-panel-title">Caractéristiques techniques</div></div>
          <div style={{ padding: 24 }}>
            <SpecsEditor
              value={specs}
              onChange={(next) => { setSpecs(next); setSpecsTouched(true); }}
              prefilledFrom={prefilledFrom}
              canPrefill={canPrefill}
              onPrefill={() => {
                const s = specsFromIphone(model);
                if (s) { setSpecs(s); setPrefilledFrom(model); setSpecsTouched(false); }
              }}
            />
          </div>
        </div>

        {/* Images */}
        <div className="admin-panel">
          <div className="admin-panel-header"><div className="admin-panel-title">Images</div></div>
          <div style={{ padding: 24 }}>
            <div
              className={`admin-dropzone ${dragover ? 'dragover' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
              onDragLeave={() => setDragover(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto' }} />
              ) : (
                <>
                  <Upload className="w-8 h-8" style={{ color: '#94a3b8', margin: '0 auto' }} />
                  <div className="admin-dropzone-text">Glissez vos images ici</div>
                  <div className="admin-dropzone-hint">ou cliquez pour parcourir · JPG, PNG, WebP · Max 5 Mo</div>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple
              style={{ display: 'none' }} onChange={(e) => e.target.files && handleFiles(e.target.files)} />
            {images.length > 0 && (
              <div className="admin-image-preview">
                {images.map((url, i) => (
                  <div key={i} className="admin-image-thumb">
                    <img src={url} alt={`Image ${i + 1}`} />
                    <button type="button" className="admin-image-thumb-remove"
                      onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Garantie & description */}
        <div className="admin-panel">
          <div className="admin-panel-header"><div className="admin-panel-title">Garantie & description</div></div>
          <div style={{ padding: 24, display: 'grid', gap: 16 }}>
            <div className="admin-form-group">
              <label className="admin-form-label">Garantie</label>
              <input className="admin-form-input" value={warranty} onChange={(e) => setWarranty(e.target.value)} placeholder="24 mois incluse" />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Description de l&apos;état</label>
              <textarea className="admin-form-textarea" value={conditionDescription}
                onChange={(e) => setConditionDescription(e.target.value)} placeholder="Décrivez l'état du produit..." />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
          <button type="button" className="admin-btn admin-btn-outline admin-btn-lg" onClick={() => router.push('/admin/products')}>
            Annuler
          </button>
          <button type="submit" className="admin-btn admin-btn-primary admin-btn-lg" disabled={saving}>
            {saving ? 'Création...' : `Créer ${variantCount > 0 ? variantCount + ' variante' + (variantCount > 1 ? 's' : '') : 'le produit'}`}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier les types**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 3: Vérification manuelle end-to-end**

`npm run dev`, session admin → `/admin/products/new` :
1. Marque **Apple**, modèle **iPhone 11** → la section caractéristiques se pré-remplit, bandeau « Pré-rempli depuis iPhone 11 ».
2. Capacités `128 Go`, `256 Go` ; grades `A`, `B` ; couleurs `Noir`, `Bleu` → « créera 8 variantes ».
3. Remplir la grille de prix (4 cases) → « Créer 8 variantes ».
4. Après création : redirection vers le catalogue ; onglet boutique → lignes par (stockage, grade), badge **Disponible**, déplier → 1 ligne par couleur.
5. Vérifier en base (MCP `execute_sql`) :

```sql
SELECT storage_capacity, grade, color, price, stock, specs IS NOT NULL AS has_specs
FROM public.products
WHERE source = 'manual' AND model = 'iPhone 11'
ORDER BY storage_capacity, grade, color;
```

Attendu : 8 lignes, `stock = 999`, `has_specs = true`.
6. Ouvrir la fiche d'une des variantes → caractéristiques affichées.
7. Tester un **modèle inconnu** (ex. marque Samsung, modèle « Galaxy S99 ») : section vide à remplir, création OK, specs affichées sur la fiche.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/products/new/page.tsx
git commit -m "feat(admin/new): formulaire de lot multi-variantes + section caractéristiques"
```

---

## Self-Review (effectué)

**1. Couverture du spec :**
- §5 colonne `specs jsonb` → Task 1 ✓
- §5.2 type `ProductSpecs` + helpers → Task 2 ✓
- §5.3 `MANUAL_DEFAULT_STOCK` → Task 3 ✓
- §6 POST lot → Task 3 ✓
- §7 formulaire (déclinaisons, grille prix, pas de stock) → Tasks 6, 7, 9 ✓
- §7.3 specs auto + override → Tasks 2, 8, 9 ✓
- §8 fiche front (override > dictionnaire, garantie via warranty, hors-Apple) → Task 4 ✓
- §9 regroupement (stockage, grade) boutique + « Disponible » → Task 5 ✓
- §3 non-objectifs (imei/battery retirés, Fluxitron intact, page édition hors scope) → respecté (form T9 sans imei/battery ; T5 granularité conditionnée à la source).

**2. Placeholders :** aucun TODO/TBD ; chaque step de code montre le code complet.

**3. Cohérence des types :** `ProductSpecs`, `PriceMap`/`priceKey`, `priceKey(s,g)` identiques entre T2/T7/T9 ; `groupProductsByModel(products, opts)` aligné entre T5 (def) et page.tsx (appel) ; `ChipPicker`/`PriceGrid`/`SpecsEditor` props consommées telles que définies.

**4. Périmètre :** un seul sous-système (création produit boutique + affichage admin/fiche associé) — un seul plan suffit.
