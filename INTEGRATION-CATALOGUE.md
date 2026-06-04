# Catalogue iPhone — intégration

Documentation des scripts qui peuplent la table `public.products` avec toutes
les variantes du catalogue iPhone, et y branchent les photos officielles Apple.

## Sources

- `scripts/catalogue-source.js` — **source de vérité** : 33 modèles iPhone
  (couleurs, stockages, prix de base). Édite ce fichier pour ajouter/retirer
  un modèle ou une couleur, puis régénère.
- `scripts/make-seed-catalogue.js` — générateur. Produit `public/catalogue.json`,
  `supabase/seed-catalogue.sql` et le template `public/image-sources.json`.
- `scripts/seed-catalogue.ts` — pousse les variantes dans Supabase via
  `createAdminClient` (clé service). **Idempotent** : upsert sur la colonne
  `sku` unique.
- `scripts/download-images.js` — télécharge les visuels depuis le CDN Apple
  d'après `public/image-sources.json` et les place dans `public/images/`.
- `public/image-sources.json` — map `"Modèle|Couleur" → URL Apple`. Mise à
  jour manuelle pour les couples manquants.

## Schéma cible (`public.products`)

| colonne            | valeur seedée                                  |
|--------------------|------------------------------------------------|
| `brand`            | `"Apple"`                                      |
| `model`            | ex. `"iPhone 15 Pro"`                          |
| `storage_capacity` | `"64 Go"`, `"256 Go"`, `"1 To"`…               |
| `color`            | nom anglais (`"Blue Titanium"`, `"Midnight"`)  |
| `grade`            | `'A' \| 'B' \| 'C'`                            |
| `battery_health`   | `100` (A), `92` (B), `85` (C)                  |
| `price`            | placeholder démo (cf. `roundPrice`)            |
| `compare_at_price` | prix Grade A pour les variantes B/C, sinon NULL|
| `stock`            | `5`                                            |
| `images`           | `['/images/<slug>.png']`                       |
| `category`         | `'telephones'`                                 |
| `is_active`        | `true`                                         |
| `sku` / `handle`   | générés depuis brand+model+storage+color+grade |

Les filtres du front (`/products`) sont respectés :
- `brand` : match exact (`"Apple"`).
- `storage_capacity` : la chaîne contient `"64"`, `"128"`, `"256"` ou `"512"`
  (le générateur garde le préfixe numérique).
- `grade` : `'A'/'B'/'C'`.
- `color` : libre — la traduction FR est faite à l'affichage (`colors.ts`).

## Workflow

### 1. Régénérer le catalogue (après modification de `catalogue-source.js`)

```bash
npm run catalogue:make
```

Sortie attendue : `33 models · ~150 colors · ~1400 variants`.

### 2. Seeder Supabase

Pré-requis : `NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`
renseignés dans `.env.local` (les valeurs `your-…` du repo sont des
placeholders).

```bash
# Upsert simple (sans suppression)
npm run catalogue:seed

# Reset complet de la marque Apple avant insertion
npm run catalogue:seed:reset
```

Le script affiche le nombre de lignes insérées vs mises à jour, puis
un total Apple en base pour vérification.

**Alternative SQL** : appliquer `supabase/seed-catalogue.sql` via psql ou
le SQL Editor de Supabase Studio (même résultat, même clé de conflit `sku`).

### 3. Télécharger les images officielles Apple

```bash
npm run catalogue:images
```

Le script :
- ne fait des requêtes que vers `store.storeimages.cdn-apple.com`,
  `www.apple.com` et `images.apple.com` (revendeurs explicitement bloqués) ;
- enregistre chaque image sous `public/images/<slug>.png` (basename
  identique à celui stocké dans `products.images[0]`) ;
- saute les fichiers déjà téléchargés ;
- liste les couples non couverts dans `public/images/_manquants.json`.

Pour compléter la couverture :
1. ouvrir `public/images/_manquants.json` ;
2. trouver l'URL officielle Apple (Newsroom de préférence — URLs stables) ;
3. l'ajouter dans `public/image-sources.json` sous la clé `Modèle|Couleur` ;
4. relancer `npm run catalogue:images`.

Les modèles trop anciens (iPhone 7/8/X…) ne sont parfois plus hébergés sur
le store. Le front affiche alors une silhouette générique avec le nom du
modèle (`phonePlaceholder` dans `src/lib/productImage.ts`) — pas d'iPhone
factice.

### 4. Passage en production (Supabase Storage)

Quand les visuels finaux sont prêts :
1. Créer un bucket public `product-images` sur Supabase.
2. Uploader tout `public/images/*` (les noms de fichier doivent être
   strictement identiques).
3. Dans `catalogue-source.js`, brancher l'URL publique dans
   `makeImagePath` (ou laisser `/images/<slug>.png` si on continue à servir
   depuis le dossier `public/`).
4. `npm run catalogue:make && npm run catalogue:seed` pour propager.

## Garde-fous

- Le script **ne touche jamais** aux tables `profiles`, `orders`, `cart_items`,
  ni au middleware ou à Stripe.
- Les prix sont des **placeholders de démo** (`roundPrice`) — à recaler
  avant mise en ligne.
- Les images Apple téléchargées sont des **placeholders prototype**, à
  remplacer par des visuels possédés ou licenciés avant publication.
- Aucun secret n'est jamais écrit dans `catalogue.json`, dans le SQL ou dans
  les images.
