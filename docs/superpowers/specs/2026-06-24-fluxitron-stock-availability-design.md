# TEL & CASH — Fluxitron comme signal de stock « live » (grisage du catalogue magasin)

**Date** : 2026-06-24
**Statut** : design approuvé (Approche A, variante A1) — implémentation en cours
**Spec liée** : `2026-06-22-catalogue-magasin-prix-manuels-design.md` (le pivot magasin)

---

## 1. Problème & objectif

Le client veut **garder Fluxitron** mais uniquement comme **miroir de stock live du fournisseur** (Foxway), **sans jamais regarder les prix Fluxitron**. Le catalogue magasin (prix manuels, `source='manual'`) garde sa source de vérité prix ; Fluxitron ne fait que **conditionner la disponibilité** d'une variante.

Règle métier :
- Une variante magasin `(modèle, stockage, grade, couleur)` est **grisée côté client** si Fluxitron confirme qu'elle est **en rupture** (stock 0) — au niveau **couleur** d'abord.
- Si **toutes les couleurs existantes** d'un `(modèle, stockage, grade)` sont indisponibles, alors **le grade entier** est grisé.
- Le grisage doit se mettre à jour automatiquement au fil des stocks Fluxitron.

## 2. Décisions cadrées (avec le client)

- **D1 — Posture en cas de donnée manquante/périmée : fail-open « commercial ».** On ne grise **que** sur un **zéro confirmé ET frais** de Fluxitron. Donnée absente, variante jamais importée, ou stock figé/périmé (`updated_at` trop ancien) → **on garde vendable**. Conséquence de sécurité : tout bug de matching tombe vers « vendable », jamais vers « grisé à tort ».
- **D2 — Stockage du miroir : A1.** Les lignes Fluxitron restent dans `products` avec `source='fluxitron'` (le miroir existe déjà : 4364 lignes). Pas de table dédiée. Le catalogue client est protégé par un filtre `source='manual'`.
- **D3 — Mapping grade 3 paliers.** Le magasin vend en A/B/C. Fluxitron renvoie A+/A/B+/B/C+/C (+ D/E exclus). Rollup : `{A+,A}→A`, `{B+,B}→B`, `{C+,C}→C`. D/E → exclus du matching (jamais vendus).
- **D4 — Seuil de fraîcheur : 48 h** par défaut, réglable (table de réglages).
- **D5 — Pas de cron.** La fraîcheur est dérivée de `products.updated_at` **au moment de la lecture**. Fluxitron pousse en PUSH (`POST /api/v1/stock/batch`) ; aucune planification côté nous.

## 3. Découvertes terrain (vérité DB + code, 2026-06-24)

- Migration la plus haute appliquée : `price_updated_at` (la 019 « catalogue magasin » n'apparaît pas dans le tracker ; le schéma live fait foi).
- `products` : 2437 variantes `manual` actives (2149 `price>0` vendables, 288 `price=0` déjà grisées), 4364 lignes `fluxitron` `is_active=false` toutes à `stock=0` (connecteur coupé).
- **Le connecteur `/api/v1/` est DÉSACTIVÉ** (410 Gone dans `fluxitron-auth.ts`). À réactiver pour le ré-import.
- **Couleurs** : Fluxitron = ~17 couleurs **génériques** (black, blue, green, grey, white, red, purple…) ; magasin = noms **marketing Apple** (`product red`, `space black`, `sierra blue`, `alpine green`, `space gray`, `midnight`, `starlight`, titaniums…). → **canonicalisation couleur obligatoire**.
- **Modèles** : alignés sauf `iphone se (2nd generation)` ↔ `(2020)` et `(3rd generation)` ↔ `(2022)` → alias modèle nécessaires.
- **Grades/Stockage** : formats alignés (« 128 Go »), rollup grade par 1re lettre OK.
- **Aucune requête client ne filtre `source`** ; le connecteur crée les lignes Fluxitron en `is_active=true` → risque de fuite du miroir si on ne corrige pas.
- Matrice de variantes (grisage couleur/grade) construite **uniquement** sur la fiche produit `src/app/products/[id]/page.tsx` via `buildVariantMatrix` / `getOptionAvailability` (`src/lib/productVariants.ts`).

## 4. Architecture (Approche A — overlay SQL, lu au runtime)

Deux jeux de données dans `products`, jamais mélangés côté client :

| | Catalogue magasin | Miroir Fluxitron |
|---|---|---|
| `source` | `manual` | `fluxitron` |
| Vérité | prix + curation | stock + `updated_at` |
| Visible client | oui (`is_active=true`) | **jamais** (filtre `source='manual'`) |

Une **vue SQL** superpose les deux et calcule `greyed_by_supplier` par variante magasin. La fiche produit lit la vue ; le grisage couleur→grade tombe via la logique de cascade existante.

```
Fluxitron (Foxway) --PUSH stock--> products(source='fluxitron')  [updated_at bumpé]
                                            │
                              v_supplier_variant_stock  (agrégat par clé canonique)
                                            │  LEFT JOIN
products(source='manual')  ───────────►  v_catalog_products  (+ greyed_by_supplier)
                                            │
                          fiche produit /products/[id]  →  buildVariantMatrix
                                            │
                          cascade couleur → grade (grisage client)
```

### 4.1 Clé de matching canonique
`(brand_norm, model_canon, storage_norm, grade_tier, color_canon)` — mêmes fonctions appliquées des deux côtés :
- `fn_norm_text` : `lower(trim(collapse_spaces(x)))`.
- `fn_canonical_model` : `fn_norm_text` + alias (`se (2nd generation)`/`se 2nd generation` → `se 2020`, `(3rd generation)` → `se 2022`).
- `fn_norm_storage` : repris de la migration 019 (permanent).
- `fn_grade_tier` : A±→A, B±→B, C±→C, **D/E/inconnu → NULL** (exclus du matching).
- `fn_canonical_color` : marketing → base, conservateur. Mappings sûrs : `product red→red` ; `space black`/`jet black`/`black titanium`→`black` ; `sierra blue`/`pacific blue`/`blue titanium`→`blue` ; `alpine green`/`midnight green`→`green` ; `space gray`→`grey` ; `deep purple`→`purple` ; `white titanium`→`white`. **Ambigus laissés en identité** (donc non-matchés → vendables) et **remontés au diagnostic** : `midnight`, `starlight`, `natural titanium`, `desert titanium`, `rose gold`, `ultramarine`, `ice blue`.

### 4.2 Règle `greyed_by_supplier`
```
greyed_by_supplier =
      greying_enabled                                  -- interrupteur (D8)
  AND supplier_match                                   -- une clé Fluxitron correspond
  AND supplier_last_synced > now() - freshness_hours   -- frais (D4)
  AND COALESCE(supplier_stock, 0) = 0                  -- zéro confirmé
```
Tout le reste → `false` (vendable). L'agrégat Fluxitron **ignore `is_active`** (on veut le signal stock du miroir, même caché) et **exclut D/E**.

## 5. Sécurité de mise en ligne (D8 — interrupteur)

Le miroir actuel est **100% stock=0 et frais** ⇒ activer le grisage immédiatement **griserait à tort** toutes les variantes matchées. Donc :

1. Table de réglages singleton `supplier_sync_settings { greying_enabled bool=false, freshness_hours int=48 }`.
2. La vue renvoie `greyed_by_supplier=false` tant que `greying_enabled=false`.
3. **Runbook go-live** : livrer (OFF) → réactiver le connecteur → **ré-import Fluxitron frais** (stocks réels) → vérifier le diagnostic admin (matchs, périmées, zéros) → **basculer ON** depuis l'admin.

## 6. Impact code (fichiers)

**SQL — `supabase/migrations/022_supplier_stock_availability.sql`**
- Fonctions permanentes : `fn_norm_text`, `fn_canonical_model`, `fn_norm_storage`, `fn_grade_tier`, `fn_canonical_color`.
- Table `supplier_sync_settings` (singleton, RLS admin).
- Vues `v_supplier_variant_stock` (agrégat) et `v_catalog_products` (`products.* + greyed_by_supplier + supplier_*`), `GRANT SELECT … TO service_role`.

**TS — `src/lib/productVariants.ts`** (la cascade existe déjà, on ne fait que redéfinir « vendable »)
- `RawProduct` : `+ greyed_by_supplier?: boolean`.
- `FrontVariant` : `+ greyedBySupplier: boolean`.
- `buildVariantMatrix` : `available = price>0 && !greyedBySupplier` ; renseigner le nouveau champ.
- Helper `isVendable(v) = v.price > 0 && !v.greyedBySupplier`, utilisé dans `getOptionAvailability` (remplace `v.price>0`), `pickInitialSelection`, `reconcileSelection`. ⇒ une couleur/grade se grise quand **toutes** ses variantes sont non-vendables (prix 0 **ou** rupture fournisseur).

**TS — `src/app/products/[id]/page.tsx`**
- Lire depuis `v_catalog_products` au lieu de `products` (apporte `greyed_by_supplier` + filtre `source='manual'` intégré).

**TS — filtres `source='manual'` (défense en profondeur)** : `src/app/api/products/route.ts`, `src/app/api/products/[id]/route.ts`, `src/app/api/cart/route.ts`, `src/app/sitemap.ts`.

**TS — `src/app/api/v1/_lib/fluxitron-auth.ts`** : restaurer la validation `X-Api-Key` vs `FLUXITRON_API_KEY` (lever le 410).

**TS — Admin** : `src/app/api/admin/supplier-sync/route.ts` (GET réglages+santé, PUT toggle/seuil) + panneau « Santé du flux Fluxitron » dans `src/app/admin/products/page.tsx` (compteurs : matchs, périmées, sans-correspondance, orphelines, grisées) + interrupteur ON/OFF.

## 7. Cas limites & propriétés de sécurité

- **Fluxitron muet/down** → tout périmé → fail-open → rien grisé. Sûr.
- **Couleur/modèle non mappé** → pas de match → vendable. Sûr (sous-grise, ne sur-grise pas) ; visible au diagnostic.
- **Niveaux que Fluxitron ne porte pas** (1 To, 2 To, 32 Go) → jamais de match → vendables.
- **Deep-link sur une variante grisée fournisseur** → la fiche s'ouvre sur une variante vendable (même logique que prix 0).
- **Le miroir reste invisible** quel que soit `is_active` grâce au filtre `source='manual'`.

## 8. Vérification (pas de framework de test)

- `npx tsc --noEmit --skipLibCheck`.
- SQL : sur la vue, témoins *frais 0 / périmé 0 / frais >0 / pas de match* → vérifier `greyed_by_supplier`.
- Staging : `greying_enabled=true`, pousser un `0` connu via `stock/batch` → la couleur grise ; laisser périmer → redevient vendable.
- Revue adverse de la PR.

## 9. Découpage

- **Phase 1 (cœur)** : migration 022, wiring `productVariants`, fiche produit sur la vue, filtres `source='manual'`, réactivation connecteur, interrupteur + diagnostic admin minimal.
- **Phase 2 (ops)** : enrichir le diagnostic (drill-down par modèle, correction assistée des couleurs non mappées), éventuel grisage des cartes modèles entièrement en rupture.

## 9bis. Revue adverse — durcissements appliqués

Revue multi-agents (6 findings confirmés, 0 critique). Corrigés :
- **Sécurité DB (haut)** : `GRANT … TO service_role` est additif, pas restrictif ; les privilèges par défaut du schéma public exposaient `v_catalog_products`, `v_supplier_variant_stock` et `supplier_sync_health()` à `anon`/`authenticated` via PostgREST. → `REVOKE ALL … FROM PUBLIC, anon, authenticated` sur les 2 vues + la fonction.
- **Sécurité DB (haut)** : la RLS publique de `products` (`is_active=true`) n'avait pas de garde `source` → un invité pouvait lire le miroir par `?source=eq.fluxitron`. → policy durcie en `is_active = true AND source = 'manual'` (les admins gardent `is_admin()`). Vérifié : `anon` voit 0 ligne fluxitron.
- **Panier (moyen)** : le gate d'achat testait `price>0` seul → un modèle entièrement en rupture fournisseur restait ajoutable. → gate sur `available` (prix>0 ET non grisé) via `pickSkuForSelection`.
- **Admin prix (haut)** : `/api/admin/prix` (grille, toggle, rowPrices, clone-insert) n'avait pas de filtre `source` → le ré-import polluait l'outil (prix faussés, `is_active` du miroir flippé, variantes `source='fluxitron'` invisibles créées). → `source='manual'` partout + clone forcé `manual`.
- **Admin marges (bas)** : `/api/admin/margins/options` listait les marques/modèles Fluxitron. → filtre `source='manual'`.

## 10. Hors-scope

Prix Fluxitron (jamais lus), multi-entrepôts, réassort automatique, notifications de rupture.
