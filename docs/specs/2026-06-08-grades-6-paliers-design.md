# Design — Système de grades à 6 paliers (A+/A/B+/B/C+/C)

Date : 2026-06-08

## Contexte / problème

Le catalogue ne gère que 3 grades (A/B/C). Foxway/Fluxitron émet 6 grades
(A+, A, B+, B, C+, C). À l'ingestion, le mapper `analyzeGradeValue` **rejetait**
le C+ (`grade = null`, produit désactivé, tag `rejected-grade-c-plus`) et
écrasait A+→A / B+→B. Résultat : un iPhone 13 Mini C+ poussé sur le site
apparaît **sans grade**.

La logique de grade est en plus dupliquée et incohérente :
- deux `normalizeGradeLetter` (lib/products.ts + admin/products/_lib/display.ts),
- l'un rejette C+, l'autre mappe `C+ → B`,
- `['A','B','C']` codé en dur dans ~10 fichiers.

## Objectif

Supporter les 6 grades de bout en bout (ingestion → base → affichage), via une
**source unique de vérité**, et arrêter de rejeter/écraser le `+`.

## Ordre des grades (du meilleur au pire)

`A+ > A > B+ > B > C+ > C` (le `+` = un cran **au-dessus** de la lettre).

## Les 6 paliers

| Grade | Libellé | Sous-texte (usure) | Batterie (convention) |
|-------|---------|--------------------|-----------------------|
| A+ | Comme neuf | Aucune trace d'usure | 100 % |
| A | Excellent état | Traces quasi invisibles | 97 % |
| B+ | Très bon état | Micro-rayures discrètes | 94 % |
| B | Bon état | Légères marques d'usage | 91 % |
| C+ | État correct | Traces visibles assumées | 88 % |
| C | État correct (usé) | Marques marquées assumées | 85 % |

La batterie reste une **convention d'affichage dérivée du grade** (comportement
actuel), pas la santé réelle.

## Architecture

### Source unique — `src/lib/products.ts`
- `GRADES` : tableau ordonné (meilleur → pire) de `{ letter, label, sub, battery }`.
- `GRADE_ORDER` : `['A+','A','B+','B','C+','C']` (dérivé de `GRADES`).
- `GradeLetter` : type union des 6.
- `normalizeGrade(raw)` : reconnaît les 6 grades (avec `+`) + libellés FR legacy ;
  remplace l'ancien `normalizeGradeLetter` qui collapsait en A/B/C.
- `gradeLabelFr` / `gradeMeta(letter)` : lisent `GRADES`.
- Compat : conserver un `normalizeGradeLetter` (ou alias) tant que des appelants
  l'utilisent, mais il renvoie désormais un `GradeLetter`.

### Consommateurs à rebrancher
- `src/app/products/[id]/page.tsx` : `GRADE_META` (→ `GRADES`), `visualGrades`
  (itère `GRADE_ORDER` filtré sur la matrice), batterie dérivée.
- `src/app/products/page.tsx` : filtre `grades = ['A','B','C']` → `GRADE_ORDER`.
- `src/app/admin/products/new/page.tsx` + `[id]/page.tsx` : dropdowns 6 grades.
- `src/app/admin/products/_lib/display.ts` : supprimer le `normalizeGradeLetter`
  dupliqué, réutiliser celui de `lib/products.ts`.
- `src/components/home/Grades.tsx`, `src/components/products/GradeExplainer.tsx`,
  `src/components/products/VisualStateSelector.tsx` : types `'A'|'B'|'C'` →
  `GradeLetter`, filtres `['A','B','C']` → `GRADE_ORDER`.
- `src/lib/productVariants.ts` : commentaires/typage du champ `grade`.

### Ingestion Fluxitron — `src/app/api/v1/_lib/mappers.ts`
- `analyzeGradeValue` : **ne plus rejeter C+** ; renvoyer le grade exact parmi
  les 6 (`A+`/`A`/`B+`/`B`/`C+`/`C`). La détection (`detectGradeFromTags`,
  `detectGradeFromString`) capture déjà le `+` — seul l'analyse finale changeait.
- Supprimer la mécanique `rejectedAsCPlus` (et le tag `rejected-grade-c-plus`)
  côté création/update et dans `enrichFluxitronFromExisting`.

## Correctif des données (backfill)

Produits déjà rejetés C+ : `grade = null` + tag `rejected-grade-c-plus`.
- Re-dériver le grade depuis le tag `grade-c+` → `grade = 'C+'`.
- Retirer le tag `rejected-grade-c-plus`.
- Cible connue : iPhone 13 Mini 128 Go Black (`8bbee17d-1977-4d75-a88e-15c687cd0fad`).

## Vérification

- `npx tsc --noEmit --skipLibCheck` (le lint du projet est cassé).
- Contrôle visuel : la page produit affiche le grade C+ et le sélecteur liste
  les 6 paliers présents en stock, dans l'ordre.

## Hors périmètre

- Pas de changement du schéma DB (le champ `grade` reste un texte libre).
- Pas de migration des prix / batterie réelle.
