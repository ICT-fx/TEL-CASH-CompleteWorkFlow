# Refonte visuelle du Dashboard admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the admin dashboard (`/admin`) and its shared primitives (`StatusBadge`, `Avatar`, `MiniBarChart`, `StatTile`, sidebar) to the approved "Vitrine" (1c) visual direction — new color system, readable sales chart with a date axis, cards-with-shadow layout — with zero change to data fetching, API routes, or business logic.

**Architecture:** Six self-contained component/style edits, applied bottom-up (shared primitives first, page last, since the page consumes the primitives). Two of the six extract a pure, unit-tested function (status→visual mapping; chart bar layout) from what is currently inline JSX logic — everything else is presentational (JSX/CSS) and is verified with `tsc --noEmit` + `npm run build` + a manual browser check, matching this codebase's existing testing convention (no component-test framework is set up; `vitest` is used only for pure `lib/*.ts` functions).

**Tech Stack:** Next.js 15 App Router, React (`'use client'`), inline `style` objects + `admin-*` CSS classes in `src/app/globals.css`, `lucide-react` icons, `vitest` for pure-function tests.

**Spec:** `docs/superpowers/specs/2026-08-21-backoffice-visual-redesign-design.md` — read it first. This plan's exact pixel values (colors, sizes, spacing) are sourced from the approved mockup itself (`design-handoffs/backoffice-dashboard/Back-office TEL & CASH.dc.html`, option `1c`, not committed to git) rather than the spec's prose summary, since the raw mockup is more precise where the two differ by a few pixels (e.g. chart bar corner radius, gridline positions). Where this plan and the spec disagree on a number, this plan wins — it was checked against the rendered mockup.

## Global Constraints

- No file under `src/app/api/**` is touched by this plan (the one unrelated security fix already shipped separately, commit `f90c6f4`).
- No new npm dependency for charting — `MiniBarChart` stays a dependency-free inline SVG.
- New font: JetBrains Mono (500/600 only), loaded via `next/font/google` like `Inter` already is — never a `<link>` tag (violates the project's zero-render-blocking-Google-Fonts rule, see `tailwind.config.js` comment on `sans`).
- French UI copy throughout (per `CLAUDE.md`).
- Desktop-first; below 1100px the existing mobile drawer/stacking behavior in `admin/layout.tsx` and the `admin-grid-2`/`admin-kpi-grid` CSS media queries is preserved as-is (not part of this plan — don't touch the `@media` blocks).
- After every task: `npx tsc --noEmit` must be clean and `npm run build` must succeed before committing.

---

### Task 1: `StatusBadge` — new color system + `refunded` split

**Files:**
- Modify: `src/components/admin/ui/StatusBadge.tsx` (full rewrite of the internal map + component body)
- Create: `src/components/admin/ui/statusVisual.ts` (new — the pure, testable mapping function)
- Create: `src/components/admin/ui/statusVisual.test.ts`

**Interfaces:**
- Produces: `getStatusVisual(status: string, opts?: { refunded?: boolean; labelOverride?: string }): { label: string; bg: string; fg: string; dot: string | null; filled: boolean }` — exported from `statusVisual.ts`. `dot: null` means "no dot" (only the `paid` filled case). `filled: true` means white text on a solid `bg`, no dot, `font-weight 600`; `filled: false` means the tinted style (`font-weight 500` for everything except the refunded-cancelled case, which is `600`).
- Consumed by: Task 6 (`admin/page.tsx`, for the "dernières commandes" list) and, later, the (not-yet-planned) Commandes list/detail redesign.

- [ ] **Step 1: Write the failing test for the pure mapping function**

Create `src/components/admin/ui/statusVisual.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getStatusVisual } from './statusVisual';

describe('getStatusVisual', () => {
  it('paid is the only filled/action state', () => {
    const v = getStatusVisual('paid');
    expect(v).toEqual({ label: 'Payée · à traiter', bg: '#2F6BFF', fg: '#FFFFFF', dot: null, filled: true });
  });

  it('pending reads as "Panier ouvert", neutral tint', () => {
    const v = getStatusVisual('pending');
    expect(v).toEqual({ label: 'Panier ouvert', bg: '#F0F0ED', fg: '#6B6B63', dot: '#9A9A90', filled: false });
  });

  it('awaiting_payment reads as "Paiement en attente", same neutral tint as pending', () => {
    const v = getStatusVisual('awaiting_payment');
    expect(v).toEqual({ label: 'Paiement en attente', bg: '#F0F0ED', fg: '#6B6B63', dot: '#9A9A90', filled: false });
  });

  it('supplier_ordered and shipped share the "en cours" blue tint', () => {
    expect(getStatusVisual('supplier_ordered')).toEqual({ label: 'Cmd. fournisseur', bg: '#E7EEFF', fg: '#1B4ACB', dot: '#2F6BFF', filled: false });
    expect(getStatusVisual('shipped')).toEqual({ label: 'Expédiée', bg: '#E7EEFF', fg: '#1B4ACB', dot: '#2F6BFF', filled: false });
  });

  it('shipped with labelOverride "Prête à retirer" keeps the same colors, different text', () => {
    const v = getStatusVisual('shipped', { labelOverride: 'Prête à retirer' });
    expect(v).toEqual({ label: 'Prête à retirer', bg: '#E7EEFF', fg: '#1B4ACB', dot: '#2F6BFF', filled: false });
  });

  it('delivered is green "terminé", labelOverride swaps to "Retirée" for pickup', () => {
    expect(getStatusVisual('delivered')).toEqual({ label: 'Livrée', bg: '#E3F3E9', fg: '#12693F', dot: '#12693F', filled: false });
    expect(getStatusVisual('delivered', { labelOverride: 'Retirée' })).toEqual({ label: 'Retirée', bg: '#E3F3E9', fg: '#12693F', dot: '#12693F', filled: false });
  });

  it('refunded (the "Retour" DB status, not a cancelled order) and failed are neutral', () => {
    expect(getStatusVisual('refunded')).toEqual({ label: 'Retour traité', bg: '#F0F0ED', fg: '#6B6B63', dot: '#9A9A90', filled: false });
    expect(getStatusVisual('failed')).toEqual({ label: 'Paiement échoué', bg: '#F0F0ED', fg: '#6B6B63', dot: '#9A9A90', filled: false });
  });

  it('disputed is the red "problème" tint', () => {
    expect(getStatusVisual('disputed')).toEqual({ label: 'Litige', bg: '#FBE9E7', fg: '#B02A1E', dot: '#B02A1E', filled: false });
  });

  it('cancelled without refunded=true reads as "Paiement non finalisé", neutral', () => {
    expect(getStatusVisual('cancelled')).toEqual({ label: 'Paiement non finalisé', bg: '#F0F0ED', fg: '#6B6B63', dot: '#9A9A90', filled: false });
    expect(getStatusVisual('cancelled', { refunded: false })).toEqual({ label: 'Paiement non finalisé', bg: '#F0F0ED', fg: '#6B6B63', dot: '#9A9A90', filled: false });
  });

  it('cancelled with refunded=true reads as "Annulée & remboursée", red problem tint', () => {
    expect(getStatusVisual('cancelled', { refunded: true })).toEqual({ label: 'Annulée & remboursée', bg: '#FBE9E7', fg: '#B02A1E', dot: '#B02A1E', filled: false });
  });

  it('refunded has no effect on a non-cancelled status', () => {
    expect(getStatusVisual('paid', { refunded: true })).toEqual({ label: 'Payée · à traiter', bg: '#2F6BFF', fg: '#FFFFFF', dot: null, filled: true });
  });

  it('unknown status falls back to a gray "Inconnu" state', () => {
    expect(getStatusVisual('bogus')).toEqual({ label: 'Inconnu', bg: '#F1F5F9', fg: '#475569', dot: '#475569', filled: false });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/admin/ui/statusVisual.test.ts`
Expected: FAIL — `Cannot find module './statusVisual'` (the file doesn't exist yet).

- [ ] **Step 3: Write `statusVisual.ts`**

Create `src/components/admin/ui/statusVisual.ts`:

```typescript
// Statut de commande → présentation visuelle (libellé, couleurs, point).
// Source de vérité unique pour StatusBadge et pour tout écran qui a besoin
// de ces couleurs sans passer par le composant React (ex. export CSV plus
// tard). Une teinte = un sens, l'intensité = l'urgence — voir le détail des
// règles dans docs/superpowers/specs/2026-08-21-backoffice-visual-redesign-design.md.

export interface StatusVisual {
  label: string;
  bg: string;
  fg: string;
  dot: string | null; // null uniquement pour le variant "plein" (paid)
  filled: boolean;
}

interface StatusEntry {
  label: string;
  bg: string;
  fg: string;
  dot: string | null;
  filled: boolean;
}

const NEUTRAL: Omit<StatusEntry, 'label'> = { bg: '#F0F0ED', fg: '#6B6B63', dot: '#9A9A90', filled: false };
const EN_COURS: Omit<StatusEntry, 'label'> = { bg: '#E7EEFF', fg: '#1B4ACB', dot: '#2F6BFF', filled: false };
const TERMINE: Omit<StatusEntry, 'label'> = { bg: '#E3F3E9', fg: '#12693F', dot: '#12693F', filled: false };
const PROBLEME: Omit<StatusEntry, 'label'> = { bg: '#FBE9E7', fg: '#B02A1E', dot: '#B02A1E', filled: false };

const STATUS: Record<string, StatusEntry> = {
  pending: { label: 'Panier ouvert', ...NEUTRAL },
  awaiting_payment: { label: 'Paiement en attente', ...NEUTRAL },
  paid: { label: 'Payée · à traiter', bg: '#2F6BFF', fg: '#FFFFFF', dot: null, filled: true },
  supplier_ordered: { label: 'Cmd. fournisseur', ...EN_COURS },
  shipped: { label: 'Expédiée', ...EN_COURS },
  delivered: { label: 'Livrée', ...TERMINE },
  refunded: { label: 'Retour traité', ...NEUTRAL },
  failed: { label: 'Paiement échoué', ...NEUTRAL },
  disputed: { label: 'Litige', ...PROBLEME },
  // cancelled has no single entry — cf. getStatusVisual, dédoublé sur `refunded`.
};

const CANCELLED_UNPAID: StatusEntry = { label: 'Paiement non finalisé', ...NEUTRAL };
const CANCELLED_REFUNDED: StatusEntry = { label: 'Annulée & remboursée', ...PROBLEME, filled: false };
const FALLBACK: StatusEntry = { label: 'Inconnu', bg: '#F1F5F9', fg: '#475569', dot: '#475569', filled: false };

export function getStatusVisual(
  status: string,
  opts?: { refunded?: boolean; labelOverride?: string }
): StatusVisual {
  let entry: StatusEntry;
  if (status === 'cancelled') {
    entry = opts?.refunded ? CANCELLED_REFUNDED : CANCELLED_UNPAID;
  } else {
    entry = STATUS[status] || FALLBACK;
  }
  const label = opts?.labelOverride || entry.label;
  return { label, bg: entry.bg, fg: entry.fg, dot: entry.dot, filled: entry.filled };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/admin/ui/statusVisual.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Rewrite `StatusBadge.tsx` to use it**

Replace the full content of `src/components/admin/ui/StatusBadge.tsx`:

```tsx
// Order status → visual presentation. Thin React wrapper around the pure
// mapping in statusVisual.ts (unit-tested there) — this file only renders.

import type { CSSProperties } from 'react';
import { getStatusVisual } from './statusVisual';

// Exposed so other views can read the canonical label without the badge.
export function statusLabelFr(status: string, refunded?: boolean): string {
  return getStatusVisual(status, { refunded }).label;
}

interface StatusBadgeProps {
  status: string;
  // Optional label override (e.g. "Prête à retirer" / "Retirée" for pickup).
  label?: string;
  // Only meaningful when status === 'cancelled': true = payée puis
  // remboursée (rouge, problème) ; false/omis = jamais payée (gris, neutre).
  refunded?: boolean;
  style?: CSSProperties;
}

export function StatusBadge({ status, label, refunded, style }: StatusBadgeProps) {
  const v = getStatusVisual(status, { refunded, labelOverride: label });
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: v.bg,
        color: v.fg,
        fontSize: '0.75rem',
        fontWeight: v.filled ? 600 : 500,
        padding: '3px 9px',
        borderRadius: 6,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {v.dot && (
        <span
          aria-hidden
          style={{ width: 6, height: 6, borderRadius: '50%', background: v.dot }}
        />
      )}
      {v.label}
    </span>
  );
}
```

- [ ] **Step 6: Verify no caller breaks**

Run: `npx tsc --noEmit`
Expected: no errors. `statusLabelFr` gained an optional second parameter (backward compatible), `StatusBadge` gained an optional `refunded` prop (backward compatible) — every existing call site (`admin/orders/page.tsx`, `admin/orders/[id]/page.tsx`, `admin/page.tsx`, `admin/clients/**`) keeps compiling unchanged. Do not edit those call sites in this task — Task 6 wires `refunded` into `admin/page.tsx` specifically; the Commandes list/detail pages get it in the not-yet-planned follow-up.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/ui/statusVisual.ts src/components/admin/ui/statusVisual.test.ts src/components/admin/ui/StatusBadge.tsx
git commit -m "feat(admin): nouveau système de couleurs de statut (1a) + split annulée/remboursée"
```

---

### Task 2: `Avatar` — monochrome

**Files:**
- Modify: `src/components/admin/ui/Avatar.tsx`

**Interfaces:**
- Produces: same `Avatar({ name, email, size })` signature — no breaking change, every call site (dashboard, Commandes, Clients) keeps working untouched.

- [ ] **Step 1: Replace the palette logic**

In `src/components/admin/ui/Avatar.tsx`, delete the `PALETTE` array and the `paletteIndex` function (lines 11–37 of the current file), and change the component body to use fixed colors:

```tsx
// Round avatar with initials — monochrome background (the old 8-color random
// palette was pure visual noise, no information: two clients rarely share a
// color anyway, and inconsistent hues made lists feel cluttered).

interface AvatarProps {
  name?: string | null;
  email?: string | null;
  size?: number;
}

function getInitials(name?: string | null, email?: string | null): string {
  const n = (name || '').trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  const e = (email || '').trim();
  return e ? e.slice(0, 2).toUpperCase() : '?';
}

export function Avatar({ name, email, size = 40 }: AvatarProps) {
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#EFEFEC',
        color: '#6B6B63',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 500,
        fontSize: Math.round(size * 0.38),
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {getInitials(name, email)}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: clean (no prop signature changed).

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/ui/Avatar.tsx
git commit -m "feat(admin): avatars clients monochromes (1a)"
```

---

### Task 3: `MiniBarChart` — readable date axis

**Files:**
- Modify: `src/components/admin/ui/MiniBarChart.tsx` (full rewrite)
- Create: `src/components/admin/ui/barLayout.ts` (new — pure, testable geometry + label logic)
- Create: `src/components/admin/ui/barLayout.test.ts`

**Interfaces:**
- Produces: `buildBarLayout(data: { date: string; total: number }[], opts?: { labelEvery?: number }): BarLayoutItem[]` where `BarLayoutItem = { date: string; x: number; y: number; w: number; h: number; fill: string; cx: number; dateLabel: string; showLabel: boolean; tooltip: string }`.
- Consumed by: `MiniBarChart.tsx` only (not exported further).

**Geometry, read directly off the approved mockup** (`design-handoffs/backoffice-dashboard/Back-office TEL & CASH.dc.html`, option `1c`, the `<svg viewBox="0 0 1080 190">` block): `viewBox` is `0 0 1080 190`, `overflow:visible`, no `preserveAspectRatio`. Three horizontal gridlines: baseline `y=150.5` (`stroke #E4E7EC`), two lighter ones at `y=100.5` and `y=50.5` (`stroke #F1F3F7`), all `stroke-width 1`. Bars: `rx=4`. Date label text: `y=169`, `fill #8A93A3`, `font 500 11px Inter`. This plan keeps the existing 30-bar / `gap 6` sizing math already implied by the current component (`barW = (1080 - gap*(n-1)) / n`) rather than the mockup's per-bar day-of-week second line, which this plan intentionally drops for scope: the mockup shows it because Claude Design rendered a two-line label for illustration, but with 30 bars at ~30px width a second text line doubles the visual noise the whole redesign is trying to remove, and the spec's own written rule (§3, "Correctif prioritaire") only asks for the date line. If the client wants the day-of-week line too after seeing the real chart, that's a one-line follow-up, not blocking this task.

- [ ] **Step 1: Write the failing test**

Create `src/components/admin/ui/barLayout.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildBarLayout } from './barLayout';

function days(n: number, startISO = '2026-07-23') {
  const start = new Date(startISO + 'T00:00:00Z');
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), total: i * 10 };
  });
}

describe('buildBarLayout', () => {
  it('returns one item per input day', () => {
    const out = buildBarLayout(days(30));
    expect(out).toHaveLength(30);
  });

  it('computes 30 equal-width bars spanning the 1080-wide viewBox with gap 6', () => {
    const out = buildBarLayout(days(30));
    const expectedW = (1080 - 6 * 29) / 30;
    expect(out[0].w).toBeCloseTo(expectedW, 5);
    expect(out[0].x).toBe(0);
    expect(out[1].x).toBeCloseTo(expectedW + 6, 5);
  });

  it('bar height scales to the max value, baseline at y=150.5, min height 3 for zero days', () => {
    const data = [{ date: '2026-08-01', total: 0 }, { date: '2026-08-02', total: 100 }];
    const out = buildBarLayout(data);
    expect(out[0].h).toBe(3); // jour à zéro : hauteur plancher, reste visible
    expect(out[0].fill).toBe('#EDEDEA');
    expect(out[1].h).toBeGreaterThan(out[0].h);
    expect(out[1].fill).toBe('#2F6BFF');
    // y + h doit toujours atteindre la ligne de base (les barres poussent vers le haut).
    expect(out[0].y + out[0].h).toBeCloseTo(150.5, 5);
    expect(out[1].y + out[1].h).toBeCloseTo(150.5, 5);
  });

  it('labels every 3rd bar plus always the last one, others get showLabel=false', () => {
    const out = buildBarLayout(days(30), { labelEvery: 3 });
    expect(out[0].showLabel).toBe(true);   // premier jour
    expect(out[3].showLabel).toBe(true);   // 1 sur 3
    expect(out[1].showLabel).toBe(false);
    expect(out[2].showLabel).toBe(false);
    expect(out[29].showLabel).toBe(true);  // toujours le dernier jour
  });

  it('date label omits the month name except on the first bar, the last bar, and days 1-3 of a month', () => {
    // 23 juillet -> 21 août sur 30 jours : coupe le mois autour du 1er août.
    const out = buildBarLayout(days(30));
    const first = out[0]; // 23 juil
    expect(first.dateLabel).toBe('23 juil.');
    const last = out[29]; // 21 août
    expect(last.dateLabel).toBe('21 août');
    const aug1 = out.find((b) => b.date === '2026-08-01')!;
    expect(aug1.dateLabel).toBe('1 août');
    const aug15 = out.find((b) => b.date === '2026-08-15')!;
    expect(aug15.dateLabel).toBe('15'); // ni bord, ni début de mois : jour seul
  });

  it('tooltip always includes the full French date and the formatted amount', () => {
    const out = buildBarLayout([{ date: '2026-08-03', total: 1234.5 }]);
    expect(out[0].tooltip).toBe('3 août 2026 — 1 234,50 €');
  });

  it('returns an empty array for empty input', () => {
    expect(buildBarLayout([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/admin/ui/barLayout.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `barLayout.ts`**

Create `src/components/admin/ui/barLayout.ts`:

```typescript
// Géométrie + libellés d'axe du graphique de ventes — extrait de MiniBarChart
// pour être testable sans rendre du SVG. Valeurs de mise en page reprises au
// pixel près de la maquette approuvée (direction "Vitrine", 1c) :
// viewBox 1080x190, ligne de base y=150.5, rx=4.

export interface BarDatum {
  date: string; // YYYY-MM-DD
  total: number;
}

export interface BarLayoutItem {
  date: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  cx: number; // centre horizontal, pour positionner le texte
  dateLabel: string;
  showLabel: boolean;
  tooltip: string;
}

const VIEW_W = 1080;
const BASELINE_Y = 150.5;
const BAR_AREA_H = 148; // du haut utile (y≈2.5) à la ligne de base
const GAP = 6;
const MIN_H = 3;
const COLOR_VALUE = '#2F6BFF';
const COLOR_ZERO = '#EDEDEA';

function eur(n: number): string {
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

// "23 juil.", "1 août", "15" (jour seul si ni bord ni tout début de mois).
function formatAxisLabel(iso: string, isFirst: boolean, isLast: boolean): string {
  const d = new Date(iso + 'T00:00:00Z');
  const day = d.getUTCDate();
  const withMonth = isFirst || isLast || day <= 3;
  if (!withMonth) return String(day);
  const month = d.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' });
  // "août" ne prend pas de point abréviatif (déjà court) ; les autres mois si.
  const monthLabel = month.endsWith('.') || month === 'août' ? month : `${month}.`;
  return `${day} ${monthLabel}`;
}

function formatTooltipDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function buildBarLayout(data: BarDatum[], opts: { labelEvery?: number } = {}): BarLayoutItem[] {
  if (!data || data.length === 0) return [];
  const labelEvery = opts.labelEvery ?? 3;
  const n = data.length;
  const barW = (VIEW_W - GAP * (n - 1)) / n;
  const max = Math.max(1, ...data.map((d) => d.total));

  return data.map((d, i) => {
    const h = d.total > 0 ? Math.max(MIN_H, (d.total / max) * BAR_AREA_H) : MIN_H;
    const isZero = d.total <= 0;
    const x = i * (barW + GAP);
    const isFirst = i === 0;
    const isLast = i === n - 1;
    const showLabel = isFirst || isLast || i % labelEvery === 0;
    return {
      date: d.date,
      x,
      y: BASELINE_Y - h,
      w: barW,
      h,
      fill: isZero ? COLOR_ZERO : COLOR_VALUE,
      cx: x + barW / 2,
      dateLabel: formatAxisLabel(d.date, isFirst, isLast),
      showLabel,
      tooltip: `${formatTooltipDate(d.date)} — ${eur(d.total)}`,
    };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/admin/ui/barLayout.test.ts`
Expected: PASS (7 tests). If the month-abbreviation test fails on punctuation (`'fr-FR'` short-month formatting is ICU-implementation-dependent across Node versions — e.g. it may return `"juil."` with the period already included, or `"aout"` without an accent on some minimal ICU builds), adjust `formatAxisLabel`'s trailing-dot logic to match what `Intl.DateTimeFormat('fr-FR',{month:'short'})` actually returns in this environment (log it once, then hardcode the observed behavior) rather than fighting the runtime's ICU data.

- [ ] **Step 5: Rewrite `MiniBarChart.tsx`**

Replace the full content of `src/components/admin/ui/MiniBarChart.tsx`:

```tsx
// Dependency-free SVG bar chart — one bar per day, with a readable date axis.
// Used by the Dashboard for the 30-day sales overview. No chart library.

import { buildBarLayout, type BarDatum } from './barLayout';

interface MiniBarChartProps {
  data: BarDatum[];
  height?: number;
  ariaLabel?: string;
}

export function MiniBarChart({
  data,
  height = 190,
  ariaLabel = 'Ventes des 30 derniers jours',
}: MiniBarChartProps) {
  if (!data || data.length === 0) {
    return <div style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>Aucune donnée</div>;
  }

  const bars = buildBarLayout(data);

  return (
    <svg
      viewBox="0 0 1080 190"
      style={{ width: '100%', height, display: 'block', overflow: 'visible' }}
      role="img"
      aria-label={ariaLabel}
    >
      <line x1={0} y1={150.5} x2={1080} y2={150.5} stroke="#E4E7EC" strokeWidth={1} />
      <line x1={0} y1={100.5} x2={1080} y2={100.5} stroke="#F1F3F7" strokeWidth={1} />
      <line x1={0} y1={50.5} x2={1080} y2={50.5} stroke="#F1F3F7" strokeWidth={1} />
      {bars.map((b) => (
        <g key={b.date}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill={b.fill}>
            <title>{b.tooltip}</title>
          </rect>
          {b.showLabel && (
            <text x={b.cx} y={169} textAnchor="middle" fill="#8A93A3" style={{ font: '500 11px Inter, sans-serif' }}>
              {b.dateLabel}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
```

- [ ] **Step 6: Update the one call site**

`src/app/admin/page.tsx` currently calls `<MiniBarChart data={salesByDay} />` where `salesByDay: { date: string; total: number }[]` — this matches `BarDatum` exactly, no change needed there. Confirm with:

Run: `npx tsc --noEmit`
Expected: clean. (The removed `valueFormatter` prop was never passed at the one call site — verify with `grep -n "MiniBarChart" src/app/admin/page.tsx` that only the `data` prop is passed.)

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/ui/barLayout.ts src/components/admin/ui/barLayout.test.ts src/components/admin/ui/MiniBarChart.tsx
git commit -m "feat(admin): graphique de ventes avec axe de dates lisible (plus besoin de survoler)"
```

---

### Task 4: `StatTile` — Vitrine sizing + icon pastille + full-fill variant

**Files:**
- Modify: `src/components/admin/ui/StatTile.tsx`

**Interfaces:**
- Produces: `StatTile({ value, label, hint, delta, icon, tone, variant, style })`. New props: `tone?: 'blue' | 'green' | 'amber' | 'gray'` (colors the icon pastille background — default `'gray'`; unrelated to `accent`, which is removed, see below) and `variant?: 'default' | 'accent-fill'` (default `'default'`; `'accent-fill'` renders the mockup's solid-blue "À expédier" tile). The old `accent?: string` prop (freeform hex for the value's text color) is **removed** — it's exactly the kind of "arbitrary color, no shared meaning" the redesign eliminates. `admin/page.tsx` (Task 6) is the only caller and is updated in the same plan.

- [ ] **Step 1: Replace the component**

Replace the full content of `src/components/admin/ui/StatTile.tsx`:

```tsx
// Key figure tile — Vitrine direction (1c): big tabular-nums value, small
// icon pastille top-right, optional delta chip vs. a previous period.

import type { CSSProperties, ReactNode } from 'react';

interface StatTileProps {
  value: ReactNode;
  label: string;
  hint?: ReactNode;
  // Variation vs previous period, in percent. Omit when not computable.
  delta?: number | null;
  icon?: ReactNode;
  // Couleur de la pastille d'icône — un sens par teinte (cf. statusVisual.ts),
  // jamais une couleur arbitraire. 'gray' = neutre/informatif (défaut).
  tone?: 'blue' | 'green' | 'amber' | 'gray';
  // 'accent-fill' = la tuile pleine bleue (réservée à UNE seule tuile par
  // écran : celle qui appelle vraiment à l'action, ex. "À expédier").
  variant?: 'default' | 'accent-fill';
  style?: CSSProperties;
}

const TONE_BG: Record<NonNullable<StatTileProps['tone']>, string> = {
  blue: '#EEF3FF',
  green: '#E3F3E9',
  amber: '#F6ECD8',
  gray: '#EFF1F5',
};
const TONE_DOT: Record<NonNullable<StatTileProps['tone']>, string> = {
  blue: '#2F6BFF',
  green: '#12693F',
  amber: '#B0781A',
  gray: '#8A93A3',
};

export function StatTile({ value, label, hint, delta, icon, tone = 'gray', variant = 'default', style }: StatTileProps) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const positive = hasDelta && (delta as number) >= 0;
  const filled = variant === 'accent-fill';

  return (
    <div
      style={{
        background: filled ? '#2F6BFF' : '#FFFFFF',
        borderRadius: 14,
        padding: '18px 20px 20px',
        boxShadow: filled
          ? '0 2px 12px rgba(47,107,255,.28)'
          : '0 1px 2px rgba(16,24,40,.05), 0 4px 16px rgba(16,24,40,.04)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ font: '500 12px Inter, sans-serif', color: filled ? 'rgba(255,255,255,.82)' : '#6B7280' }}>
          {label}
        </div>
        {icon && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: filled ? 'rgba(255,255,255,.18)' : TONE_BG[tone],
              color: filled ? '#FFFFFF' : TONE_DOT[tone],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </div>
        )}
      </div>
      <div
        style={{
          font: '700 34px/1.05 Inter, sans-serif',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-.03em',
          color: filled ? '#FFFFFF' : '#111827',
          marginTop: 12,
        }}
      >
        {value}
      </div>
      {(hint || hasDelta) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
          {hasDelta && (
            <span
              style={{
                font: '600 11.5px/1.5 Inter, sans-serif',
                color: positive ? '#12693F' : '#B02A1E',
                background: positive ? '#E3F3E9' : '#FBE9E7',
                padding: '2px 7px',
                borderRadius: 6,
              }}
            >
              {positive ? '+' : ''}{(delta as number).toFixed(0)} %
            </span>
          )}
          {hint && (
            <span style={{ font: '400 11.5px/1.4 Inter, sans-serif', color: filled ? 'rgba(255,255,255,.82)' : '#9CA3AF' }}>
              {hint}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify — expect a break at the one call site, that's Task 6's job**

Run: `npx tsc --noEmit`
Expected: **errors in `src/app/admin/page.tsx`** — it still passes the removed `accent` prop on 1 of the 4 `<StatTile>` calls (the revenue tile, `accent="#1d4ed8"`). That's expected and fixed in Task 6, not here — don't touch `admin/page.tsx` in this task. Confirm the error is exactly that (`Object literal may only specify known properties, and 'accent' does not exist...`) and nothing else, so Task 6 knows exactly what it's inheriting.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/ui/StatTile.tsx
git commit -m "feat(admin): StatTile — gros chiffres, pastille d'icône teintée, variant plein bleu"
```

(Committing with a known, documented `tsc` error in a *different* file is unusual — justified here only because Task 6 fixes it immediately next and the two are meant to land close together; if you're executing this plan with review gates between tasks, say so explicitly in the task handoff so the reviewer isn't surprised by a red `tsc`.)

---

### Task 5: Sidebar — light theme, blue "Commandes" badge

**Files:**
- Modify: `src/app/globals.css` (color values only, in the sidebar section, lines ~260–369, and `.admin-main`/`.admin-content` background)
- Modify: `src/app/admin/layout.tsx` (inline badge color)

**Interfaces:** none — pure CSS/color changes, the component tree and props are untouched.

- [ ] **Step 1: Update the sidebar colors in `globals.css`**

In `src/app/globals.css`, replace the block from `.admin-layout {` through `.sidebar-user-role { ... }` (current lines 260–369) with:

```css
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #EDEFF3;
}

/* Sidebar — direction "Vitrine" (1c) : fond clair, plus de navy. */
.admin-sidebar {
  width: 220px;
  background: #FFFFFF;
  color: #4B5563;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 50;
  border-right: 1px solid #E2E5EB;
  transition: width 0.3s ease;
}
.admin-sidebar.collapsed { width: 72px; }

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 16px 14px;
  border-bottom: none;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 9px;
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: -0.01em;
  color: #111827;
  text-decoration: none;
}

.sidebar-toggle {
  background: #F4F6F9;
  border: none;
  color: #6B7280;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: background 0.2s;
}
.sidebar-toggle:hover { background: #E9ECF1; }

.sidebar-nav {
  flex: 1;
  padding: 4px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 9px;
  color: #4B5563;
  text-decoration: none;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: background 0.12s ease-out, color 0.12s ease-out;
  border: none;
  background: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
}
.sidebar-link:hover { background: #F4F6F9; color: #111827; }
.sidebar-link.active { background: #EEF3FF; color: #1B4ACB; font-weight: 600; }

.sidebar-footer {
  padding: 12px 12px 4px;
  border-top: 1px solid #F1F3F7;
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px;
  margin-top: 4px;
}

.sidebar-user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #EEF1F5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.75rem;
  color: #4B5563;
  flex-shrink: 0;
}

.sidebar-user-info { overflow: hidden; }
.sidebar-user-name { font-size: 0.78rem; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sidebar-user-role { font-size: 0.69rem; color: #9CA3AF; }
```

- [ ] **Step 2: Update `.admin-main` margin to match the new 220px sidebar**

In the same file, find `.admin-main { ... margin-left: 260px; ... }` and `.admin-main.expanded { margin-left: 72px; }` (current lines 372–380) and change `margin-left: 260px` to `margin-left: 220px` (the collapsed value, 72px, is unchanged — that's the sidebar's own collapsed width, untouched by this task).

- [ ] **Step 3: Update `.admin-content` background to match the new page background**

Find `.admin-content { padding: 28px; flex: 1; }` (current line ~416) and the topbar. The topbar (`.admin-topbar`) stays white with its existing `border-bottom: 1px solid #e2e8f0` — only the page body behind the cards changes. No CSS change needed here beyond what Task 1's `.admin-layout` background already covers (the content area has no background of its own today, it inherits `.admin-layout`'s — confirm this by checking there's no `background` declared on `.admin-content` before/after; if there is one, remove it so the new `#EDEFF3` shows through).

- [ ] **Step 4: Recolor the "Commandes" badge to blue in `admin/layout.tsx`**

In `src/app/admin/layout.tsx`, the sidebar link render block has two places with a hardcoded `background: '#dc2626'` (the collapsed-state floating badge and the expanded-state inline badge, inside the `navItems.map(...)` block). Both currently apply the same red to every `badgeKey`-bearing item — today that's `pending_orders` (Commandes) and `pending_returns` (Retours). Per the spec, "Commandes" becomes blue (a queue isn't a problem); "Retours" is left red (a pending return is closer to the "needs attention" cases the spec reserves red for, and the spec doesn't name it — this is the plan's explicit call, not a guess to make silently at implementation time).

Change the badge color to be looked up per item instead of hardcoded. Add a `badgeColor` field to `navItems`:

```typescript
const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, badgeKey: null, badgeColor: null },
  { href: '/admin/stats', label: 'Statistiques', icon: BarChart3, badgeKey: null, badgeColor: null },
  { href: '/admin/products', label: 'Catalogue', icon: Package, badgeKey: null, badgeColor: null },
  { href: '/admin/margins', label: 'Marges', icon: Percent, badgeKey: null, badgeColor: null },
  { href: '/admin/prix', label: 'Prix', icon: Tag, badgeKey: null, badgeColor: null },
  { href: '/admin/orders', label: 'Commandes', icon: ShoppingCart, badgeKey: 'pending_orders' as const, badgeColor: '#2F6BFF' },
  { href: '/admin/carts', label: 'Paniers', icon: ShoppingBag, badgeKey: null, badgeColor: null },
  { href: '/admin/returns', label: 'Retours', icon: RotateCcw, badgeKey: 'pending_returns' as const, badgeColor: '#B02A1E' },
  { href: '/admin/clients', label: 'Clients', icon: Users, badgeKey: null, badgeColor: null },
  { href: '/admin/blocklist', label: 'Blocklist', icon: ShieldAlert, badgeKey: null, badgeColor: null },
  { href: '/admin/disputes', label: 'Litiges', icon: Gavel, badgeKey: null, badgeColor: null },
  { href: '/admin/verification-retrait', label: 'Vérif. retrait', icon: QrCode, badgeKey: null, badgeColor: null },
];
```

Then in the two badge-rendering spots inside `navItems.map(...)`, replace the hardcoded `background: '#dc2626'` with `background: item.badgeColor || '#dc2626'` (the fallback keeps any future badgeKey-bearing item without an explicit color visibly red rather than silently invisible/black).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run build`
Expected: succeeds.

Then start the dev server and open `/admin` in a browser to visually confirm: sidebar is white/light, "Commandes" nav item's badge (if any pending orders exist) is blue, "Retours" badge (if any) is red, active nav item has the pale-blue `#EEF3FF` background with `#1B4ACB` text.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/app/admin/layout.tsx
git commit -m "feat(admin): sidebar claire (1c), badge Commandes en bleu plutôt que rouge"
```

---

### Task 6: `admin/page.tsx` — full Vitrine dashboard layout

**Files:**
- Modify: `src/app/admin/page.tsx` (full rewrite of the JSX body; data-fetching `useEffect` and `AdminDashboardPage` function signature unchanged)

**Interfaces:**
- Consumes: `StatTile` (Task 4: `tone`, `variant` props), `StatusBadge` (Task 1: `refunded` prop), `Avatar` (Task 2, no prop change), `MiniBarChart` (Task 3, no prop change), `EntityCard` (unchanged).
- No change to `GET /api/admin/stats` — same shape consumed: `stats.{totalRevenue,revenueDelta,paidOrders,totalProducts,totalUsers,totalOrders,pendingOrders,paidOrdersTotal}`, `recentOrders[]` (each with `id, order_number, status, delivery_method, total_amount, created_at, refund_amount, refunded_at, profile:{full_name,email}`), `lowStock[]`, `salesByDay[]`, `topModels[]`.

**Ground truth for exact spacing/typography**: the mockup (`design-handoffs/backoffice-dashboard/Back-office TEL & CASH.dc.html`, option `1c`) — this task's JSX below was built by reading that file's inline styles directly (see the KPI grid, chart+paniers grid, and lists sections).

- [ ] **Step 1: Replace the component**

Replace the full content of `src/app/admin/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DollarSign, Truck, Package, Users, AlertTriangle, ArrowRight, TrendingUp,
  ShoppingCart, ChevronRight,
} from 'lucide-react';
import { StatTile } from '@/components/admin/ui/StatTile';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { EntityCard } from '@/components/admin/ui/EntityCard';
import { MiniBarChart } from '@/components/admin/ui/MiniBarChart';
import { Avatar } from '@/components/admin/ui/Avatar';
import { normalizeGradeLetter } from '@/lib/products';
import { colorLabelFr } from '@/lib/colors';

interface LowStockItem {
  id: string;
  brand: string | null;
  model: string | null;
  stock: number;
  storage_capacity: string | null;
  color: string | null;
  grade: string | null;
}

function lowStockLabel(p: LowStockItem): string {
  const grade = normalizeGradeLetter(p.grade);
  return [
    [p.brand, p.model].filter(Boolean).join(' '),
    p.storage_capacity || null,
    grade ? `Grade ${grade}` : null,
    p.color ? colorLabelFr(p.color) : null,
  ].filter(Boolean).join(' · ');
}

// Retrouve le libellé pickup-aware ("Prête à retirer"/"Retirée") sans
// dupliquer la logique déjà écrite pour l'admin détail commande.
function pickupAwareLabel(status: string, isPickup: boolean): string | undefined {
  if (!isPickup) return undefined;
  if (status === 'shipped') return 'Prête à retirer';
  if (status === 'delivered') return 'Retirée';
  return undefined;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [salesByDay, setSalesByDay] = useState<{ date: string; total: number }[]>([]);
  const [topModels, setTopModels] = useState<{ name: string; qty: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => {
        setStats(d.stats);
        setRecentOrders(d.recentOrders || []);
        setLowStock(d.lowStock || []);
        setSalesByDay(d.salesByDay || []);
        setTopModels(d.topModels || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sales30 = salesByDay.reduce((s, d) => s + d.total, 0);
  const bestDay = salesByDay.reduce<{ date: string; total: number } | null>(
    (best, d) => (!best || d.total > best.total ? d : best),
    null
  );
  const maxTopModelQty = topModels[0]?.qty || 1;

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ font: '700 24px/1.15 Inter, sans-serif', letterSpacing: '-.02em', color: '#111827' }}>
          Tableau de bord
        </h1>
        <p style={{ font: '400 13px Inter, sans-serif', color: '#6B7280', marginTop: 4 }}>
          Vue d&apos;ensemble de votre activité
        </p>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="admin-kpi-grid" style={{ marginBottom: 14 }}>
          <StatTile
            label="Chiffre d'affaires"
            value={`${stats.totalRevenue?.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`}
            delta={stats.revenueDelta}
            hint={stats.revenueDelta == null ? `${stats.paidOrders} commandes payées` : 'vs 30 j précédents'}
            tone="blue"
            icon={<DollarSign className="w-4 h-4" />}
          />
          <StatTile
            label="À expédier"
            value={String(stats.paidOrders)}
            hint="commandes payées à traiter"
            icon={<Truck className="w-4 h-4" />}
            variant="accent-fill"
          />
          <StatTile
            label="Produits actifs"
            value={String(stats.totalProducts)}
            hint={`${lowStock.length} en stock faible`}
            tone="amber"
            icon={<Package className="w-4 h-4" />}
          />
          <StatTile
            label="Clients"
            value={String(stats.totalUsers)}
            hint={`${stats.totalOrders} commandes au total`}
            tone="gray"
            icon={<Users className="w-4 h-4" />}
          />
        </div>
      )}

      {/* Graphique + Paniers, côte à côte */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, alignItems: 'stretch', marginBottom: 14 }} className="admin-chart-row">
        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px 16px', boxShadow: '0 1px 2px rgba(16,24,40,.05), 0 4px 16px rgba(16,24,40,.04)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ font: '600 14px Inter, sans-serif', color: '#111827' }}>Ventes des 30 derniers jours</div>
              <div style={{ font: '700 26px/1.15 Inter, sans-serif', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em', color: '#2F6BFF', marginTop: 6 }}>
                {sales30.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
              </div>
            </div>
            {bestDay && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ font: '400 11.5px Inter, sans-serif', color: '#9CA3AF' }}>Meilleure journée</div>
                <div style={{ font: '600 13px Inter, sans-serif', color: '#111827' }}>
                  {bestDay.total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} € ·{' '}
                  {new Date(bestDay.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 16 }}>
            <MiniBarChart data={salesByDay} />
          </div>
        </div>

        {stats && (() => {
          const carts = stats.pendingOrders || 0;
          const paid = stats.paidOrdersTotal || 0;
          const total = paid + carts;
          const conv = total > 0 ? Math.round((paid / total) * 100) : null;
          const paidPct = total > 0 ? (paid / total) * 100 : 0;
          return (
            <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px 22px', boxShadow: '0 1px 2px rgba(16,24,40,.05), 0 4px 16px rgba(16,24,40,.04)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ font: '600 14px Inter, sans-serif', color: '#111827' }}>Paniers</div>
              <div style={{ font: '400 12px Inter, sans-serif', color: '#9CA3AF', marginTop: 4 }}>
                Checkout lancé, paiement non finalisé
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 16 }}>
                <div style={{ font: '700 40px/1 Inter, sans-serif', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.03em', color: '#111827' }}>
                  {carts}
                </div>
                <div style={{ font: '500 13px Inter, sans-serif', color: '#6B7280' }}>ouverts</div>
              </div>
              <div style={{ display: 'flex', height: 8, borderRadius: 5, overflow: 'hidden', marginTop: 18, background: '#EFF1F5' }}>
                <div style={{ width: `${paidPct}%`, background: '#12693F' }} />
                <div style={{ width: `${100 - paidPct}%`, background: '#D5D8DE' }} />
              </div>
              {conv != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 9 }}>
                  <div style={{ font: '500 11.5px Inter, sans-serif', color: '#12693F' }}>{conv} % convertis</div>
                  <div style={{ font: '500 11.5px Inter, sans-serif', color: '#9CA3AF' }}>{paid} payés · {carts} ouverts</div>
                </div>
              )}
              <div style={{ marginTop: 'auto', paddingTop: 18 }}>
                <Link
                  href="/admin/carts"
                  style={{
                    display: 'block', font: '600 12.5px Inter, sans-serif', color: '#1B4ACB',
                    background: '#EEF3FF', padding: '11px 14px', borderRadius: 9, textAlign: 'center',
                    textDecoration: 'none',
                  }}
                >
                  Relancer les {carts} panier{carts === 1 ? '' : 's'}
                </Link>
              </div>
            </div>
          );
        })()}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14, alignItems: 'start' }} className="admin-bottom-row">
        {/* Dernières commandes */}
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(16,24,40,.05), 0 4px 16px rgba(16,24,40,.04)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px' }}>
            <div style={{ font: '600 14px Inter, sans-serif', color: '#111827' }}>Dernières commandes</div>
            <Link href="/admin/orders" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: '600 12.5px Inter, sans-serif', color: '#1B4ACB', textDecoration: 'none' }}>
              Tout voir <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: '0.85rem', padding: '0 22px 20px' }}>Aucune commande</div>
          ) : (
            recentOrders.map((o: any) => {
              const isPickup = o.delivery_method === 'pickup';
              const refunded = o.status === 'cancelled' && Boolean(o.refunded_at || o.refund_amount);
              return (
                <div
                  key={o.id}
                  onClick={() => router.push(`/admin/orders/${o.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 13, padding: '12px 22px',
                    borderTop: '1px solid #F1F3F7', cursor: 'pointer',
                  }}
                >
                  <Avatar name={o.profile?.full_name} email={o.profile?.email} size={36} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ font: '600 13px Inter, sans-serif', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {o.profile?.full_name || o.profile?.email || 'Client'}
                    </div>
                    <div style={{ font: '400 11.5px Inter, sans-serif', color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {o.order_number != null ? `n°${o.order_number}` : ''}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right', width: 86 }}>
                    <div style={{ font: '700 13.5px Inter, sans-serif', fontVariantNumeric: 'tabular-nums', color: '#111827', textDecoration: refunded ? 'line-through' : 'none' }}>
                      {parseFloat(o.total_amount).toFixed(2)} €
                    </div>
                    <div style={{ font: '400 11px Inter, sans-serif', color: '#9CA3AF' }}>
                      {new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, width: 158, display: 'flex', justifyContent: 'flex-end' }}>
                    <StatusBadge status={o.status} label={pickupAwareLabel(o.status, isPickup)} refunded={refunded} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Stock faible */}
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(16,24,40,.05), 0 4px 16px rgba(16,24,40,.04)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '18px 20px 14px' }}>
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#B0781A' }} />
              <div style={{ font: '600 14px Inter, sans-serif', color: '#111827' }}>Stock faible</div>
            </div>
            {lowStock.length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: '0.85rem', padding: '0 20px 18px' }}>
                Tout le stock est correct
              </div>
            ) : (
              lowStock.map((p) => (
                <div
                  key={p.id}
                  onClick={() => router.push(`/admin/products?search=${encodeURIComponent([p.brand, p.model].filter(Boolean).join(' '))}`)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    padding: '11px 20px', borderTop: '1px solid #F1F3F7', cursor: 'pointer',
                  }}
                >
                  <span style={{ font: '400 12.5px Inter, sans-serif', color: '#374151', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lowStockLabel(p)}
                  </span>
                  <span style={{
                    flexShrink: 0, font: '600 11.5px Inter, sans-serif',
                    background: p.stock <= 0 ? '#FBE9E7' : '#F6ECD8',
                    color: p.stock <= 0 ? '#B02A1E' : '#B0781A',
                    padding: '3px 9px', borderRadius: 6,
                  }}>
                    {p.stock <= 0 ? 'Rupture' : `${p.stock} restant${p.stock > 1 ? 's' : ''}`}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Top modèles */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '18px 20px 20px', boxShadow: '0 1px 2px rgba(16,24,40,.05), 0 4px 16px rgba(16,24,40,.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <TrendingUp className="w-3.5 h-3.5" style={{ color: '#12693F' }} />
              <div style={{ font: '600 14px Inter, sans-serif', color: '#111827' }}>Top modèles vendus</div>
            </div>
            {topModels.length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>Aucune vente enregistrée</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {topModels.map((m) => (
                  <div key={m.name}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                      <span style={{ font: '500 12.5px Inter, sans-serif', color: '#374151', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.name}
                      </span>
                      <span style={{ font: '700 12px Inter, sans-serif', fontVariantNumeric: 'tabular-nums', color: '#111827', flexShrink: 0 }}>
                        {m.qty}
                      </span>
                    </div>
                    <div style={{ height: 7, borderRadius: 4, background: '#EFF1F5', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 4, background: '#2F6BFF', width: `${(m.qty / maxTopModelQty) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

Note: `EntityCard` and `ShoppingCart`/`ChevronRight` imports from the original file are no longer used by this rewrite (the "Paniers" block and order/low-stock rows are now hand-styled `div`s to match the mockup's exact row layout, not the generic card component) — remove those two unused imports (`EntityCard`, `ShoppingCart`, `ChevronRight`) or `tsc`/lint will flag them. Re-check the final import list against what's actually referenced in the JSX above before committing.

- [ ] **Step 2: Handle the two new responsive grids**

The old file relied on the pre-existing `.admin-grid-2` CSS class (with its own breakpoint) for the bottom two-column area. This rewrite introduces two **new** inline-styled grids (`admin-chart-row` and `admin-bottom-row` class names added above but with no CSS behind them yet — they're just hooks) that don't collapse on narrow screens. Add their responsive behavior to `src/app/globals.css`, near the existing `.admin-kpi-grid` responsive rule (search for its `@media` block and add these alongside it, same breakpoint):

```css
@media (max-width: 1100px) {
  .admin-chart-row { grid-template-columns: 1fr !important; }
  .admin-bottom-row { grid-template-columns: 1fr !important; }
}
```

(If `.admin-kpi-grid`'s existing media query uses a different breakpoint than 1100px, match that exact value instead — the point is consistency with the rest of the admin's existing responsive behavior, not introducing a second breakpoint system.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: clean — this is also where Task 4's documented `accent` prop error gets resolved (this rewrite doesn't pass `accent` anywhere).

Run: `npm run build`
Expected: succeeds.

Run: `npx vitest run`
Expected: all tests pass (including the two new files from Tasks 1 and 3).

Then manually check in a browser: `/admin` renders the new layout — KPI row with the blue-filled "À expédier" tile, chart with visible date labels along the bottom (no more hover-only dates), "Paniers" card to the right of the chart, dernières commandes list with monochrome avatars and correctly-colored/labelled status badges (including a genuinely cancelled+refunded order showing red with a struck-through amount, if one exists in the data — if not, temporarily fake `refunded: true` in the browser devtools React state to sanity-check the visual, then revert), stock faible and top modèles stacked on the right.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx src/app/globals.css
git commit -m "feat(admin): dashboard — direction Vitrine (1c), cartes contrastées, badges recolorés"
```

---

## Self-review notes (already applied above, kept here for the record)

- **Spec coverage**: §2 (palette/statuses) → Task 1. §3 dashboard layout → Tasks 4 & 6. §3 chart correctif → Task 3. Avatar monochrome (§2) → Task 2. Sidebar (§3) → Task 5. Nothing in the spec's §1–§4 for the Dashboard step is without a task. §1's "Étape 2" (Commandes list/detail) is explicitly out of scope for this plan, as the spec itself states.
- **Placeholder scan**: every step above has real code, not descriptions of code.
- **Type consistency**: `getStatusVisual`'s return shape (`label/bg/fg/dot/filled`) is identical between `statusVisual.ts` (Task 1) and every place it's consumed (`StatusBadge.tsx`, same task). `BarDatum`/`BarLayoutItem` (Task 3) match between `barLayout.ts` and `MiniBarChart.tsx`. `StatTile`'s new `tone`/`variant` props (Task 4) are used with the exact same string literals in Task 6's JSX (`tone="blue"`, `variant="accent-fill"`, etc.) — no drift.
