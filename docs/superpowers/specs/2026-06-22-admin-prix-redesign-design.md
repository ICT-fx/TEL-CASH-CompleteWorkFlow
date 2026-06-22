# Refonte de la page admin « Prix »

Date : 2026-06-22
Route : `/admin/prix` (inchangée)

## Contexte & objectif

La page actuelle `Prix & stock` ([src/app/admin/prix/page.tsx](../../../src/app/admin/prix/page.tsx))
affiche, par modèle, un tableau `stockage × grade` où **chaque cellule** est une
pile verticale haute : champ prix + champ prix barré + bouton « Enregistrer » +
dépliable stock par couleur. Conséquences :

- Esthétique lourde, lignes très hautes.
- Pour fixer les prix A/B/C d'un stockage, il faut cliquer **3 fois** sur
  « Enregistrer » (un par grade).
- Aucun filtre (ni marque, ni statut actif/inactif).
- Les modèles **désactivés** n'apparaissent pas du tout (le GET filtre
  `is_active = true`).

Objectif : refaire l'écran, le renommer **« Prix »**, le rendre nettement plus
joli, avec des **lignes fines**, un **filtre marque**, un **filtre
actif/désactivé**, et **un seul bouton « Appliquer » par ligne de stockage** qui
enregistre les prix des grades A/B/C d'un coup.

## La cascade des prix est déjà automatique

Le prix est stocké **brut** sur chaque ligne `products` (1 SKU = 1 couleur). Le
catalogue magasin (`/admin/products`) et le catalogue client
(`/products` → `CatalogClient.tsx`, fiche produit) lisent `products.price`
directement. **Il n'existe pas de table de prix séparée.** Donc écrire le prix
sur les SKU d'un `(modèle, stockage, grade)` se répercute mécaniquement sur les
deux catalogues. Aucune synchro supplémentaire n'est nécessaire — c'est garanti
par construction.

## Décisions de design (validées avec l'utilisateur)

1. **Mise en page** : tableau compact. Lignes = stockage, colonnes = Grade
   A/B/C, **un seul champ prix par grade** sur la ligne, **un bouton
   « Appliquer » par ligne** qui sauvegarde les 3 grades en une requête.
2. **Prix barré (promo)** : conservé mais **discret** — caché derrière un petit
   dépliable « Promo » par ligne. Optionnel.
3. **Stock** : **retiré** de cette page. Le stock reste éditable dans la fiche
   produit ([src/app/admin/products/[id]/page.tsx](../../../src/app/admin/products/%5Bid%5D/page.tsx)).
   La page devient « Prix » pure.

## Périmètre

### Dans le périmètre
- Renommer l'entrée de menu et le titre `Prix & stock` → **`Prix`**
  ([src/app/admin/layout.tsx:27](../../../src/app/admin/layout.tsx#L27)).
- Refonte visuelle de [src/app/admin/prix/page.tsx](../../../src/app/admin/prix/page.tsx).
- Filtre **marque** + filtre **statut** (Tous / Activés / Désactivés) en haut.
- Une seule action « Appliquer » par ligne de stockage (grades A/B/C ensemble).
- Prix barré accessible via dépliable « Promo ».
- API GET : inclure les modèles désactivés + drapeau `active`.
- API PUT : écriture groupée des prix d'une ligne `(modèle, stockage)`.

### Hors périmètre (YAGNI)
- Édition du stock (déplacée hors de cette page).
- Recherche texte par modèle (les deux filtres demandés suffisent).
- Modification du moteur de marges (déjà débranché — prix manuels).
- Tout changement du schéma DB.

## UX / Mise en page

```
┌──────────────────────────────────────────────────────────────────────┐
│  Prix                                                                  │
│  Saisis le prix de vente par (modèle, stockage, grade). Il s'applique  │
│  aussitôt au catalogue magasin et au catalogue client.                │
│                                                                        │
│  Marque : [ Toutes ▾ ]     Statut : [ Tous | Activés | Désactivés ]    │
├──────────────────────────────────────────────────────────────────────┤
│  ▸ Apple · iPhone 13                                  ● Activé    [▾]  │
│  ┌──────────┬─────────┬─────────┬─────────┬───────────────┐           │
│  │ Stockage │ Grade A │ Grade B │ Grade C │               │           │
│  ├──────────┼─────────┼─────────┼─────────┼───────────────┤           │
│  │ 128 Go   │ [ 389 ] │ [ 359 ] │ [ 329 ] │ Appliquer ·Promo▸│        │
│  │ 256 Go   │ [ 439 ] │ [ 409 ] │ [ 379 ] │ Appliquer ·Promo▸│        │
│  └──────────┴─────────┴─────────┴─────────┴───────────────┘           │
│                                                                        │
│  ▸ Samsung · Galaxy S21                              ○ Désactivé  [▾]  │
│   …                                                                    │
└──────────────────────────────────────────────────────────────────────┘
```

- **Une carte par modèle** (`Marque · Modèle`), avec un badge de statut
  (● Activé vert / ○ Désactivé gris) et un en-tête repliable.
- **Tableau fin** à l'intérieur : une ligne par stockage, colonnes Grade A/B/C.
- Une cellule grade absente pour ce stockage → `—` (pas de SKU de ce grade).
- **Bouton « Appliquer »** en fin de ligne : enregistre tous les prix de grades
  saisis sur cette ligne en **une seule requête**. État : `Appliquer` →
  `Enregistrement…` → coche verte transitoire.
- **« Promo ▸ »** déplie sous la ligne 3 champs prix barré (un par grade
  présent). Repliés par défaut. Inclus dans l'« Appliquer » de la ligne.
- Bandeau de feedback discret (succès vert / erreur rouge) en haut, comme
  aujourd'hui mais stylé.

### Filtres
- **Marque** : `<select>` peuplé par les marques distinctes présentes
  (`Array.from(new Set(groups.map(g => g.brand)))`), trié alpha, option
  « Toutes ». Filtrage **client**.
- **Statut** : segmenté `Tous | Activés | Désactivés`. Filtrage **client** sur
  le drapeau `active` agrégé au niveau modèle (un modèle est *activé* s'il a au
  moins un SKU actif). Persistance facultative en `localStorage` (cohérent avec
  `/admin/products`), non requise.

## Modèle de données & flux

Réponse GET regroupée par `(modèle, stockage, grade affiché)` — comme
aujourd'hui — mais :

```ts
interface PrixGroup {
  model: string;
  brand: string;
  storage: string | null;        // normalisé (ex. '128 Go') | null
  grade: 'A' | 'B' | 'C';
  price: number;                 // prix partagé (MIN des SKU du groupe)
  compareAtPrice: number | null; // prix barré partagé
  active: boolean;               // au moins un SKU actif dans ce groupe
}
```

- Le champ `colors` / stock est **supprimé** de la réponse.
- Le GET ne filtre plus `is_active = true` : il récupère **tous** les SKU
  téléphone (actifs + inactifs) pour pouvoir afficher et tarifer les modèles
  désactivés. Le drapeau `active` est calculé par groupe ; l'UI agrège au niveau
  modèle (`some(group.active)`).
- Les grades D/E restent exclus en amont (`displayGrade()` renvoie `null`).

### Écriture (PUT) — nouvelle variante groupée
Remplacer la variante `kind:'price'` unitaire (et retirer `kind:'stock'`,
devenue inutile) par une écriture **par ligne** :

```ts
type PutBody = {
  kind: 'rowPrices';
  model: string;
  storage: string | null;
  prices: Array<{ grade: 'A'|'B'|'C'; price: number; compare_at_price?: number | null }>;
};
```

Traitement serveur :
1. Valider : `model` présent, `prices` non vide, chaque `price` fini ≥ 0.
2. Pour **chaque** entrée de grade, résoudre les ids SKU du
   `(model, storage normalisé, grade affiché)` — **sans** filtrer `is_active`
   (pour pouvoir tarifer un modèle désactivé). Filtrage SQL sur `model` +
   `category='telephones'`, puis filtrage JS sur `normalizeStorage()` et
   `displayGrade()` (les valeurs brutes en base sont sales : `'256 GO'`, `'A+'`).
3. Construire **un seul** tableau `updates` (toutes lignes/grades confondus) et
   faire **un seul** appel `db.rpc('bulk_update_prices', { updates })`.
4. Réponse : `{ updated: <nb de SKU>, grades: <nb de grades écrits> }`.

L'UI n'envoie que les grades dont le champ prix est **non vide** ; un champ
prix vidé n'écrase pas (pas d'écriture de 0). Le prix barré n'est inclus pour un
grade que si le dépliable Promo a une valeur ; vide ⇒ `compare_at_price` non
modifié pour ce grade (`undefined`, non transmis) — cohérent avec la sémantique
actuelle (`hasCap`).

## Esthétique

- Palette slate déjà en place (`#0f172a`, `#64748b`, `#e2e8f0`, `#f8fafc`).
- Cartes à coins arrondis, ombre légère, en-tête de modèle cliquable.
- Lignes de tableau **fines** (padding vertical réduit ~6–8px), séparateurs
  `#f1f5f9`, survol de ligne subtil.
- Inputs prix compacts et alignés ; accent grade discret en en-tête de colonne.
- Badges statut : vert `#16a34a` (Activé) / gris `#94a3b8` (Désactivé).
- Boutons cohérents avec l'existant (`#0f172a` fond foncé pour l'action
  primaire). Inline styles conservés (la page est déjà en inline styles) mais
  factorisés proprement.

## Cas limites

- **Modèle sans aucun stockage** (`storage = null`, ex. certains modèles) :
  une seule ligne libellée `—`. Inchangé vs aujourd'hui.
- **Grade manquant** pour un stockage : cellule `—`, ignoré à l'« Appliquer ».
- **Modèle 100 % désactivé** : visible sous le filtre « Désactivés » et « Tous »,
  prix éditables ; badge ○ Désactivé.
- **Prix à 0 / vide** : un champ vide = pas d'écriture pour ce grade ; saisir
  explicitement `0` reste possible (≥ 0 accepté).
- **Aucun SKU résolu** pour un `(modèle, stockage, grade)` (incohérence) :
  l'entrée est ignorée côté serveur ; si **aucune** entrée n'a résolu d'id,
  retourner 404 « Aucune ligne pour cette saisie ».
- **Pagination PostgREST** (~1000 lignes) : conserver la pagination existante
  dans `fetchActiveTelephoneRows` (renommée, sans le filtre actif).

## Vérification

- `npx tsc --noEmit --skipLibCheck` (le lint projet est cassé — cf. mémoire
  `stripe-lint-tsc`). Pas de tests automatisés dans ce repo.
- Vérif manuelle (dev) : changer un prix de grade A d'un iPhone → « Appliquer »
  → recharger ⇒ valeur persistée ; vérifier la fiche `/products/[id]` et le
  catalogue magasin reflètent le nouveau prix.
- Vérifier filtre marque + filtre statut (un modèle désactivé apparaît bien sous
  « Désactivés », pas sous « Activés »).
- Vérifier qu'une ligne avec 2 grades saisis fait **1 seule** requête réseau.

## Fichiers touchés

- [src/app/admin/prix/page.tsx](../../../src/app/admin/prix/page.tsx) — refonte UI.
- [src/app/api/admin/prix/route.ts](../../../src/app/api/admin/prix/route.ts) —
  GET (inclure inactifs + `active`, retirer stock), PUT (`kind:'rowPrices'`).
- [src/app/admin/layout.tsx:27](../../../src/app/admin/layout.tsx#L27) — libellé
  `Prix & stock` → `Prix`.
