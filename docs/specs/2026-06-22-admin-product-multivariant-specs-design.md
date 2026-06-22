# Design — Formulaire d'ajout produit boutique : multi-variantes + caractéristiques

- **Date** : 2026-06-22
- **Statut** : approuvé (brainstorming)
- **Périmètre** : panneau admin boutique (`source = 'manual'`)

## 1. Contexte & problème

La page [`/admin/products/new`](../../../src/app/admin/products/new/page.tsx) ne crée
**qu'une seule ligne** `products` à la fois (1 stockage, 1 grade, 1 couleur). Or le
site modélise un modèle comme **N lignes sœurs** partageant `(brand, model)`, chacune
étant une variante `(storage, grade, color)` — c'est la matrice construite par
[`buildVariantMatrix`](../../../src/lib/productVariants.ts).

Par ailleurs, les **caractéristiques techniques** affichées sur la fiche
([`TechSpecs`](../../../src/components/products/TechSpecs.tsx)) proviennent d'un
**dictionnaire codé en dur** ([`iphoneSpecs.ts`](../../../src/lib/iphoneSpecs.ts)),
uniquement pour les iPhone connus. Le champ « Description » du formulaire admin
n'alimente **pas** ces blocs. Un modèle non listé (autre marque, nouveau modèle) →
aucune caractéristique affichée.

## 2. Objectifs

1. Saisir **plusieurs capacités** × **plusieurs grades** × **plusieurs couleurs** en
   une seule opération → 1 ligne `products` par combinaison.
2. **Pas de gestion de quantité** pour la boutique : chaque variante est « toujours
   disponible » (décision D1).
3. Section **caractéristiques techniques** structurée par thème (identique à la fiche),
   **pré-remplie** depuis le dictionnaire pour les iPhone connus et **éditable /
   override** sinon, **stockée en base** et affichée sur la fiche — y compris hors Apple.
4. Catalogue admin **boutique** : **1 ligne par `(stockage, grade)`**, couleurs fondues
   (décision D2 : périmètre boutique uniquement).

## 3. Non-objectifs (hors périmètre)

- Onglets / produits **Fluxitron** : regroupement et contenu **inchangés**.
- Champs `imei` et `battery_health` : **retirés** du formulaire de lot (la batterie
  affichée par grade reste dérivée du grade via `displayGradeMeta().battery`, cf.
  [`ProductDetailClient.tsx:194`](../../../src/app/products/[id]/ProductDetailClient.tsx#L194)).
- Page d'**édition** d'un produit existant ([`/admin/products/[id]`](../../../src/app/admin/products/[id]/page.tsx)) :
  l'éditeur de specs **n'y est pas ajouté** dans ce lot de travail (suivi possible).

## 4. Décisions actées

| # | Décision | Choix retenu |
|---|----------|--------------|
| A1 | Où stocker les specs | **Colonne `specs jsonb` nullable sur `products`** (dénormalisée, comme le reste). Fallback dictionnaire si `null`. |
| A2 | Création de N variantes | **Un seul POST** `/api/admin/products` enrichi acceptant `variants[]` → `insert([...])` groupé. POST mono-produit conservé (rétro-compat). |
| D1 | Disponibilité boutique | **Toujours disponible** : `stock = 999` à la création ; le catalogue admin affiche « Disponible » (pas un chiffre) pour `source = 'manual'`. |
| D2 | Périmètre regroupement `(stockage, grade)` | **Boutique uniquement** ; Fluxitron garde `(stockage)`. |

## 5. Modèle de données

### 5.1 Migration SQL

```sql
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS specs jsonb;
```

- Nullable, défaut `NULL` → les 6415 lignes existantes retombent sur le dictionnaire.
- Pas de contrainte de forme en base ; la forme est validée côté applicatif.

### 5.2 Forme de l'objet `specs`

Miroir de [`IphoneSpec`](../../../src/lib/iphoneSpecs.ts) (11 champs) :

```ts
interface ProductSpecs {
  annee: number | null;
  ecran: string;
  puce: string;
  photo: string;
  selfie: string;
  video: string;
  autonomie: string;
  connectique: string;
  reseau: '4G' | '5G' | '';
  resistance: string;
  poids: string;
}
```

- La **Garantie** (ligne « Autonomie & infos » de la fiche) n'entre **pas** dans
  `specs` : elle est lue depuis la colonne `warranty` existante, avec fallback
  `« 24 mois incluse »` (comportement actuel codé en dur, légèrement amélioré).
- Un objet `specs` entièrement vide n'est pas écrit (`NULL` plutôt) pour préserver le
  fallback dictionnaire.

### 5.3 Stock par défaut

Constante partagée `MANUAL_DEFAULT_STOCK = 999` (nouvelle, dans `groupByModel.ts` ou
`products.ts`). Chaque variante boutique est insérée avec ce stock.

## 6. API — `POST /api/admin/products`

Le handler ([`route.ts`](../../../src/app/api/admin/products/route.ts)) accepte deux formes :

- **Mono** (existant) : corps = un produit → 1 insert. Inchangé.
- **Lot** (nouveau) : corps contient `variants: Variant[]` (+ champs partagés). Le
  serveur construit et insère toutes les lignes en **un seul `insert([...])`**.

```ts
// Corps « lot »
{
  brand, model, category,            // partagés
  warranty, condition_description,   // partagés
  images,                            // partagés (string[])
  specs,                             // partagé (ProductSpecs | null)
  variants: [                        // 1 entrée par (storage, grade, color)
    { storage_capacity, grade, color, price, compare_at_price }
  ]
}
```

Règles serveur :
- Validation : `brand`, `model`, `category` requis ; `variants` non vide ; chaque
  variante a un `price > 0`.
- Chaque ligne insérée : `source: 'manual'`, `is_active: true`,
  `stock: MANUAL_DEFAULT_STOCK`, `specs` (ou `null` si vide), champs partagés répliqués.
- `nullIfEmpty` conservé pour les champs optionnels.
- Réponse : `{ products: [...], count }` (201). En cas d'erreur d'insert, rien n'est
  créé (insert atomique).

## 7. Formulaire « Nouveau produit » (refonte)

Fichier : [`/admin/products/new/page.tsx`](../../../src/app/admin/products/new/page.tsx).
Découpage en sous-composants sous `/admin/products/new/_components/` pour garder le
fichier lisible (le formulaire devient nettement plus riche).

### 7.1 Sections

1. **Identité** — Marque* (select + « Autre »), Modèle*, Catégorie*. Inchangé.
2. **Déclinaisons** — 3 multi-sélecteurs à chips :
   - **Capacités** : `64 / 128 / 256 / 512 Go`, `1 To` + ajout libre. ≥ 1 requis.
   - **Grades** : `A+, A, B+, B, C+, C` (D/E exclus, conforme à la règle existante).
     ≥ 1 requis.
   - **Couleurs** : chips prédéfinies (depuis [`colors.ts`](../../../src/lib/colors.ts))
     + ajout libre. ≥ 1 requise.
3. **Prix par capacité × grade** — table générée dynamiquement : 1 ligne par
   `(capacité, grade)` cochés. Colonnes : **Prix\*** et **Prix barré** (optionnel).
   Le prix est **partagé entre couleurs** (un refurb price dépend du stockage+grade,
   pas de la couleur). Helper « appliquer ce prix à toute la colonne ».
   **Aucun champ stock.**
4. **Caractéristiques techniques** — cf. §7.3.
5. **Images** — dropzone existante, **partagée** par tout le lot.
6. **Garantie & description** — `warranty`, `condition_description`, **partagés**.

### 7.2 Récapitulatif & soumission

- Ligne live : « Cette saisie créera **N variantes** (`capacités × grades × couleurs`) ».
- À la soumission : construction du tableau `variants` = produit cartésien
  `{capacité} × {grade} × {couleur}`, avec le prix/prix barré de la cellule
  `(capacité, grade)` correspondante ; envoi en un POST « lot ».

### 7.3 Section caractéristiques (auto + override)

- Disposition en **4 thèmes** identiques à la fiche : *Écran & design*,
  *Performances & réseau*, *Photo & vidéo*, *Autonomie & infos*.
- **Pré-remplissage** : à la saisie/sélection du modèle, si
  `getIphoneSpecs(model)` renvoie une entrée **et** que la section n'a pas été éditée
  manuellement → champs pré-remplis. Bouton explicite **« Réinitialiser depuis le
  modèle »**. Bandeau « Pré-rempli depuis `<modèle>` » quand actif.
- Modèle inconnu / autre marque → champs vides.
- `reseau` = select (`4G` / `5G`) ; `annee` = number ; le reste = texte.
- À la création : `specs` joint au POST (partagé) ; écrit sur **chaque** ligne, ou
  `null` si toute la section est vide.

## 8. Fiche produit (front)

[`TechSpecs`](../../../src/components/products/TechSpecs.tsx) :
- Nouvelle prop optionnelle `specs?: ProductSpecs | null`.
- Source des données : **`specs` (override) en priorité, sinon `getIphoneSpecs(model)`**.
- Le garde-fou « Apple uniquement » est **assoupli** : le bloc s'affiche dès qu'une
  source existe (override **ou** dictionnaire) → les caractéristiques s'affichent
  désormais aussi pour les **non-iPhone** renseignés à la main.
- Ligne « Garantie » : `product.warranty || '24 mois incluse'`.
- [`ProductDetailClient`](../../../src/app/products/[id]/ProductDetailClient.tsx#L515)
  passe `specs={initialSku.specs}` et `warranty={initialSku.warranty}` (déjà
  disponibles via `RawProduct` / `select('*')`).

## 9. Catalogue admin — regroupement (boutique uniquement)

[`groupByModel.ts`](../../../src/app/admin/products/_lib/groupByModel.ts) :
- `groupProductsByModel(products, opts?: { granularity?: 'storage' | 'storage_grade' })`.
- `'storage'` (défaut) = comportement actuel `(brand, model, storage)` → **Fluxitron**.
- `'storage_grade'` = clé `(brand, model, storage, grade)` → **boutique**.
- [`page.tsx`](../../../src/app/admin/products/page.tsx#L429) choisit la granularité
  selon `currentTab.source` (`manual` → `'storage_grade'`, `fluxitron` → `'storage'`).

Affichage :
- En-tête de groupe boutique : `{brand} {model} · {storage} · Grade {grade}`.
- Colonne « Variantes » = nombre de **couleurs** ; déplier → 1 sous-ligne par couleur.
- **Disponibilité** : pour `source = 'manual'`, badge « **Disponible** » au lieu de
  « N en stock » (dans [`ModelRow`](../../../src/app/admin/products/_components/ModelRow.tsx)
  et [`SkuRow`](../../../src/app/admin/products/_components/SkuRow.tsx)). Fluxitron
  conserve l'affichage chiffré.

## 10. Cas limites & validation

- Soumission sans capacité / grade / couleur / prix → erreur bloquante claire.
- Couleur ou capacité saisie en double (libellé normalisé) → dédupliquée.
- Prix `0` ou vide sur une cellule active → bloqué.
- Modèle changé après pré-remplissage manuel → pas d'écrasement (garde « édité »).
- `specs` partiellement rempli → enregistré tel quel (les champs vides s'affichent
  comme aujourd'hui, le composant ne casse pas).

## 11. Fichiers touchés

**Base** : migration `ADD COLUMN specs jsonb`.
**API** : `src/app/api/admin/products/route.ts` (POST lot).
**Form** : `src/app/admin/products/new/page.tsx` + nouveaux `_components/`
(`VariantPicker`, `PriceGrid`, `SpecsEditor`).
**Front** : `src/components/products/TechSpecs.tsx`,
`src/app/products/[id]/ProductDetailClient.tsx`.
**Catalogue admin** : `src/app/admin/products/_lib/groupByModel.ts`,
`src/app/admin/products/page.tsx`, `_components/ModelRow.tsx`, `_components/SkuRow.tsx`.
**Types/constantes** : `ProductSpecs`, `MANUAL_DEFAULT_STOCK`.

## 12. Vérification

Pas de harness de test configuré. Vérification :
- `npx tsc --noEmit --skipLibCheck` (le `lint` du projet est cassé — convention établie).
- Parcours manuel : créer un lot multi-variantes → vérifier N lignes en base
  (1 par combinaison), regroupement `(stockage, grade)` côté admin avec « Disponible »,
  specs pré-remplies sur un iPhone connu, override sur un modèle inconnu, affichage
  fiche (override > dictionnaire), Fluxitron inchangé.
