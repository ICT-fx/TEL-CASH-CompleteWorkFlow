# Catalogue 100 % magasin + prix manuels (abandon Fluxitron)

Date : 2026-06-22
Statut : design validé, en attente de relecture avant plan d'implémentation

## 1. Contexte & objectif

On **lâche Fluxitron pour l'instant**. Tout le catalogue doit devenir **« magasin »**
(produits possédés par la boutique, plus du dropshipping synchronisé). Conséquences voulues :

1. Les produits importés de Fluxitron deviennent définitivement des produits magasin.
2. Les **prix sont saisis à la main**, choisis par **(modèle, stockage, grade)** uniquement.
3. La **couleur n'est plus une variante de prix** : elle devient une **option** sur une variante
   (ex. *iPhone 12 / 128 Go / B* dispo en rouge, vert, bleu… au **même prix**).
4. Les **images associées à chaque téléphone sont conservées** pour les pages client.

## 2. Décisions actées (entretien de cadrage)

| # | Sujet | Décision |
|---|-------|----------|
| D1 | Structure catalogue | **Consolider** : 1 ligne `products` par `(modèle, stockage, grade affiché, couleur)`. Fusionner les ~7 lignes-offres dupliquées par variante. |
| D2 | Où vit le prix | **`products.price` dénormalisé** : même prix écrit sur toutes les lignes couleur d'un `(modèle, stockage, grade)`. Moteur de marges auto **désactivé**. |
| D3 | Images | **Garder le système actuel** (map curatée `modelImages.ts` par `marque\|modèle\|couleur` + fallback DB). Aucune migration d'images. |
| D4 | Abandon Fluxitron | **Convertir `source='fluxitron'` → `'manual'`** + **couper les routes `/api/v1/*`**. |
| D5 | Granularité grade | **3 grades client A/B/C** (A+/A→A, B+/B→B, C+/C→C ; D/E exclus). Le grade **stocké** des lignes consolidées devient la lettre affichée. |
| D6 | Prix de départ | **Pré-remplir** la grille admin avec le prix client actuel (éditable). |
| D7 | Stock à la fusion | **Repartir à zéro** : `stock=0` partout, à saisir à la main ensuite. |

## 3. État actuel (vérité terrain — code + base live `klungktcrjlwxqfbbbec`)

- **Table `products` à plat, 6 415 lignes** (4 183 actives). Pas de table `variants`, pas de table
  `product_images`. Une ligne = **une offre fournisseur**, pas une variante.
  - 6 415 lignes → **2 922** combinaisons `(marque,modèle,stockage,grade,couleur)` → **833**
    combinaisons `(modèle,stockage,grade)`. Soit ~7 offres dupliquées par variante.
- **Colonnes clés** : `brand`, `model`, `storage_capacity` (texte sale), `color`, `grade`, `price`,
  `compare_at_price`, `cost_price`, `stock`, `images text[]`, `is_active`, `source`
  (`'manual'`|`'fluxitron'`, défaut `'manual'`, migration `006_product_source.sql`),
  `fluxitron_group_id`, `is_fluxitron_group_parent`, `category` (`'telephones'`=6407 / `'accessoires'`=8).
- **Source** : 4 961 lignes `fluxitron`, 1 454 `manual`. Le storefront public n'a **aucun filtre
  `source`** (`src/app/api/products/route.ts` filtre seulement `is_active=true`).
- **Grades** (`src/lib/products.ts`) : 6+2 paliers bruts `A+/A/B+/B/C+/C/D/E` (`GRADES`, `normalizeGrade`),
  repliés à l'affichage en **3 grades client** `A/B/C` via `displayGrade()` (l.112-118 :
  `A+,A→A` / `B+,B→B` / `C+,C,D,E→C`). DB : `B=2257, A=1262, C=1160, C+=725, A+=574, D=244, E=184, NULL=9`.
- **Variantes front** (`src/lib/productVariants.ts`) : groupage par texte `(brand,model)`
  (`groupSkusByModel` l.104) ; une variante = `(storage, grade, color)` (`buildVariantMatrix` l.248,
  clé `storage|grade|color` l.258). La page détail récupère les sœurs par `brand+model`
  (`src/app/products/[id]/page.tsx:38-47`).
- **La couleur EST un axe de prix aujourd'hui** : `computeCoherentPrices` (l.193) clé `storage|color|grade`,
  prix par couleur dans `buildVariantMatrix` (l.300-304). Changer de couleur change la ligne, donc le prix.
- **Les prix ne sont PAS manuels** : dérivés de `cost_price` via `margin_rules`
  (`src/lib/margins.ts` `computeProductPrices` l.173) puis écrits en masse par
  `recomputeAndWritePrices` (`src/lib/margins-db.ts:79`) via le RPC **`bulk_update_prices(updates jsonb)`**
  (migration `018_bulk_update_prices.sql`). **Recalcul appelé** par `/api/admin/margins/apply`,
  par le changement de réglages, ET automatiquement par les routes Fluxitron (prices/batch, products,
  variants). **Aucune colonne de verrou de prix n'existe.**
- **Cohérence runtime A≥B≥C** re-dérive le prix au runtime (catalogue, home `BestOffers`, **et checkout
  `src/app/api/checkout/route.ts:74` via `coherentSkuPrice`**), clé `storage|color|grade`. Donc le prix
  affiché *et payé* n'est pas le `price` brut de la ligne.
- **Images** : `products.images` (`text[]`) existe mais le storefront ne s'y fie pas. Source de vérité =
  map codée en dur `src/lib/modelImages.ts` (366 packshots Apple, clé `marque|modèle|couleur` →
  `/public/images/*.png`). `resolveProductImage` (`src/lib/productImage.ts:196`) en **mode strict** sur la
  fiche produit : renvoie la photo curatée de la couleur exacte (alias `COLOR_ALIASES`) ou un placeholder,
  jamais l'image Fluxitron brute. La photo par couleur est trouvée via **une ligne sœur par couleur**
  (`ProductDetailClient.tsx:180` `siblings.find(s => s.color === c)`).
- **Clés étrangères vers `products`** (vérifié sur la base live) :
  - `cart_items.product_id` → **ON DELETE CASCADE**
  - `order_items.product_id` → **ON DELETE SET NULL**
  - `margin_rules.product_id` → **ON DELETE CASCADE**
  → **Conclusion : on désactive les doublons (`is_active=false`), on ne les supprime jamais**, pour
  préserver l'historique commandes (sinon SET NULL = perte de la traçabilité produit) et les paniers.
- **Données sales** : `storage_capacity` incohérent (`'256 GO'`=1533 vs `'256 Go'`=457, `'128'`, NULL=525) ;
  **tous les Samsung Galaxy S25 Ultra (244 lignes) ont `storage_capacity=NULL`** ; grades D/E encore présents
  (428 lignes) ; 2 tables de backup `*_images_backup_20260621` ont **RLS désactivé** (exposées à la clé anon).

## 4. Cible

**1 ligne `products` active = 1 option vendable = `(modèle, stockage, grade affiché A/B/C, couleur)`.**

- Périmètre : **téléphones uniquement** (`category='telephones'`). Les 8 accessoires (déjà `manual`,
  sans grade/stockage/couleur au sens téléphone) ne sont **pas** consolidés et gardent leur comportement.
- Grade stocké des lignes consolidées = lettre affichée **A/B/C**. D/E → exclus (`is_active=false`).
- Couleur = **axe de présentation** (swatch + photo + exemplaire expédié), **plus un axe de prix**.
- Prix **partagé** entre toutes les couleurs d'un `(modèle, stockage, grade)`.
- Le groupage front (siblings par `brand+model`, matrice `storage × grade × color`) **reste valable** ;
  après consolidation, chaque `(storage, grade, color)` mappe vers **exactement une** ligne active
  → prix/stock/image non ambigus.

## 5. Migration des données (script SQL idempotent, non destructif)

Migration Supabase (idempotente, rejouable). Pour les lignes `category='telephones'` :

1. **Normaliser `storage_capacity`** vers la forme canonique `'<N> Go'` / `'<N> To'`
   (`'256 GO'`,`'256'` → `'256 Go'`). Les NULL (S25 Ultra) restent NULL.
2. **Exclure D/E** : `is_active=false` sur tout `grade` ∈ {D, E} (et `grade IS NULL`).
3. Pour chaque groupe `G = (model, storage_normalisé, displayGrade(grade), color)` sur les lignes
   **actives non-D/E** :
   a. **Choisir une ligne canonique** de `G` (déterministe : `ORDER BY id` — le choix précis importe
      peu car aucune ligne n'est supprimée).
   b. Mettre à jour la canonique : `grade` → lettre affichée (A/B/C) ; `images` → **union dédupliquée**
      des `images` de tout `G` ; `source='manual'` ; `stock=0` ; `price` → **prix de départ** (cf. 4° §D6) ;
      `compare_at_price` → valeur courante conservée (ou NULL).
   c. **Désactiver les autres lignes de `G`** : `is_active=false` (jamais `DELETE`).
4. **Prix de départ (seed)** par `(model, storage, displayGrade)` = **prix client actuel** ≈
   `MIN(price)` des lignes actives du groupe (le « à partir de » affiché). Écrit sur **toutes** les
   lignes couleur du groupe (dénormalisation).
5. **Convertir** toutes les lignes restantes `source='fluxitron'` → `'manual'`.
6. (Hygiène, hors chemin critique) verrouiller/supprimer les 2 tables `*_images_backup_20260621`
   (RLS désactivé) — à confirmer.

> **« Copier-coller dans notre base »** : les produits Fluxitron sont *déjà* des lignes en base ; on les
> **convertit sur place** (pas de duplication de lignes), ce qui préserve les FK commandes/paniers.

Cas S25 Ultra (stockage NULL) : groupés sans stockage ; le sélecteur de stockage ne s'affiche pas
(`normalizeStorage` renvoie déjà null → pas de sélecteur). À compléter à la main ensuite.

## 6. Prix manuels — désactivation du moteur automatique

`products.price` redevient **la** source de vérité. Modifications :

- **Désactiver le recalcul auto** : neutraliser `recomputeAndWritePrices` côté écriture déclenchée
  (admin margins apply + tous les appels Fluxitron). Le moteur `margin_rules` n'écrit plus `price`.
- **Désactiver la cohérence runtime** : le catalogue (`CatalogClient`/`buildVariantMatrix`), la home
  (`BestOffers`) et le **checkout** (`src/app/api/checkout/route.ts:74`) lisent **le `price` stocké**
  directement, sans passer par `computeCoherentPrices`/`coherentSkuPrice`.
- `compare_at_price` (prix barré) : **manuel optionnel**, pré-rempli avec l'existant ; plus de règle strike auto.
- Le RPC `bulk_update_prices(updates jsonb)` est **conservé** mais piloté par la grille admin (cf. 8).

## 7. Couleur = option, plus une variante de prix

Dans `src/lib/productVariants.ts`, **retirer `color` de la clé de prix** :
`computeCoherentPrices` (l.193-228), assignation de prix dans `buildVariantMatrix` (l.300-304),
`coherentSkuPrice` (l.235), et la sélection de prix dans `pickSkuForSelection` (l.381).
La couleur **reste** dans la matrice pour : swatch, photo, et exemplaire expédié.
Effet : changer de couleur ne change **ni le prix affiché ni le prix payé** ; seuls stockage et grade le changent.

## 8. Images — système actuel préservé (aucune migration)

On garde `modelImages.ts` + `resolveProductImage` (strict) + fallback `products.images`. Comme la **couleur
reste un champ de ligne** et qu'on **garde une ligne (sœur) par couleur** après consolidation,
l'association couleur→photo continue de fonctionner. La consolidation **préserve les images** via l'union
des `images` par couleur (étape 5.3.b).

## 9. Abandon de Fluxitron

- **Couper `/api/v1/*`** : les routes du connecteur renvoient **`410 Gone`** (refus de toute écriture
  externe). Alternative équivalente : retirer `FLUXITRON_API_KEY` (les routes rejettent alors via
  `validateApiKey`). On retient le `410` explicite pour un message clair. Le webhook sortant
  (`src/lib/fluxitron-webhook.ts`) est déjà no-op sans config.
- **Retirer du flux l'admin `/admin/margins`** (plus d'auto-apply ; page conservée mais débranchée du
  calcul de prix, ou masquée — à préciser au plan).
- `scripts/disable-fluxitron.ts` (qui faisait `is_active=false`) n'est **pas** utilisé : c'est l'inverse
  du but. La migration §5 le remplace.

## 10. Admin — saisie des prix & du stock

**Nouvelle grille `/admin/prix`** (+ endpoint API admin) :

- **Lecture** : une ligne par `(modèle, stockage, grade A/B/C)` avec `price` et `compare_at_price`
  éditables (pré-remplis), et le **stock détaillé par couleur** (sous-lignes).
- **Écriture prix** : `{model, storage, grade, price, compare_at_price}` → résout **tous** les ids des
  lignes couleur actives correspondantes → `bulk_update_prices`. (Prix dénormalisé sur les couleurs.)
- **Écriture stock** : par `(modèle, stockage, grade, couleur)` → 1 id → update `stock`.
- Auth/role admin déjà gérés par `middleware.ts` + `supabase-admin`.

## 11. Conséquences & risques

1. **Stock à 0 après migration** → **rien n'est achetable** tant que le stock n'est pas saisi dans
   `/admin/prix`. Choix assumé (D7). Prévoir une saisie efficace (la grille couvre ce besoin).
2. **Modifications non commitées** sur `products.ts`, `productVariants.ts`, `margins.ts`,
   `BestOffers.tsx`, `Grades.tsx`, etc. (chantier « Premium » en cours) : à **commiter avant**
   l'implémentation pour partir d'une base propre.
3. **Idempotence migration** : le script doit pouvoir être rejoué (re-normaliser, ne pas re-désactiver
   une canonique déjà choisie). Filtrer sur `is_active=true` à chaque passe.
4. **Couleurs aux noms bruts** (anglais + marketing : Jet Black, Space Gray…) : restent gérées par
   `COLOR_ALIASES` pour la map d'images ; pas de renommage dans ce chantier (YAGNI).
5. **Pas de tests automatisés** (`npm run lint` cassé) → vérification par `npx tsc --noEmit --skipLibCheck`
   + contrôle manuel des pages (catalogue, fiche, checkout, admin).

## 12. Hors périmètre (YAGNI)

- Pas de nouveau schéma de tables (variants/product_images dédiés) — on reste à plat (D1/D2).
- Pas de migration des images en DB (D3).
- Pas de normalisation/renommage des couleurs en français.
- Accessoires non retouchés.
- Réactivation future de Fluxitron : non traitée (« pour l'instant »), mais la conversion en `manual`
  et le `410` sont réversibles.

## 13. Plan de vérification

1. `npx tsc --noEmit --skipLibCheck` (lint cassé — cf. mémoire projet).
2. Compter après migration : lignes actives ≈ nb de `(modèle,stockage,A/B/C,couleur)` (≈ 2 900,
   hors D/E) ; vérifier qu'il ne reste **aucune** ligne `source='fluxitron'`.
3. Vérifier que pour un même `(modèle,stockage,grade)`, **toutes** les couleurs ont le **même `price`**.
4. Pages client : catalogue (cartes), fiche produit (sélecteurs couleur sans changement de prix,
   bonne photo par couleur), home BestOffers, checkout (montant = `price` stocké).
5. `/api/v1/*` renvoie `410`.
6. Admin `/admin/prix` : éditer un prix → propagé à toutes les couleurs ; éditer un stock par couleur.

## 14. Fichiers impactés (indicatif)

- **Migration SQL** : `supabase/migrations/0XX_catalogue_magasin.sql` (consolidation + conversion source +
  normalisation stockage + exclusion D/E).
- **Prix** : `src/lib/margins-db.ts` (débrancher recalcul auto), `src/lib/productVariants.ts`
  (retirer cohérence runtime + color de la clé prix), `src/app/api/checkout/route.ts` (lire `price` brut),
  `src/components/home/BestOffers.tsx`, `src/app/api/admin/margins/apply/route.ts`.
- **Fluxitron** : routes `src/app/api/v1/**` (→ 410), `src/app/api/v1/_lib/mappers.ts` (plus d'écriture prix).
- **Admin** : nouvelle page `src/app/admin/prix/page.tsx` + `src/app/api/admin/prix/route.ts`
  (lecture grille + écriture prix/stock via `bulk_update_prices`).
- **Images** : inchangés (`modelImages.ts`, `productImage.ts`) — vérification seulement.
