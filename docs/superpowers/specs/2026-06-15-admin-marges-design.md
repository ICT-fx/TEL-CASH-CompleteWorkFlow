# Page admin « Marges » — Design

Date : 2026-06-15
Statut : validé (design), à transformer en plan d'implémentation

## Contexte & problème

Aujourd'hui `products.price` contient le **prix fournisseur** brut (issu de
l'import Fluxitron), sans marge. Il n'existe aucune colonne de coût séparée, et
`order_items` ne fige pas le coût à la vente — la marge réalisée est donc
impossible à reconstituer.

Objectifs :

1. Appliquer des **marges** configurables sur les produits, sans perdre le prix
   d'achat de référence.
2. Régler les marges par **grade (A/B/C)**, par **groupe de produits (modèle)**,
   par **marque**, et jusqu'au **produit** individuel.
3. Suivre les **marges réalisées** par vente et la **marge moyenne %**.
4. Garantir une **cohérence de prix A > B > C** (un grade meilleur ne doit jamais
   être moins cher), corrigée artificiellement à la demande.

## Décisions actées

- `products.price` devient le **prix de vente** (coût + marge). Le coût
  fournisseur passe dans une nouvelle colonne `cost_price`. Le front, le panier,
  le checkout et Fluxitron continuent de lire `price` — aucune lecture à modifier
  côté boutique.
- Suivi des marges **à partir du déploiement** : on fige `cost_at_purchase` à
  chaque nouvelle vente. Les anciennes commandes (sans coût fiable) sont exclues
  des stats.
- Hiérarchie des règles en **cascade « le plus spécifique gagne »** :
  Global < Marque < Modèle < Produit, chaque niveau déclinable par grade ou
  « tous grades ».
- Écriture des prix via **aperçu + bouton Appliquer**. En plus, l'import
  Fluxitron recalcule `price` automatiquement quand `cost_price` change.
- Le **grade d'une règle** est le grade client **A/B/C** (repli via
  `displayGrade()` : A+/A→A, B+/B→B, C+/C/D/E→C).
- **Marge % = markup sur le coût** : `(vente − coût) / coût`. Cohérent avec
  « 20 % plus cher » = `coût × 1,20`.
- L'**arrondi est porté par chaque règle** : la règle résolue détermine type,
  valeur et arrondi. Pas de réglage d'arrondi global séparé.

## Modèle de données (migrations SQL)

### `products` (ALTER)
- `cost_price NUMERIC(10,2)` — prix fournisseur.
- Migration de départ : `UPDATE products SET cost_price = price` (puisque `price`
  = prix fournisseur aujourd'hui). Après le 1er « Appliquer », `price` = prix de
  vente calculé.

### `order_items` (ALTER)
- `cost_at_purchase NUMERIC(10,2)` — coût figé au checkout, en parallèle de
  `price_at_purchase`. Nullable (les lignes existantes restent NULL → exclues des
  stats).

### `margin_rules` (nouvelle table)
Une ligne = un cran de la cascade.
- `id UUID PK`
- `scope_level TEXT CHECK IN ('global','brand','model','product')`
- `brand TEXT NULL` — pour scope brand/model
- `model TEXT NULL` — pour scope model (identifié par brand + model)
- `product_id UUID NULL REFERENCES products(id) ON DELETE CASCADE` — pour scope product
- `grade TEXT NULL CHECK IN ('A','B','C')` — NULL = tous grades
- `margin_type TEXT CHECK IN ('percent','fixed','combined')`
- `margin_percent NUMERIC` — utilisé si percent/combined
- `margin_fixed NUMERIC` — euros, utilisé si fixed/combined
- `rounding TEXT CHECK IN ('cent','decicent','euro','five_euro','ten_euro','ends_99')`
- `created_at`, `updated_at TIMESTAMPTZ`
- Unicité : `(scope_level, brand, model, product_id, grade)` (NULLs inclus via
  index approprié).

### `margin_settings` (singleton)
- `id` fixe (une seule ligne)
- `coherence_enabled BOOLEAN DEFAULT false`
- `coherence_min_gap_percent NUMERIC DEFAULT 5`
- `updated_at`

RLS : tables admin → accès service-role / admin uniquement (cf. patterns
`002_rls.sql`).

## Logique pure — `src/lib/margins.ts`

Aucune dépendance React/DB, entièrement testable.

- `resolveRule(product, rules)` → règle la plus spécifique qui matche, dans
  l'ordre de priorité (du + spécifique au − spécifique) :
  1. Produit + grade
  2. Produit
  3. Modèle + grade
  4. Modèle
  5. Marque + grade
  6. Marque
  7. Global + grade
  8. Global
- `computeSellingPrice(cost, rule)` :
  - `percent` → `cost × (1 + margin_percent/100)`
  - `fixed` → `cost + margin_fixed`
  - `combined` → `cost × (1 + margin_percent/100) + margin_fixed`
  - puis arrondi selon `rounding` :
    - `cent` → multiple de 0,01
    - `decicent` → multiple de 0,001
    - `euro` → multiple de 1
    - `five_euro` → multiple de 5
    - `ten_euro` → multiple de 10
    - `ends_99` → arrondi à l'euro le plus proche puis −0,01 (prix en X,99)
- `enforceGradeCoherence(famille, gapPercent)` → pour chaque famille
  **(modèle, stockage, couleur)**, garantit
  `prix(A) ≥ (1+g)·prix(B) ≥ (1+g)²·prix(C)` en **remontant uniquement** les prix
  des grades supérieurs (jamais en baissant, pour préserver la marge cible), puis
  ré-arrondit. Actif seulement si `coherence_enabled`.
- `realizedMarginPct(price, cost)` → `(price − cost) / cost`.

## API — `/api/admin/margins/*`

Protégées admin (middleware `/api/admin/*`).

- `GET    /api/admin/margins/rules` — liste des règles
- `POST   /api/admin/margins/rules` — créer une règle
- `PUT    /api/admin/margins/rules/[id]` — modifier
- `DELETE /api/admin/margins/rules/[id]` — supprimer
- `GET    /api/admin/margins/settings` — toggle cohérence + gap %
- `PUT    /api/admin/margins/settings`
- `GET    /api/admin/margins/preview?brand=&grade=` — pour chaque produit filtré :
  `{ productId, brand, model, grade, storage, color, cost, oldPrice, newPrice,
  marginPct, ruleApplied, coherenceAdjusted, lowMargin }`
- `POST   /api/admin/margins/apply` — écrit `price` pour les produits concernés
  (optionnellement filtré). Recalcule cascade + cohérence côté serveur.
- `GET    /api/admin/margins/stats` — marges réalisées agrégées depuis
  `order_items` (uniquement lignes avec `cost_at_purchase` non NULL) :
  `{ totalMarginEuro, salesCount, avgMarginPct }`.

## Intégration Fluxitron (changement)

Les endpoints batch prix de Fluxitron (`/api/v1/prices…`, cf. `mappers.ts`)
écrivent aujourd'hui `products.price`. Comme Fluxitron envoie le **prix
fournisseur**, on les fait écrire **`cost_price`** puis **recalculer `price`**
via `src/lib/margins.ts` (cascade + cohérence). Un changement de coût fournisseur
se répercute donc automatiquement sur le prix de vente.

Point de vigilance : vérifier les autres écritures de `price` (création produit
admin, mappers Fluxitron update produit/variant) et décider, au cas par cas, si
elles doivent écrire `cost_price` ou rester sur `price`.

## Checkout — figer le coût

Au moment de créer les `order_items` (flux checkout / webhook Stripe), copier le
`cost_price` courant du produit dans `cost_at_purchase`, en parallèle de
`price_at_purchase`.

## Page `/admin/margins` (UI)

Route en anglais pour rester cohérent avec les autres routes admin
(`/admin/orders`, `/admin/products`). Libellé de menu en français : « Marges ».

Style cohérent avec les pages admin existantes (`/admin/orders`,
`/admin/products`). UI en français.

- **En-tête stats** : marge totale réalisée (€), nombre de ventes, marge
  moyenne % `(vente − coût)/coût`.
- **Réglages cohérence** : interrupteur « Maintenir A > B > C » + champ gap %
  (défaut 5).
- **Éditeur de règles** en cascade : ajout/édition/suppression, filtre par
  marque, drill-down jusqu'au produit, déclinaison par grade. Choix du type
  (%/€/combiné) et de l'arrondi par règle.
- **Aperçu** : tableau avant/après par produit avec marge %, badges d'alerte
  (marge faible, incohérence A/B/C corrigée), puis bouton **Appliquer**.

## Hors périmètre (YAGNI)

- Pas de backfill des marges historiques (stats à partir du déploiement).
- Pas de réglage d'arrondi global séparé (porté par règle).
- Pas d'historique/versioning des règles de marge.
- Pas de planification automatique des recalculs (manuel + à l'import Fluxitron).

## Tests

- Tests unitaires `src/lib/margins.ts` : résolution de cascade (chaque niveau de
  priorité), chaque type de marge, chaque mode d'arrondi (dont `ends_99`),
  cohérence A/B/C (remontée seule, gap respecté, ré-arrondi).
- Vérification d'intégration : import Fluxitron → `cost_price` mis à jour →
  `price` recalculé ; checkout → `cost_at_purchase` figé ; stats correctes.
