# Page admin « Marges » — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire une page admin `/admin/margins` qui pilote les marges (par grade / marque / modèle / produit en cascade), recalcule les prix de vente depuis le prix fournisseur, garantit la cohérence A > B > C, et suit les marges réalisées.

**Architecture:** Le coût fournisseur va dans `products.cost_price` ; `products.price` devient le prix de vente calculé (coût + marge + arrondi + cohérence). Toute la logique de calcul est pure dans `src/lib/margins.ts` (testée avec Vitest). Les API admin lisent/écrivent les règles (`margin_rules`), les réglages (`margin_settings`), produisent un aperçu, appliquent les prix, et agrègent les marges réalisées depuis `order_items.cost_at_purchase`. Le checkout fige le coût à la vente ; l'import Fluxitron écrit `cost_price` puis recalcule `price`.

**Tech Stack:** Next.js 15 (App Router), Supabase (Postgres + RLS), TypeScript, Vitest (nouveau, pour la logique pure), React 19.

Spec de référence : `docs/superpowers/specs/2026-06-15-admin-marges-design.md`

---

## Structure des fichiers

**Créés :**
- `vitest.config.ts` — config Vitest (environnement node, inclut `src/lib`).
- `src/lib/margins.ts` — logique pure : types, arrondi, calcul prix, résolution cascade, cohérence A/B/C, calcul groupé.
- `src/lib/margins.test.ts` — tests unitaires de la logique pure.
- `supabase/migrations/015_margins.sql` — colonnes `cost_price`, `cost_at_purchase`, tables `margin_rules`, `margin_settings`, RLS.
- `src/lib/margins-db.ts` — accès DB : charge produits + règles + réglages, expose `recomputeAndWritePrices()` et `loadPricingInputs()`.
- `src/app/api/admin/margins/rules/route.ts` — GET liste + POST création.
- `src/app/api/admin/margins/rules/[id]/route.ts` — PUT + DELETE.
- `src/app/api/admin/margins/settings/route.ts` — GET + PUT.
- `src/app/api/admin/margins/preview/route.ts` — GET aperçu calculé.
- `src/app/api/admin/margins/apply/route.ts` — POST écrit `price`.
- `src/app/api/admin/margins/stats/route.ts` — GET marges réalisées.
- `src/app/admin/margins/page.tsx` — page UI.

**Modifiés :**
- `package.json` — devDependency `vitest` + script `test`.
- `src/app/api/checkout/route.ts:158-167` — figer `cost_at_purchase`.
- `src/app/api/v1/prices/batch/route.ts` — écrire `cost_price` puis recalculer `price`.
- `src/app/admin/layout.tsx:21-29` — entrée de menu « Marges ».

---

## Task 1: Infra de test (Vitest)

Le projet n'a aucun runner de test. On ajoute Vitest, scopé à la logique pure.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Installer Vitest**

Run:
```bash
npm install -D vitest@^2
```
Expected: ajout de `vitest` dans `devDependencies`, pas d'erreur.

- [ ] **Step 2: Ajouter le script `test`**

Dans `package.json`, dans `"scripts"`, ajouter après la ligne `"lint": "next lint",` :

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 3: Créer `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 4: Vérifier que le runner démarre (aucun test encore)**

Run: `npx vitest run`
Expected: sortie « No test files found » (exit 0) — Vitest est opérationnel.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "test(infra): ajout de Vitest pour la logique pure"
```

---

## Task 2: Logique pure — arrondi (`applyRounding`)

**Files:**
- Create: `src/lib/margins.ts`
- Test: `src/lib/margins.test.ts`

- [ ] **Step 1: Écrire les tests d'arrondi (échec attendu)**

`src/lib/margins.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { applyRounding } from './margins';

describe('applyRounding', () => {
  it('cent → 2 décimales', () => {
    expect(applyRounding(12.3456, 'cent')).toBe(12.35);
    expect(applyRounding(12.344, 'cent')).toBe(12.34);
  });
  it('decicent → 3 décimales', () => {
    expect(applyRounding(12.3456, 'decicent')).toBe(12.346);
  });
  it('euro → entier le plus proche', () => {
    expect(applyRounding(12.4, 'euro')).toBe(12);
    expect(applyRounding(12.5, 'euro')).toBe(13);
  });
  it('five_euro → multiple de 5', () => {
    expect(applyRounding(122, 'five_euro')).toBe(120);
    expect(applyRounding(123, 'five_euro')).toBe(125);
  });
  it('ten_euro → multiple de 10', () => {
    expect(applyRounding(124, 'ten_euro')).toBe(120);
    expect(applyRounding(125, 'ten_euro')).toBe(130);
  });
  it('ends_99 → arrondi à l’euro puis −0,01', () => {
    expect(applyRounding(119.4, 'ends_99')).toBe(118.99);
    expect(applyRounding(119.6, 'ends_99')).toBe(119.99);
  });
});
```

- [ ] **Step 2: Lancer → échec**

Run: `npx vitest run src/lib/margins.test.ts`
Expected: FAIL (`applyRounding` is not a function / module introuvable).

- [ ] **Step 3: Implémenter le module avec `applyRounding`**

`src/lib/margins.ts` :

```ts
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
```

- [ ] **Step 4: Lancer → succès**

Run: `npx vitest run src/lib/margins.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/margins.ts src/lib/margins.test.ts
git commit -m "feat(marges): applyRounding (6 modes d'arrondi)"
```

---

## Task 3: Calcul du prix de vente (`computeSellingPrice`)

**Files:**
- Modify: `src/lib/margins.ts`
- Test: `src/lib/margins.test.ts`

- [ ] **Step 1: Ajouter les tests (échec attendu)**

Ajouter dans `src/lib/margins.test.ts` :

```ts
import { computeSellingPrice, type MarginRule } from './margins';

function rule(partial: Partial<MarginRule>): MarginRule {
  return {
    id: 'r', scope_level: 'global', brand: null, model: null, product_id: null,
    grade: null, margin_type: 'percent', margin_percent: 0, margin_fixed: 0,
    rounding: 'cent', ...partial,
  };
}

describe('computeSellingPrice', () => {
  it('percent : coût × (1 + %)', () => {
    expect(computeSellingPrice(100, rule({ margin_type: 'percent', margin_percent: 20 }))).toBe(120);
  });
  it('fixed : coût + €', () => {
    expect(computeSellingPrice(100, rule({ margin_type: 'fixed', margin_fixed: 30 }))).toBe(130);
  });
  it('combined : coût × (1 + %) + €', () => {
    expect(computeSellingPrice(100, rule({ margin_type: 'combined', margin_percent: 20, margin_fixed: 10 }))).toBe(130);
  });
  it('applique l’arrondi de la règle', () => {
    expect(computeSellingPrice(100, rule({ margin_type: 'percent', margin_percent: 19.5, rounding: 'ends_99' }))).toBe(119.99);
  });
  it('valeurs null traitées comme 0', () => {
    expect(computeSellingPrice(100, rule({ margin_type: 'combined', margin_percent: null, margin_fixed: null }))).toBe(100);
  });
});
```

- [ ] **Step 2: Lancer → échec**

Run: `npx vitest run src/lib/margins.test.ts`
Expected: FAIL (`computeSellingPrice` / `MarginRule` non exportés).

- [ ] **Step 3: Implémenter**

Ajouter dans `src/lib/margins.ts` :

```ts
export interface MarginRule {
  id: string;
  scope_level: ScopeLevel;
  brand: string | null;
  model: string | null;
  product_id: string | null;
  grade: DisplayGrade | null; // A/B/C ou null = tous grades
  margin_type: MarginType;
  margin_percent: number | null;
  margin_fixed: number | null;
  rounding: Rounding;
}

// Prix de vente = coût + marge, puis arrondi (porté par la règle).
export function computeSellingPrice(cost: number, r: MarginRule): number {
  const pct = r.margin_percent ?? 0;
  const fixed = r.margin_fixed ?? 0;
  let raw = cost;
  if (r.margin_type === 'percent') raw = cost * (1 + pct / 100);
  else if (r.margin_type === 'fixed') raw = cost + fixed;
  else raw = cost * (1 + pct / 100) + fixed; // combined
  return applyRounding(raw, r.rounding);
}
```

- [ ] **Step 4: Lancer → succès**

Run: `npx vitest run src/lib/margins.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/margins.ts src/lib/margins.test.ts
git commit -m "feat(marges): computeSellingPrice (percent/fixed/combined)"
```

---

## Task 4: Résolution de cascade (`resolveRule`)

**Files:**
- Modify: `src/lib/margins.ts`
- Test: `src/lib/margins.test.ts`

- [ ] **Step 1: Ajouter les tests (échec attendu)**

Ajouter dans `src/lib/margins.test.ts` :

```ts
import { resolveRule, type PricingProduct } from './margins';

function prod(p: Partial<PricingProduct>): PricingProduct {
  return {
    id: 'p1', brand: 'Apple', model: 'iPhone 11', grade: 'A',
    storage_capacity: '128 Go', color: 'Noir', cost_price: 100, price: 100, ...p,
  };
}

describe('resolveRule', () => {
  const global = rule({ id: 'g', scope_level: 'global' });
  const brand = rule({ id: 'b', scope_level: 'brand', brand: 'Apple' });
  const model = rule({ id: 'm', scope_level: 'model', brand: 'Apple', model: 'iPhone 11' });
  const productR = rule({ id: 'pr', scope_level: 'product', product_id: 'p1' });
  const productGradeA = rule({ id: 'pga', scope_level: 'product', product_id: 'p1', grade: 'A' });

  it('produit+grade bat tout', () => {
    expect(resolveRule(prod({}), [global, brand, model, productR, productGradeA])!.id).toBe('pga');
  });
  it('produit bat modèle', () => {
    expect(resolveRule(prod({}), [global, brand, model, productR])!.id).toBe('pr');
  });
  it('modèle bat marque', () => {
    expect(resolveRule(prod({}), [global, brand, model])!.id).toBe('m');
  });
  it('marque bat global', () => {
    expect(resolveRule(prod({}), [global, brand])!.id).toBe('b');
  });
  it('grade matché via displayGrade (A+ → A)', () => {
    expect(resolveRule(prod({ grade: 'A+' }), [global, productGradeA])!.id).toBe('pga');
  });
  it('grade B ne matche pas une règle grade A', () => {
    expect(resolveRule(prod({ grade: 'B' }), [global, productGradeA])!.id).toBe('g');
  });
  it('aucune règle → null', () => {
    expect(resolveRule(prod({}), [])).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer → échec**

Run: `npx vitest run src/lib/margins.test.ts`
Expected: FAIL (`resolveRule` / `PricingProduct` non exportés).

- [ ] **Step 3: Implémenter**

Ajouter dans `src/lib/margins.ts` :

```ts
export interface PricingProduct {
  id: string;
  brand: string;
  model: string;
  grade: string | null;            // grade brut (A+/A/B+/…)
  storage_capacity: string | null;
  color: string | null;
  cost_price: number;
  price: number;                   // prix de vente courant (pour avant/après)
}

const eqi = (a: string | null, b: string | null) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

// Une règle s'applique-t-elle à ce produit ? (scope + grade)
function ruleMatches(p: PricingProduct, r: MarginRule): boolean {
  const dg = displayGrade(p.grade);
  if (r.grade && r.grade !== dg) return false;
  switch (r.scope_level) {
    case 'global': return true;
    case 'brand': return eqi(p.brand, r.brand);
    case 'model': return eqi(p.brand, r.brand) && eqi(p.model, r.model);
    case 'product': return p.id === r.product_id;
  }
}

// Spécificité : produit(3) > modèle(2) > marque(1) > global(0), +0.5 si grade ciblé.
function specificity(r: MarginRule): number {
  const base = { product: 3, model: 2, brand: 1, global: 0 }[r.scope_level];
  return base * 2 + (r.grade ? 1 : 0);
}

// Règle la plus spécifique qui matche, ou null.
export function resolveRule(p: PricingProduct, rules: MarginRule[]): MarginRule | null {
  let best: MarginRule | null = null;
  let bestScore = -1;
  for (const r of rules) {
    if (!ruleMatches(p, r)) continue;
    const s = specificity(r);
    if (s > bestScore) { best = r; bestScore = s; }
  }
  return best;
}
```

- [ ] **Step 4: Lancer → succès**

Run: `npx vitest run src/lib/margins.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/margins.ts src/lib/margins.test.ts
git commit -m "feat(marges): resolveRule (cascade le plus spécifique gagne)"
```

---

## Task 5: Calcul groupé + cohérence A/B/C (`computeProductPrices`)

**Files:**
- Modify: `src/lib/margins.ts`
- Test: `src/lib/margins.test.ts`

- [ ] **Step 1: Ajouter les tests (échec attendu)**

Ajouter dans `src/lib/margins.test.ts` :

```ts
import { computeProductPrices, type MarginSettings } from './margins';

const settingsOff: MarginSettings = { coherence_enabled: false, coherence_min_gap_percent: 5 };
const settingsOn: MarginSettings = { coherence_enabled: true, coherence_min_gap_percent: 5 };

describe('computeProductPrices', () => {
  it('calcule newPrice + marginPct + règle appliquée', () => {
    const products = [prod({ id: 'p1', cost_price: 100 })];
    const rules = [rule({ id: 'g', scope_level: 'global', margin_type: 'percent', margin_percent: 20 })];
    const res = computeProductPrices(products, rules, settingsOff);
    expect(res[0].newPrice).toBe(120);
    expect(res[0].marginPct).toBeCloseTo(0.2);
    expect(res[0].ruleApplied).toBe('g');
  });

  it('sans règle : prix inchangé (= coût), ruleApplied null', () => {
    const res = computeProductPrices([prod({ cost_price: 100, price: 100 })], [], settingsOff);
    expect(res[0].newPrice).toBe(100);
    expect(res[0].ruleApplied).toBeNull();
  });

  it('cohérence OFF : B peut rester > A', () => {
    const products = [
      prod({ id: 'a', grade: 'A', cost_price: 100 }),
      prod({ id: 'b', grade: 'B', cost_price: 200 }),
    ];
    const rules = [rule({ scope_level: 'global', margin_type: 'percent', margin_percent: 0 })];
    const res = computeProductPrices(products, rules, settingsOff);
    expect(res.find((r) => r.product.id === 'a')!.newPrice).toBe(100);
    expect(res.find((r) => r.product.id === 'b')!.newPrice).toBe(200);
  });

  it('cohérence ON : A remonté à ≥ 1,05 × B (même famille)', () => {
    const products = [
      prod({ id: 'a', grade: 'A', cost_price: 100 }),
      prod({ id: 'b', grade: 'B', cost_price: 200 }),
    ];
    const rules = [rule({ scope_level: 'global', margin_type: 'percent', margin_percent: 0, rounding: 'cent' })];
    const res = computeProductPrices(products, rules, settingsOn);
    const a = res.find((r) => r.product.id === 'a')!;
    const b = res.find((r) => r.product.id === 'b')!;
    expect(b.newPrice).toBe(200);
    expect(a.newPrice).toBeGreaterThanOrEqual(200 * 1.05);
    expect(a.coherenceAdjusted).toBe(true);
  });

  it('cohérence : familles distinctes (stockage différent) non mélangées', () => {
    const products = [
      prod({ id: 'a', grade: 'A', storage_capacity: '128 Go', cost_price: 100 }),
      prod({ id: 'b', grade: 'B', storage_capacity: '256 Go', cost_price: 200 }),
    ];
    const rules = [rule({ scope_level: 'global', margin_type: 'percent', margin_percent: 0 })];
    const res = computeProductPrices(products, rules, settingsOn);
    expect(res.find((r) => r.product.id === 'a')!.coherenceAdjusted).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer → échec**

Run: `npx vitest run src/lib/margins.test.ts`
Expected: FAIL (`computeProductPrices` / `MarginSettings` non exportés).

- [ ] **Step 3: Implémenter**

Ajouter dans `src/lib/margins.ts` :

```ts
export interface MarginSettings {
  coherence_enabled: boolean;
  coherence_min_gap_percent: number;
}

export interface PriceComputation {
  product: PricingProduct;
  cost: number;
  oldPrice: number;
  newPrice: number;
  marginPct: number;          // (newPrice - cost) / cost
  ruleApplied: string | null; // rule.id ou null
  coherenceAdjusted: boolean; // prix remonté par la cohérence A/B/C
  lowMargin: boolean;         // marginPct < LOW_MARGIN_THRESHOLD
}

export const LOW_MARGIN_THRESHOLD = 0.05;

// Clé de famille pour la cohérence : même téléphone, grades différents.
function familyKey(p: PricingProduct): string {
  return [p.brand, p.model, p.storage_capacity, p.color]
    .map((s) => (s ?? '').trim().toLowerCase()).join('|');
}

const DISPLAY_RANK: Record<DisplayGrade, number> = { A: 0, B: 1, C: 2 };

// Arrondi VERS LE HAUT au pas du mode — utilisé par la cohérence pour ne pas
// repasser sous le seuil après ré-arrondi.
function roundUp(value: number, mode: Rounding): number {
  switch (mode) {
    case 'cent': return Math.ceil(value * 100) / 100;
    case 'decicent': return Math.ceil(value * 1000) / 1000;
    case 'euro': return Math.ceil(value);
    case 'five_euro': return Math.ceil(value / 5) * 5;
    case 'ten_euro': return Math.ceil(value / 10) * 10;
    case 'ends_99': return Math.max(0, Math.ceil(value)) - 0.01;
  }
}

export function computeProductPrices(
  products: PricingProduct[],
  rules: MarginRule[],
  settings: MarginSettings
): PriceComputation[] {
  // 1. Prix de base depuis cascade + marge.
  const computations: PriceComputation[] = products.map((p) => {
    const cost = Number(p.cost_price) || 0;
    const r = resolveRule(p, rules);
    const newPrice = r ? computeSellingPrice(cost, r) : cost;
    return {
      product: p, cost, oldPrice: Number(p.price) || 0, newPrice,
      marginPct: cost > 0 ? (newPrice - cost) / cost : 0,
      ruleApplied: r?.id ?? null, coherenceAdjusted: false, lowMargin: false,
    };
  });

  // 2. Cohérence A > B > C par famille (remontée seule).
  if (settings.coherence_enabled) {
    const gap = 1 + (Number(settings.coherence_min_gap_percent) || 0) / 100;
    const families = new Map<string, PriceComputation[]>();
    for (const c of computations) {
      const k = familyKey(c.product);
      (families.get(k) ?? families.set(k, []).get(k)!).push(c);
    }
    for (const group of families.values()) {
      // Rang d'affichage par grade, puis du pire (C) vers le meilleur (A).
      const byGrade = new Map<DisplayGrade, PriceComputation>();
      for (const c of group) {
        const dg = displayGrade(c.product.grade);
        if (!dg) continue;
        // En cas de doublon de grade dans une famille, garder le + cher (référence).
        const prev = byGrade.get(dg);
        if (!prev || c.newPrice > prev.newPrice) byGrade.set(dg, c);
      }
      const order: DisplayGrade[] = ['C', 'B', 'A'];
      let floor = 0; // prix minimal imposé par le grade inférieur
      for (const dg of order) {
        const c = byGrade.get(dg);
        if (!c) continue;
        if (floor > 0 && c.newPrice < floor) {
          const rounding = (rules.find((r) => r.id === c.ruleApplied)?.rounding) ?? 'cent';
          c.newPrice = roundUp(floor, rounding);
          c.coherenceAdjusted = true;
          c.marginPct = c.cost > 0 ? (c.newPrice - c.cost) / c.cost : 0;
        }
        floor = c.newPrice * gap; // le grade au-dessus doit dépasser ce plancher
      }
    }
  }

  // 3. Flag marge faible.
  for (const c of computations) c.lowMargin = c.marginPct < LOW_MARGIN_THRESHOLD;
  return computations;
}
```

> Détail map : remplacer `families.get(k) ?? families.set(k, []).get(k)!` par une forme
> explicite si elle ne plaît pas :
> `let arr = families.get(k); if (!arr) { arr = []; families.set(k, arr); } arr.push(c);`

- [ ] **Step 4: Lancer → succès**

Run: `npx vitest run src/lib/margins.test.ts`
Expected: PASS (tous les blocs).

- [ ] **Step 5: Commit**

```bash
git add src/lib/margins.ts src/lib/margins.test.ts
git commit -m "feat(marges): computeProductPrices + cohérence A>B>C par famille"
```

---

## Task 6: Migration SQL (colonnes + tables + RLS)

**Files:**
- Create: `supabase/migrations/015_margins.sql`

- [ ] **Step 1: Écrire la migration**

`supabase/migrations/015_margins.sql` :

```sql
-- Marges : coût fournisseur séparé du prix de vente, règles de marge,
-- réglages de cohérence, et coût figé à la vente.

-- 1. Coût fournisseur. Au départ, price = prix fournisseur → on l'y recopie.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2);
UPDATE public.products SET cost_price = price WHERE cost_price IS NULL;

-- 2. Coût figé à la vente (NULL sur l'historique → exclu des stats de marge).
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cost_at_purchase NUMERIC(10,2);

-- 3. Règles de marge (cascade : global < brand < model < product).
CREATE TABLE IF NOT EXISTS public.margin_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_level TEXT NOT NULL CHECK (scope_level IN ('global','brand','model','product')),
  brand TEXT,
  model TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  grade TEXT CHECK (grade IN ('A','B','C')),
  margin_type TEXT NOT NULL CHECK (margin_type IN ('percent','fixed','combined')),
  margin_percent NUMERIC,
  margin_fixed NUMERIC,
  rounding TEXT NOT NULL DEFAULT 'cent'
    CHECK (rounding IN ('cent','decicent','euro','five_euro','ten_euro','ends_99')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unicité d'une règle par (niveau, cible, grade). COALESCE pour gérer les NULL.
CREATE UNIQUE INDEX IF NOT EXISTS margin_rules_unique_scope
  ON public.margin_rules (
    scope_level,
    COALESCE(brand,''),
    COALESCE(model,''),
    COALESCE(product_id,'00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(grade,'')
  );

-- 4. Réglages globaux (singleton).
CREATE TABLE IF NOT EXISTS public.margin_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  coherence_enabled BOOLEAN NOT NULL DEFAULT false,
  coherence_min_gap_percent NUMERIC NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO public.margin_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 5. RLS : tables d'admin uniquement (service-role bypasse la RLS).
ALTER TABLE public.margin_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.margin_settings ENABLE ROW LEVEL SECURITY;
-- Pas de policy publique : seul le service-role (API admin) y accède.
```

- [ ] **Step 2: Appliquer la migration**

Appliquer sur le projet Supabase `klungktcrjlwxqfbbbec` (cf. mémoire projet), via l'outil MCP `apply_migration` (name: `015_margins`) ou la CLI Supabase. 

Run (CLI, si dispo) : `supabase db push`
Expected: migration appliquée sans erreur ; `products.cost_price` rempli (= ancien `price`).

- [ ] **Step 3: Vérifier**

Vérifier via `execute_sql` :
```sql
SELECT count(*) AS sans_cout FROM products WHERE cost_price IS NULL;
SELECT * FROM margin_settings;
```
Expected: `sans_cout = 0` ; une ligne `margin_settings` (id=1, coherence_enabled=false, gap=5).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/015_margins.sql
git commit -m "feat(marges): migration cost_price, cost_at_purchase, margin_rules, margin_settings"
```

---

## Task 7: Accès DB (`src/lib/margins-db.ts`)

Centralise le chargement des entrées de calcul et l'écriture des prix, réutilisé par preview/apply/Fluxitron.

**Files:**
- Create: `src/lib/margins-db.ts`

- [ ] **Step 1: Implémenter**

`src/lib/margins-db.ts` :

```ts
import { createAdminClient } from '@/lib/supabase-admin';
import {
  computeProductPrices,
  type MarginRule, type MarginSettings, type PricingProduct, type PriceComputation,
} from '@/lib/margins';

// Charge produits (filtrés) + règles + réglages pour un calcul.
export async function loadPricingInputs(filter?: { brand?: string }): Promise<{
  products: PricingProduct[];
  rules: MarginRule[];
  settings: MarginSettings;
}> {
  const db = createAdminClient();

  let q = db
    .from('products')
    .select('id, brand, model, grade, storage_capacity, color, cost_price, price');
  if (filter?.brand) q = q.eq('brand', filter.brand);
  const { data: rows } = await q;

  const products: PricingProduct[] = (rows ?? []).map((p) => ({
    id: p.id,
    brand: p.brand ?? '',
    model: p.model ?? '',
    grade: p.grade,
    storage_capacity: p.storage_capacity,
    color: p.color,
    cost_price: Number(p.cost_price ?? p.price) || 0,
    price: Number(p.price) || 0,
  }));

  const { data: ruleRows } = await db.from('margin_rules').select('*');
  const rules = (ruleRows ?? []) as MarginRule[];

  const { data: s } = await db.from('margin_settings').select('*').eq('id', 1).single();
  const settings: MarginSettings = {
    coherence_enabled: s?.coherence_enabled ?? false,
    coherence_min_gap_percent: Number(s?.coherence_min_gap_percent ?? 5),
  };

  return { products, rules, settings };
}

// Calcule l'aperçu (sans écrire).
export async function previewPrices(filter?: { brand?: string }): Promise<PriceComputation[]> {
  const { products, rules, settings } = await loadPricingInputs(filter);
  return computeProductPrices(products, rules, settings);
}

// Recalcule puis ÉCRIT price pour les produits dont le prix change.
// Réutilisé par /apply et par l'import Fluxitron (cost_price modifié).
export async function recomputeAndWritePrices(filter?: {
  brand?: string;
  productIds?: string[];
}): Promise<{ updated: number }> {
  const db = createAdminClient();
  const { products, rules, settings } = await loadPricingInputs(
    filter?.brand ? { brand: filter.brand } : undefined
  );

  let comps = computeProductPrices(products, rules, settings);
  if (filter?.productIds?.length) {
    const set = new Set(filter.productIds);
    comps = comps.filter((c) => set.has(c.product.id));
  }

  const changed = comps.filter((c) => Math.abs(c.newPrice - c.oldPrice) > 0.0001);
  await Promise.all(
    changed.map((c) =>
      db.from('products').update({ price: c.newPrice }).eq('id', c.product.id)
    )
  );
  return { updated: changed.length };
}
```

> Note cohérence + filtre `productIds` : `computeProductPrices` doit voir TOUTE la
> famille pour calculer la cohérence, donc on charge tous les produits (ou la marque),
> on calcule, PUIS on filtre par `productIds`. Ne pas charger seulement les `productIds`.

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur sur `src/lib/margins-db.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/margins-db.ts
git commit -m "feat(marges): accès DB (loadPricingInputs, preview, recompute+write)"
```

---

## Task 8: API règles CRUD

**Files:**
- Create: `src/app/api/admin/margins/rules/route.ts`
- Create: `src/app/api/admin/margins/rules/[id]/route.ts`

- [ ] **Step 1: GET + POST**

`src/app/api/admin/margins/rules/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;
  const db = createAdminClient();
  const { data, error } = await db
    .from('margin_rules')
    .select('*')
    .order('scope_level', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;
  const body = await request.json();
  const db = createAdminClient();
  const { data, error } = await db
    .from('margin_rules')
    .insert({
      scope_level: body.scope_level,
      brand: body.brand ?? null,
      model: body.model ?? null,
      product_id: body.product_id ?? null,
      grade: body.grade ?? null,
      margin_type: body.margin_type,
      margin_percent: body.margin_percent ?? null,
      margin_fixed: body.margin_fixed ?? null,
      rounding: body.rounding ?? 'cent',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ rule: data });
}
```

- [ ] **Step 2: PUT + DELETE**

`src/app/api/admin/margins/rules/[id]/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin();
  if (response) return response;
  const { id } = await params;
  const body = await request.json();
  const db = createAdminClient();
  const { data, error } = await db
    .from('margin_rules')
    .update({
      margin_type: body.margin_type,
      margin_percent: body.margin_percent ?? null,
      margin_fixed: body.margin_fixed ?? null,
      rounding: body.rounding ?? 'cent',
      grade: body.grade ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ rule: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin();
  if (response) return response;
  const { id } = await params;
  const db = createAdminClient();
  const { error } = await db.from('margin_rules').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur sur ces fichiers.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/margins/rules
git commit -m "feat(marges): API CRUD des règles de marge"
```

---

## Task 9: API réglages (settings)

**Files:**
- Create: `src/app/api/admin/margins/settings/route.ts`

- [ ] **Step 1: GET + PUT**

`src/app/api/admin/margins/settings/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;
  const db = createAdminClient();
  const { data } = await db.from('margin_settings').select('*').eq('id', 1).single();
  return NextResponse.json({
    settings: data ?? { coherence_enabled: false, coherence_min_gap_percent: 5 },
  });
}

export async function PUT(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;
  const body = await request.json();
  const db = createAdminClient();
  const { data, error } = await db
    .from('margin_settings')
    .update({
      coherence_enabled: !!body.coherence_enabled,
      coherence_min_gap_percent: Number(body.coherence_min_gap_percent) || 5,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ settings: data });
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/margins/settings
git commit -m "feat(marges): API réglages de cohérence"
```

---

## Task 10: API aperçu (preview)

**Files:**
- Create: `src/app/api/admin/margins/preview/route.ts`

- [ ] **Step 1: GET**

`src/app/api/admin/margins/preview/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { previewPrices } from '@/lib/margins-db';

export async function GET(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;
  const { searchParams } = new URL(request.url);
  const brand = searchParams.get('brand') || undefined;
  const grade = searchParams.get('grade') || undefined; // 'A'|'B'|'C'

  let comps = await previewPrices(brand ? { brand } : undefined);

  // Filtre d'affichage par grade (après calcul, pour ne pas casser la cohérence).
  if (grade) {
    const { displayGrade } = await import('@/lib/products');
    comps = comps.filter((c) => displayGrade(c.product.grade) === grade);
  }

  const rows = comps.map((c) => ({
    productId: c.product.id,
    brand: c.product.brand,
    model: c.product.model,
    grade: c.product.grade,
    storage: c.product.storage_capacity,
    color: c.product.color,
    cost: c.cost,
    oldPrice: c.oldPrice,
    newPrice: c.newPrice,
    marginPct: c.marginPct,
    ruleApplied: c.ruleApplied,
    coherenceAdjusted: c.coherenceAdjusted,
    lowMargin: c.lowMargin,
  }));

  return NextResponse.json({ rows });
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/margins/preview
git commit -m "feat(marges): API aperçu des prix calculés"
```

---

## Task 11: API appliquer (apply)

**Files:**
- Create: `src/app/api/admin/margins/apply/route.ts`

- [ ] **Step 1: POST**

`src/app/api/admin/margins/apply/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { recomputeAndWritePrices } from '@/lib/margins-db';

export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;
  const body = await request.json().catch(() => ({}));
  const brand: string | undefined = body.brand || undefined;
  const productIds: string[] | undefined = Array.isArray(body.productIds) ? body.productIds : undefined;

  const result = await recomputeAndWritePrices({ brand, productIds });
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/margins/apply
git commit -m "feat(marges): API application des prix calculés"
```

---

## Task 12: API stats (marges réalisées)

**Files:**
- Create: `src/app/api/admin/margins/stats/route.ts`

- [ ] **Step 1: GET**

`src/app/api/admin/margins/stats/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

const PAID_STATUSES = ['paid', 'shipped', 'delivered'];

// GET /api/admin/margins/stats — marges réalisées (lignes avec coût figé).
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;
  const db = createAdminClient();

  // Commandes encaissées uniquement.
  const { data: paidOrders } = await db
    .from('orders').select('id').in('status', PAID_STATUSES);
  const paidIds = new Set((paidOrders ?? []).map((o) => o.id));

  const { data: items } = await db
    .from('order_items')
    .select('order_id, quantity, price_at_purchase, cost_at_purchase');

  let totalMarginEuro = 0;
  let totalCost = 0;
  let salesCount = 0;
  for (const it of items ?? []) {
    if (!paidIds.has(it.order_id)) continue;
    if (it.cost_at_purchase == null) continue; // historique sans coût → exclu
    const qty = it.quantity || 1;
    const price = Number(it.price_at_purchase) || 0;
    const cost = Number(it.cost_at_purchase) || 0;
    totalMarginEuro += (price - cost) * qty;
    totalCost += cost * qty;
    salesCount += qty;
  }

  const avgMarginPct = totalCost > 0 ? totalMarginEuro / totalCost : 0;
  return NextResponse.json({
    stats: { totalMarginEuro, salesCount, avgMarginPct },
  });
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/margins/stats
git commit -m "feat(marges): API stats des marges réalisées"
```

---

## Task 13: Checkout — figer le coût à la vente

**Files:**
- Modify: `src/app/api/checkout/route.ts:158-167`

- [ ] **Step 1: Ajouter `cost_at_purchase`**

Dans `src/app/api/checkout/route.ts`, dans le `.map` qui construit `orderItems`, ajouter la ligne `cost_at_purchase` après `price_at_purchase` :

```ts
    const orderItems = cartItems.map((item) => ({
      order_id: order.id,
      product_id: item.product.id,
      quantity: item.quantity,
      price_at_purchase: parseFloat(item.product.price),
      cost_at_purchase:
        item.product.cost_price != null
          ? parseFloat(item.product.cost_price)
          : parseFloat(item.product.price),
      product_name: [item.product.brand, item.product.model, item.product.storage_capacity]
        .filter(Boolean)
        .join(' ') || null,
      product_sku: item.product.sku || null,
    }));
```

> `cartItems` charge déjà `product:products(*)` → `cost_price` est présent. Repli sur
> `price` si `cost_price` est NULL (sécurité).

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/checkout/route.ts
git commit -m "feat(marges): figer cost_at_purchase au checkout"
```

---

## Task 14: Fluxitron — écrire le coût et recalculer le prix

**Files:**
- Modify: `src/app/api/v1/prices/batch/route.ts`

- [ ] **Step 1: Écrire `cost_price` (au lieu de `price`) puis recalculer**

Remplacer le corps de la boucle d'update et ajouter le recalcul. Dans
`src/app/api/v1/prices/batch/route.ts`, remplacer le bloc `updateData`/update
(lignes ~40-48) par :

```ts
        // Fluxitron envoie le PRIX FOURNISSEUR → il alimente cost_price.
        // price (prix de vente) est recalculé ensuite via les règles de marge.
        const updateData: Record<string, any> = { cost_price: price };
        if (compareAtPrice !== undefined) {
          updateData.compare_at_price = compareAtPrice;
        }

        const { error } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', targetId);

        if (error) return { ok: false, id: targetId, error: error.message };
        return { ok: true, id: targetId };
```

Puis, juste avant `const res = NextResponse.json({ success, failed, errors });`,
ajouter le recalcul des prix de vente des produits touchés :

```ts
    // Recalcule price (vente) pour les produits dont le coût vient de changer.
    const touchedIds = results.filter((r) => r.ok).map((r) => r.id);
    if (touchedIds.length > 0) {
      const { recomputeAndWritePrices } = await import('@/lib/margins-db');
      await recomputeAndWritePrices({ productIds: touchedIds });
    }
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/v1/prices/batch/route.ts
git commit -m "feat(marges): Fluxitron alimente cost_price puis recalcule price"
```

---

## Task 15: Page admin `/admin/margins`

Page client suivant le style des pages admin existantes (styles inline + classes
`admin-*`, cf. `src/app/admin/orders/page.tsx`).

**Files:**
- Create: `src/app/admin/margins/page.tsx`

- [ ] **Step 1: Créer la page**

`src/app/admin/margins/page.tsx` :

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Rounding, MarginType, ScopeLevel } from '@/lib/margins';

interface StatsResp { totalMarginEuro: number; salesCount: number; avgMarginPct: number; }
interface PreviewRow {
  productId: string; brand: string; model: string; grade: string | null;
  storage: string | null; color: string | null; cost: number;
  oldPrice: number; newPrice: number; marginPct: number;
  ruleApplied: string | null; coherenceAdjusted: boolean; lowMargin: boolean;
}
interface Rule {
  id: string; scope_level: ScopeLevel; brand: string | null; model: string | null;
  product_id: string | null; grade: 'A' | 'B' | 'C' | null;
  margin_type: MarginType; margin_percent: number | null; margin_fixed: number | null;
  rounding: Rounding;
}

const ROUNDINGS: { v: Rounding; label: string }[] = [
  { v: 'cent', label: 'Au centime' },
  { v: 'decicent', label: 'Au 1/10 de centime' },
  { v: 'euro', label: "À l'euro" },
  { v: 'five_euro', label: 'À 5 €' },
  { v: 'ten_euro', label: 'À 10 €' },
  { v: 'ends_99', label: 'Finit par ,99' },
];

const eur = (n: number) => `${n.toFixed(2)} €`;
const pct = (n: number) => `${(n * 100).toFixed(1)} %`;

export default function MarginsPage() {
  const [stats, setStats] = useState<StatsResp | null>(null);
  const [settings, setSettings] = useState({ coherence_enabled: false, coherence_min_gap_percent: 5 });
  const [rules, setRules] = useState<Rule[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [brand, setBrand] = useState('');
  const [grade, setGrade] = useState('');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    const r = await fetch('/api/admin/margins/stats');
    const d = await r.json();
    setStats(d.stats);
  }, []);
  const loadSettings = useCallback(async () => {
    const r = await fetch('/api/admin/margins/settings');
    const d = await r.json();
    setSettings(d.settings);
  }, []);
  const loadRules = useCallback(async () => {
    const r = await fetch('/api/admin/margins/rules');
    const d = await r.json();
    setRules(d.rules);
  }, []);
  const loadPreview = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (brand) qs.set('brand', brand);
    if (grade) qs.set('grade', grade);
    const r = await fetch(`/api/admin/margins/preview?${qs}`);
    const d = await r.json();
    setRows(d.rows ?? []);
    setLoading(false);
  }, [brand, grade]);

  useEffect(() => { loadStats(); loadSettings(); loadRules(); }, [loadStats, loadSettings, loadRules]);
  useEffect(() => { loadPreview(); }, [loadPreview]);

  const saveSettings = async (next: typeof settings) => {
    setSettings(next);
    await fetch('/api/admin/margins/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next),
    });
    loadPreview();
  };

  const apply = async () => {
    setApplying(true);
    const r = await fetch('/api/admin/margins/apply', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: brand || undefined }),
    });
    const d = await r.json();
    setApplying(false);
    setMessage(`${d.updated} prix mis à jour.`);
    loadPreview();
  };

  const brands = Array.from(new Set(rows.map((r) => r.brand))).sort();

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 500, color: '#0f172a', marginBottom: 4 }}>Marges</h1>
        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Réglage des marges et des prix de vente à partir du prix fournisseur.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Marge totale réalisée" value={stats ? eur(stats.totalMarginEuro) : '—'} />
        <StatCard label="Ventes comptabilisées" value={stats ? String(stats.salesCount) : '—'} />
        <StatCard label="Marge moyenne" value={stats ? pct(stats.avgMarginPct) : '—'} />
      </div>

      {/* Cohérence A>B>C */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 500, color: '#0f172a' }}>
          <input
            type="checkbox"
            checked={settings.coherence_enabled}
            onChange={(e) => saveSettings({ ...settings, coherence_enabled: e.target.checked })}
          />
          Maintenir la logique de prix A &gt; B &gt; C
        </label>
        <div style={{ marginTop: 10, fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
          Écart minimum entre grades :
          <input
            type="number" min={0} step={1}
            value={settings.coherence_min_gap_percent}
            onChange={(e) => setSettings({ ...settings, coherence_min_gap_percent: Number(e.target.value) })}
            onBlur={() => saveSettings(settings)}
            style={{ width: 70, padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 6 }}
          /> %
        </div>
      </div>

      {/* Règles */}
      <RulesEditor rules={rules} onChange={() => { loadRules(); loadPreview(); }} />

      {/* Filtres + Appliquer */}
      <div className="admin-filters" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '24px 0 16px' }}>
        <select value={brand} onChange={(e) => setBrand(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8 }}>
          <option value="">Toutes les marques</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={grade} onChange={(e) => setGrade(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8 }}>
          <option value="">Tous grades</option>
          <option value="A">Grade A</option>
          <option value="B">Grade B</option>
          <option value="C">Grade C</option>
        </select>
        <button
          onClick={apply} disabled={applying}
          style={{ marginLeft: 'auto', padding: '8px 16px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}
        >
          {applying ? 'Application…' : 'Appliquer les prix'}
        </button>
      </div>
      {message && <p style={{ color: '#16a34a', fontSize: '0.85rem', marginBottom: 12 }}>{message}</p>}

      {/* Aperçu */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#64748b' }}>
              <th style={{ padding: 10 }}>Produit</th>
              <th style={{ padding: 10 }}>Grade</th>
              <th style={{ padding: 10 }}>Coût</th>
              <th style={{ padding: 10 }}>Ancien</th>
              <th style={{ padding: 10 }}>Nouveau</th>
              <th style={{ padding: 10 }}>Marge</th>
              <th style={{ padding: 10 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Chargement…</td></tr>
            ) : rows.map((r) => (
              <tr key={r.productId} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: 10 }}>{r.brand} {r.model}{r.storage ? ` · ${r.storage}` : ''}{r.color ? ` · ${r.color}` : ''}</td>
                <td style={{ padding: 10 }}>{r.grade ?? '—'}</td>
                <td style={{ padding: 10 }}>{eur(r.cost)}</td>
                <td style={{ padding: 10, color: '#94a3b8' }}>{eur(r.oldPrice)}</td>
                <td style={{ padding: 10, fontWeight: 600, color: r.newPrice !== r.oldPrice ? '#0f172a' : '#64748b' }}>{eur(r.newPrice)}</td>
                <td style={{ padding: 10, color: r.lowMargin ? '#dc2626' : '#16a34a' }}>{pct(r.marginPct)}</td>
                <td style={{ padding: 10 }}>
                  {r.coherenceAdjusted && <span title="Prix remonté pour cohérence A>B>C" style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 4 }}>A&gt;B&gt;C</span>}
                  {r.lowMargin && <span title="Marge faible" style={{ marginLeft: 4, fontSize: '0.7rem', background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: 4 }}>marge faible</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 600, color: '#0f172a' }}>{value}</div>
    </div>
  );
}

function RulesEditor({ rules, onChange }: { rules: Rule[]; onChange: () => void }) {
  const [form, setForm] = useState({
    scope_level: 'global' as ScopeLevel, brand: '', model: '', product_id: '',
    grade: '' as '' | 'A' | 'B' | 'C', margin_type: 'percent' as MarginType,
    margin_percent: 20, margin_fixed: 0, rounding: 'ends_99' as Rounding,
  });

  const addRule = async () => {
    await fetch('/api/admin/margins/rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope_level: form.scope_level,
        brand: form.brand || null, model: form.model || null,
        product_id: form.product_id || null, grade: form.grade || null,
        margin_type: form.margin_type, margin_percent: form.margin_percent,
        margin_fixed: form.margin_fixed, rounding: form.rounding,
      }),
    });
    onChange();
  };
  const delRule = async (id: string) => {
    await fetch(`/api/admin/margins/rules/${id}`, { method: 'DELETE' });
    onChange();
  };

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: 12 }}>Règles de marge</h2>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <select value={form.scope_level} onChange={(e) => setForm({ ...form, scope_level: e.target.value as ScopeLevel })}>
          <option value="global">Global</option>
          <option value="brand">Marque</option>
          <option value="model">Modèle</option>
          <option value="product">Produit</option>
        </select>
        {(form.scope_level === 'brand' || form.scope_level === 'model') &&
          <input placeholder="Marque" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />}
        {form.scope_level === 'model' &&
          <input placeholder="Modèle" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />}
        {form.scope_level === 'product' &&
          <input placeholder="ID produit" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} />}
        <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value as '' | 'A' | 'B' | 'C' })}>
          <option value="">Tous grades</option><option value="A">A</option><option value="B">B</option><option value="C">C</option>
        </select>
        <select value={form.margin_type} onChange={(e) => setForm({ ...form, margin_type: e.target.value as MarginType })}>
          <option value="percent">%</option><option value="fixed">€</option><option value="combined">% + €</option>
        </select>
        {form.margin_type !== 'fixed' &&
          <input type="number" placeholder="%" value={form.margin_percent} onChange={(e) => setForm({ ...form, margin_percent: Number(e.target.value) })} style={{ width: 70 }} />}
        {form.margin_type !== 'percent' &&
          <input type="number" placeholder="€" value={form.margin_fixed} onChange={(e) => setForm({ ...form, margin_fixed: Number(e.target.value) })} style={{ width: 70 }} />}
        <select value={form.rounding} onChange={(e) => setForm({ ...form, rounding: e.target.value as Rounding })}>
          {ROUNDINGS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
        </select>
        <button onClick={addRule} style={{ padding: '6px 12px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Ajouter</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ padding: 8 }}>{r.scope_level}{r.brand ? ` · ${r.brand}` : ''}{r.model ? ` ${r.model}` : ''}{r.grade ? ` · grade ${r.grade}` : ''}</td>
              <td style={{ padding: 8 }}>
                {r.margin_type === 'fixed' ? `+${r.margin_fixed} €`
                  : r.margin_type === 'percent' ? `+${r.margin_percent} %`
                  : `+${r.margin_percent} % +${r.margin_fixed} €`}
              </td>
              <td style={{ padding: 8, color: '#64748b' }}>{ROUNDINGS.find((x) => x.v === r.rounding)?.label}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>
                <button onClick={() => delRule(r.id)} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 3: Vérifier le rendu**

Run: `npm run dev`, ouvrir `/admin/margins`.
Expected: stats affichées, toggle cohérence, éditeur de règles, tableau d'aperçu avec avant/après.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/margins/page.tsx
git commit -m "feat(marges): page admin de gestion des marges"
```

---

## Task 16: Lien de navigation

**Files:**
- Modify: `src/app/admin/layout.tsx:21-29`

- [ ] **Step 1: Ajouter l'entrée de menu**

Dans `src/app/admin/layout.tsx`, importer une icône `Percent` depuis `lucide-react`
(ajouter à l'import existant `lucide-react`), puis ajouter dans `navItems` après la
ligne Catalogue :

```ts
  { href: '/admin/margins', label: 'Marges', icon: Percent, badgeKey: null },
```

- [ ] **Step 2: Vérifier**

Run: `npm run dev`, vérifier le lien « Marges » dans la barre latérale admin.
Expected: lien présent, navigue vers `/admin/margins`.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "feat(marges): lien Marges dans la navigation admin"
```

---

## Vérification finale

- [ ] `npx vitest run` → tous les tests de `src/lib/margins.test.ts` passent.
- [ ] `npx tsc --noEmit --skipLibCheck` → aucune erreur.
- [ ] Flux manuel : créer une règle global +20 % arrondi ,99 → Aperçu montre les
  nouveaux prix → Appliquer → vérifier `products.price` en base.
- [ ] Activer la cohérence → vérifier qu'un cas B>A est corrigé (A remonté).
- [ ] Passer une commande de test → `order_items.cost_at_purchase` rempli →
  `/api/admin/margins/stats` reflète la marge.

---

## Notes de revue (auto-vérification)

- **Couverture spec :** cost_price (T6) ✓, cost_at_purchase (T6/T13) ✓, margin_rules/settings (T6) ✓, logique pure cascade+arrondi+cohérence (T2-T5) ✓, API CRUD/settings/preview/apply/stats (T8-T12) ✓, Fluxitron (T14) ✓, page UI + stats + filtres marque/grade (T15) ✓, nav (T16) ✓.
- **Grade des règles** = grade client A/B/C via `displayGrade()` (cohérent spec).
- **Marge % = (vente − coût)/coût** (markup), utilisée dans stats et aperçu.
- **Arrondi porté par la règle** ; cohérence ré-arrondit VERS LE HAUT (`roundUp`) pour ne pas repasser sous le seuil.
- **Hors périmètre confirmé :** pas de backfill historique, pas d'arrondi global séparé, pas de versioning des règles.
```
