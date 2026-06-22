# Catalogue 100 % magasin + prix manuels (abandon Fluxitron) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer le catalogue dropshipping Fluxitron en catalogue 100 % magasin à prix saisis à la main, où la couleur devient une simple option (et non plus une variante de prix), tout en préservant les images client.

**Architecture:** On reste sur la table `products` à plat (1 ligne = 1 option vendable après consolidation). Quatre changements de code (couper `/api/v1`, débrancher le moteur de marges, lire le prix stocké partout, sortir la couleur de l'axe prix) + une grille admin de saisie prix/stock + une migration SQL idempotente non destructive qui consolide les ~6 415 lignes-offres en ~2 900 lignes `(modèle, stockage, grade A/B/C, couleur)`. Le système d'images curatées (`modelImages.ts`) est conservé tel quel.

**Tech Stack:** Next.js 15 (App Router), Supabase (Postgres, projet `klungktcrjlwxqfbbbec`), Stripe, TypeScript. Pas de test runner.

**Spec source :** [docs/superpowers/specs/2026-06-22-catalogue-magasin-prix-manuels-design.md](../specs/2026-06-22-catalogue-magasin-prix-manuels-design.md)

## Global Constraints

- **Projet Supabase :** `klungktcrjlwxqfbbbec` (« TEL&Cash Backend »). Migrations via le MCP `apply_migration`, requêtes via `execute_sql`.
- **Vérification :** pas de tests automatisés ; `npm run lint` est cassé. Le type-check est **`npx tsc --noEmit --skipLibCheck`** — **succès = aucune sortie, exit code 0**. Compléter par les vérifs SQL/manuelles de chaque tâche.
- **Langue :** tous les textes utilisateur (UI, erreurs, messages) en **français**.
- **Migration NON destructive :** jamais de `DELETE` sur `products` (FK `cart_items` ON DELETE CASCADE, `order_items` ON DELETE SET NULL). On désactive (`is_active=false`).
- **Périmètre données :** `category='telephones'` uniquement. Les 8 accessoires ne sont **pas** touchés.
- **Prix :** `products.price` est la **source de vérité**, **dénormalisé** : même prix sur toutes les couleurs d'un `(modèle, stockage, grade A/B/C)`.
- **Grades client :** A / B / C uniquement (A+/A→A, B+/B→B, C+/C/D/E→C ; D/E exclus du catalogue).
- **Commits :** fréquents, conventionnels, en français, terminés par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. ⚠️ Quand un message utilise `"$(cat <<'EOF' … EOF)"`, **ne pas indenter** le corps du heredoc (les espaces de tête seraient inclus dans le message).
- **Ordre d'exécution impératif :** **A → B → C → D → E → F**. La migration (E) est le dernier pas et met `stock=0` partout → le site devient inachetable jusqu'à saisie du stock dans `/admin/prix` (livrée en D).

---

## Task 0 (pré-requis) : base de départ propre

Les fichiers que ce plan modifie (`productVariants.ts`, `products.ts`, `margins.ts`, `BestOffers.tsx`, `Grades.tsx`, etc.) ont des **modifications non commitées** (chantier « Premium »). Il faut partir d'un arbre propre.

- [ ] **Step 1 : Constater l'état de l'arbre.**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && git status --short
  ```
- [ ] **Step 2 : Commiter (ou stasher) le travail en cours** — décision de l'utilisateur. Soit `git add -A && git commit -m "wip(grades): chantier Premium en cours"`, soit `git stash`. Ne **pas** mélanger ce WIP avec les commits du présent plan.
- [ ] **Step 3 : Confirmer l'arbre propre** avant de démarrer la Task A.
  ```bash
  git status --short   # attendu : aucune sortie
  ```

---

## WS4 — Couper Fluxitron : `/api/v1/*` → 410 Gone

> **Doit passer EN PREMIER** (avant WS2/WS5) pour stopper toute écriture/lecture externe avant de toucher au moteur de prix et aux données.

**Décision (single-point vs per-route) — justifiée :**
On retient le **point unique** `validateApiKey()`. Vérifié sur le code réel : **17 des 18 fichiers de route** importent `validateApiKey` depuis `../_lib/fluxitron-auth` et l'appellent comme **première instruction** de chaque handler, toujours sous la forme exacte `const authError = validateApiKey(request); if (authError) return authError;` (GET/POST/PATCH/DELETE confondus — voir `grep` ci-dessous). Comme chaque handler renvoie immédiatement dès que `validateApiKey` retourne une valeur non-`null`, transformer ce helper pour qu'il renvoie un **410** court-circuite **toutes** ces routes **sans aucune édition par-route**. C'est plus sûr (impossible d'oublier une route) et plus réversible qu'éditer 18 fichiers.
**Seule exception** : `src/app/api/v1/route.ts` (l'index `GET()`) **n'appelle pas** `validateApiKey` (métadonnées en lecture seule, pas d'accès DB). Pour respecter le spec §9 (« Couper `/api/v1/*` »), on l'édite directement.
**Note WS2 (code mort)** : après ce changement, les 5 appels `recomputeAndWritePrices` situés dans `products/route.ts`, `prices/batch/route.ts`, `products/[id]/route.ts`, `products/[id]/variants/route.ts`, `products/[id]/variants/[variantId]/route.ts` deviennent **inatteignables** (le 410 sort avant).

### Task A: Court-circuiter toutes les routes `/api/v1/*` en 410 Gone

**Files:**
- Modify: `src/app/api/v1/_lib/fluxitron-auth.ts:8-32` — `validateApiKey()` renvoie toujours 410 Gone (message FR), ce qui court-circuite les 18 routes authentifiées
- Modify: `src/app/api/v1/route.ts:3-16` — l'index v1 (`GET` sans auth) renvoie 410 directement

**Interfaces:**
- Consumes: none
- Produces:
  - `validateApiKey(request: Request): NextResponse` — renvoie désormais **toujours** une `NextResponse` de statut **410** (n'a plus de retour `null`). La signature de type est élargie de `NextResponse | null` à `NextResponse` ; tous les appelants existants restent valides (ils testaient `if (authError) return authError;`).
  - Toutes les routes `/api/v1/*` répondent `410` avec corps JSON `{ error, code: 'fluxitron_disabled', message }`.

- [ ] **Step 1 : Vérifier le point d'étranglement (lecture seule, aucune modif).** Confirmer que chaque handler appelle bien `validateApiKey` en première instruction et qu'aucune autre route que l'index n'y échappe.
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && \
  grep -rln "validateApiKey(request)" src/app/api/v1 --include="*.ts" | sort && \
  echo "--- routes SANS validateApiKey (attendu : seulement route.ts index) ---" && \
  grep -rL "validateApiKey" src/app/api/v1 --include="route.ts"
  ```
  Sortie attendue : la première liste contient tous les fichiers de route sauf `route.ts` (index) ; la seconde ne contient **que** `src/app/api/v1/route.ts`.

- [ ] **Step 2 : Transformer `validateApiKey()` en court-circuit 410.** Dans `src/app/api/v1/_lib/fluxitron-auth.ts`, remplacer tout le corps de la fonction (la validation de clé est retirée).

  **Avant** (`src/app/api/v1/_lib/fluxitron-auth.ts`, l.3-32) :
  ```ts
  /**
   * Validate Fluxitron API Key from request headers.
   * Checks X-Api-Key header (default) against FLUXITRON_API_KEY env var.
   * Returns null if valid, or a 401 NextResponse if invalid.
   */
  export function validateApiKey(request: Request): NextResponse | null {
    const apiKey =
      request.headers.get('x-api-key') ||
      request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.headers.get('api-token');

    const expectedKey = process.env.FLUXITRON_API_KEY;

    if (!expectedKey) {
      console.error('FLUXITRON_API_KEY is not set in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (!apiKey || apiKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'Invalid API key' },
        { status: 401 }
      );
    }

    return null; // Valid
  }
  ```

  **Après** :
  ```ts
  /**
   * Connecteur Fluxitron coupé (cf. spec catalogue-magasin §9).
   * Toutes les routes /api/v1/* appellent ce garde en première instruction et
   * renvoient immédiatement sa réponse : il court-circuite donc l'ensemble du
   * connecteur en 410 Gone, sans aucune écriture/lecture externe. Réversible :
   * pour réactiver, restaurer la validation de clé d'API ci-dessous.
   */
  export function validateApiKey(_request: Request): NextResponse {
    return NextResponse.json(
      {
        error: 'Gone',
        code: 'fluxitron_disabled',
        message:
          "Le connecteur Fluxitron est désactivé. Les routes /api/v1/* ne sont plus disponibles. Le catalogue est désormais géré manuellement en magasin.",
      },
      { status: 410 }
    );
  }
  ```

  > Note : le paramètre est renommé `_request` (préfixe `_`) car il n'est plus lu. Le type de retour passe de `NextResponse | null` à `NextResponse` ; tous les appelants (`const authError = validateApiKey(request); if (authError) return authError;`) restent corrects.

- [ ] **Step 3 : Couper aussi l'index `/api/v1`.** Remplacer le corps de `GET()` dans `src/app/api/v1/route.ts`.

  **Avant** (`src/app/api/v1/route.ts`, l.1-17) :
  ```ts
  import { NextResponse } from 'next/server';

  export async function GET() {
    return NextResponse.json({
      name: 'TEL & CASH API',
      version: '1.0.0',
      endpoints: [
        '/api/v1/products',
        '/api/v1/categories',
        '/api/v1/orders',
        '/api/v1/prices/batch',
        '/api/v1/stock/batch',
        '/api/v1/locations',
      ],
    });
  }
  ```

  **Après** :
  ```ts
  import { NextResponse } from 'next/server';

  // Connecteur Fluxitron coupé (cf. spec catalogue-magasin §9) : l'index v1
  // n'appelle pas validateApiKey, on renvoie donc 410 explicitement ici.
  export async function GET() {
    return NextResponse.json(
      {
        error: 'Gone',
        code: 'fluxitron_disabled',
        message:
          "Le connecteur Fluxitron est désactivé. Les routes /api/v1/* ne sont plus disponibles. Le catalogue est désormais géré manuellement en magasin.",
      },
      { status: 410 }
    );
  }
  ```

- [ ] **Step 4 : Vérifier la compilation TypeScript.**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && npx tsc --noEmit --skipLibCheck
  ```
  Sortie attendue : **aucune sortie** (exit code 0). En particulier, aucune erreur du type « Type 'NextResponse' is not assignable to … » sur les appelants de `validateApiKey`.

- [ ] **Step 5 : Vérifier le 410 par curl** (serveur de dev lancé : `npm run dev`).
  ```bash
  echo -n "POST /api/v1/products -> " && \
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/v1/products && \
  echo -n "GET  /api/v1/products -> " && \
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/products && \
  echo -n "GET  /api/v1 (index)  -> " && \
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1 && \
  echo -n "POST /api/v1/prices/batch -> " && \
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/v1/prices/batch && \
  echo "--- corps JSON (doit contenir fluxitron_disabled) ---" && \
  curl -s http://localhost:3000/api/v1/products
  ```
  Sortie attendue :
  ```
  POST /api/v1/products -> 410
  GET  /api/v1/products -> 410
  GET  /api/v1 (index)  -> 410
  POST /api/v1/prices/batch -> 410
  --- corps JSON (doit contenir fluxitron_disabled) ---
  {"error":"Gone","code":"fluxitron_disabled","message":"Le connecteur Fluxitron est désactivé. Les routes /api/v1/* ne sont plus disponibles. Le catalogue est désormais géré manuellement en magasin."}
  ```

- [ ] **Step 6 : Commit.**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && \
  git add src/app/api/v1/_lib/fluxitron-auth.ts src/app/api/v1/route.ts && \
  git commit -m "$(cat <<'EOF'
feat(fluxitron): couper le connecteur, /api/v1/* renvoie 410 Gone

validateApiKey() (point d'étranglement unique appelé par toutes les routes
authentifiées) renvoie désormais 410 ; l'index /api/v1 est coupé directement.
Aucune route supprimée (réversible). Cf. spec catalogue-magasin §9.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
  ```

---

## WS2 — Désactiver le moteur de marges auto

### Task B: Désactiver le moteur de marges auto (prix manuels)

**Files:**
- Modify: `src/lib/margins-db.ts:79` — ajouter un garde no-op en tête de `recomputeAndWritePrices` (point d'étranglement unique couvrant les 7 appelants) ; conserver le corps et le RPC `bulk_update_prices` intacts (réutilisés par WS5 `/admin/prix`)
- Modify: `src/app/api/admin/margins/apply/route.ts` — transformer la route en `410 Gone` délibéré
- Modify: `src/app/api/admin/margins/settings/route.ts` — retirer l'auto-recompute déclenché par un changement de réglages

**Interfaces:**
- Consumes: aucune (WS4 gère séparément le `410` des routes `/api/v1/*` ; ce workstream est indépendant et fait office de défense en profondeur côté `recomputeAndWritePrices`)
- Produces :
  - `recomputeAndWritePrices(filter?: { brand?: string; productIds?: string[] }): Promise<{ updated: number }>` — **conservée mais transformée en no-op** : retourne toujours `{ updated: 0 }` sans aucune écriture. La signature et l'export ne changent pas.
  - `bulk_update_prices(updates jsonb)` (RPC SQL) — **inchangé**, réutilisable directement par la grille admin WS5 (`/api/admin/prix`).
  - `POST /api/admin/margins/apply` → désormais `410 Gone` (JSON `{ error, hint }`).
  - `PUT /api/admin/margins/settings` → met toujours à jour `margin_settings` mais ne renvoie plus de `pricesUpdated` (champ retiré).

**Contexte (appelants recensés — couverture complète) :** `grep -rn "recomputeAndWritePrices" src/` donne 7 appels :
1. `src/app/api/admin/margins/apply/route.ts:12` — neutralisé ici (Step 2, route → 410).
2. `src/app/api/admin/margins/settings/route.ts:34` — neutralisé ici (Step 3, appel retiré).
3. `src/app/api/v1/prices/batch/route.ts:69` — route Fluxitron, mise en `410` par **WS4** (mort).
4. `src/app/api/v1/products/route.ts:159` — idem WS4.
5. `src/app/api/v1/products/[id]/route.ts:119` — idem WS4.
6. `src/app/api/v1/products/[id]/variants/route.ts:153` — idem WS4.
7. `src/app/api/v1/products/[id]/variants/[variantId]/route.ts:71` — idem WS4.

Le garde du Step 1 rend `recomputeAndWritePrices` inoffensive **même si** un appelant v1 s'exécutait encore : défense en profondeur, indépendante de l'ordre d'arrivée de WS4. `previewPrices`/`loadPricingInputs` (appelés par `/api/admin/margins/preview`) restent en lecture seule et ne sont pas touchés.

- [ ] **Step 1 : Garde no-op en tête de `recomputeAndWritePrices`** — point d'étranglement unique. On conserve tout le corps (et `bulk_update_prices`) pour WS5, mais on sort immédiatement sans rien écrire.

  Avant (`src/lib/margins-db.ts`, l.74-86) :
  ```ts
  // Recalcule puis ÉCRIT price pour les produits dont le prix change.
  // Réutilisé par /apply et par l'import Fluxitron (cost_price modifié).
  // NOTE: la cohérence A>B>C a besoin de TOUTE la famille — on charge donc tous les
  // produits (ou la marque), on calcule, PUIS on filtre par productIds. Ne jamais
  // charger seulement les productIds.
  export async function recomputeAndWritePrices(filter?: {
    brand?: string;
    productIds?: string[];
  }): Promise<{ updated: number }> {
    const db = createAdminClient();
    const { products, rules, settings } = await loadPricingInputs(
      filter?.brand ? { brand: filter.brand } : undefined
    );
  ```

  Après :
  ```ts
  // PRIX MANUELS (design 2026-06-22 §6) : `products.price` est désormais la source
  // de vérité, saisie à la main via la grille admin /admin/prix. Le moteur de marges
  // automatique n'écrit PLUS jamais price/compare_at_price.
  //
  // On garde la fonction (et le RPC bulk_update_prices ci-dessous) intacts car la
  // grille /admin/prix réutilise bulk_update_prices. Mais le RECALCUL auto est
  // neutralisé ici, au point d'étranglement unique : aucun des appelants (admin
  // margins apply/settings, routes Fluxitron /api/v1/*) ne peut plus écraser un prix.
  // C'est volontairement un no-op silencieux (et non un throw) pour ne casser aucun
  // appelant existant.
  const AUTO_MARGIN_RECOMPUTE_DISABLED = true;

  // Recalcule puis ÉCRIT price pour les produits dont le prix change.
  // Réutilisé par /apply et par l'import Fluxitron (cost_price modifié).
  // NOTE: la cohérence A>B>C a besoin de TOUTE la famille — on charge donc tous les
  // produits (ou la marque), on calcule, PUIS on filtre par productIds. Ne jamais
  // charger seulement les productIds.
  export async function recomputeAndWritePrices(filter?: {
    brand?: string;
    productIds?: string[];
  }): Promise<{ updated: number }> {
    // Garde prix manuels : ne rien écrire. Voir AUTO_MARGIN_RECOMPUTE_DISABLED.
    if (AUTO_MARGIN_RECOMPUTE_DISABLED) return { updated: 0 };
    const db = createAdminClient();
    const { products, rules, settings } = await loadPricingInputs(
      filter?.brand ? { brand: filter.brand } : undefined
    );
  ```

- [ ] **Step 2 : `/api/admin/margins/apply` → `410 Gone` délibéré** — remplacer entièrement le fichier.

  Avant (`src/app/api/admin/margins/apply/route.ts`, fichier entier) :
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

  Après :
  ```ts
  import { NextResponse } from 'next/server';
  import { requireAdmin } from '@/lib/auth';

  // PRIX MANUELS (design 2026-06-22 §6 & §9) : le moteur de marges automatique est
  // débranché. Les prix sont saisis à la main via la grille /admin/prix. Cette route
  // d'application en masse n'a plus de raison d'être et renvoie 410 Gone.
  export async function POST() {
    const { response } = await requireAdmin();
    if (response) return response;
    return NextResponse.json(
      {
        error: 'Moteur de marges automatique désactivé.',
        hint: 'Les prix sont désormais manuels. Utilisez la grille /admin/prix.',
      },
      { status: 410 }
    );
  }
  ```

- [ ] **Step 3 : `/api/admin/margins/settings` → retirer l'auto-recompute.**

  Avant (`src/app/api/admin/margins/settings/route.ts`, l.1-4) :
  ```ts
  import { NextResponse } from 'next/server';
  import { createAdminClient } from '@/lib/supabase-admin';
  import { requireAdmin } from '@/lib/auth';
  import { recomputeAndWritePrices } from '@/lib/margins-db';
  ```

  Après :
  ```ts
  import { NextResponse } from 'next/server';
  import { createAdminClient } from '@/lib/supabase-admin';
  import { requireAdmin } from '@/lib/auth';
  ```

  Avant (`src/app/api/admin/margins/settings/route.ts`, l.31-35) :
  ```ts
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    // La cohérence A>B>C change des prix → on réapplique tout de suite.
    let pricesUpdated = -1;
    try { pricesUpdated = (await recomputeAndWritePrices()).updated; } catch { /* filet : bouton Appliquer */ }
    return NextResponse.json({ settings: data, pricesUpdated });
  }
  ```

  Après :
  ```ts
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    // PRIX MANUELS (design 2026-06-22 §6) : on enregistre les réglages mais on ne
    // déclenche PLUS de recalcul d'écriture des prix (le moteur auto est débranché).
    return NextResponse.json({ settings: data });
  }
  ```

- [ ] **Step 4 : Re-recenser les appelants restants.**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && grep -rn "recomputeAndWritePrices" src/ --include="*.ts"
  ```
  Sortie attendue : les 5 appels restants sont des routes `/api/v1/*` (mortes via WS4) ; les 2 appels admin ont disparu ; la définition `export async function recomputeAndWritePrices(` reste dans `src/lib/margins-db.ts`.

- [ ] **Step 5 : Vérifier le type-check.**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && npx tsc --noEmit --skipLibCheck
  ```
  Sortie attendue : **aucune sortie** (exit 0). `db` reste utilisé plus bas dans la fonction ; `request` est retiré de la signature `POST` d'`apply/route.ts`.

- [ ] **Step 6 : Vérifier le 410 côté admin apply (statique).**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && grep -n "status: 410\|Moteur de marges" src/app/api/admin/margins/apply/route.ts
  ```
  Sortie attendue : 2 lignes (message + `{ status: 410 }`).

- [ ] **Step 7 : Commit.**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && \
  git add src/lib/margins-db.ts src/app/api/admin/margins/apply/route.ts src/app/api/admin/margins/settings/route.ts && \
  git commit -m "$(cat <<'EOF'
feat(prix): débrancher le moteur de marges auto (prix manuels)

products.price devient la source de vérité saisie à la main.
recomputeAndWritePrices devient un no-op (garde au point d'étranglement)
mais reste exportée + RPC bulk_update_prices conservé pour /admin/prix.
/api/admin/margins/apply renvoie 410 ; settings ne recalcule plus.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
  ```

---

## WS3 — Sortir la couleur de l'axe prix + supprimer la cohérence runtime A≥B≥C

> ⚠️ **Dépendance données :** la garantie « la couleur ne change pas le prix » repose sur la migration **Task E** (prix dénormalisé identique sur toutes les couleurs). Entre Task C et Task E, sur des données non encore consolidées, deux couleurs d'un même `(modèle, stockage, grade)` **peuvent** afficher des prix différents (le code lit le prix brut de chaque ligne). C'est transitoire et résolu par Task E. La **vérification manuelle de prix-par-couleur (Step 13) se fait APRÈS Task E**.

### Task C : Sortir la couleur de l'axe prix + supprimer la cohérence runtime A≥B≥C

**Files:**
- Modify: `src/lib/productVariants.ts:122-127` — `groupSkusByModel` : prix « à partir de » = prix brut stocké.
- Modify: `src/lib/productVariants.ts:178-243` — supprimer `coherenceBump` / `computeCoherentPrices` / `coherentSkuPrice` (helpers morts).
- Modify: `src/lib/productVariants.ts:296-304` — `buildVariantMatrix` : conserver `v.price` brut.
- Modify: `src/lib/productVariants.ts:10` — retirer `type DisplayGrade` de l'import (devenu inutilisé).
- Modify: `src/app/api/checkout/route.ts:7,55-77,128,198` — facturer `item.product.price` brut.
- Modify: `src/components/home/BestOffers.tsx:9,73-86` — lire le prix brut de la ligne représentante.

**Interfaces:**
- Consumes (de WS1/Task E, garantie données) : après migration, pour un même `(model, storage_capacity normalisé, grade A/B/C)`, **toutes** les lignes couleur actives ont le **même `products.price`**.
- Produces (signatures inchangées) :
  - `buildVariantMatrix(products: RawProduct[]): VariantMatrix` — `FrontVariant.price` = prix brut du SKU le moins cher de la variante `(storage, grade, color)`.
  - `groupSkusByModel(products: RawProduct[]): FrontModel[]` — `minPrice`/`maxPrice` sur les prix bruts.
  - `pickSkuForSelection(...)` — `price` = prix brut (inchangé).
  - **Supprimés** : `computeCoherentPrices`, `coherentSkuPrice`.

- [ ] **Step 1 : `productVariants.ts` — `groupSkusByModel` lit le prix brut**

  Avant :
  ```ts
      const activeSkus = skus.filter((s) => s.is_active);
      // Prix « à partir de » sur le prix de vente COHÉRENT (A ≥ B ≥ C), pas le brut.
      const coherent = computeCoherentPrices(activeSkus);
      const prices = coherent.size > 0
        ? [...coherent.values()]
        : activeSkus.map((s) => asNumber(s.price)).filter((p) => p > 0);
  ```

  Après :
  ```ts
      const activeSkus = skus.filter((s) => s.is_active);
      // Prix « à partir de » = prix STOCKÉ brut des SKU actifs (prix manuels).
      // Plus de cohérence runtime : products.price est la source de vérité.
      const prices = activeSkus.map((s) => asNumber(s.price)).filter((p) => p > 0);
  ```

- [ ] **Step 2 : `productVariants.ts` — supprimer les helpers de cohérence morts**

  Supprimer entièrement le bloc `coherenceBump` + `computeCoherentPrices` + `coherentSkuPrice` (du séparateur de section jusqu'à la fin de `coherentSkuPrice`).

  Avant :
  ```ts
  // ──────────────────────────────────────────────────────────────────────────────
  // Cohérence du PRIX DE VENTE (Grade A ≥ Grade B ≥ Grade C)
  // ──────────────────────────────────────────────────────────────────────────────
  // La source Foxway price parfois un grade SUPÉRIEUR moins cher qu'un grade
  // inférieur (ex. un A+ « comme neuf » à 670 € alors que des B sont à 790 €). Pour
  // le client, on garantit l'ordre A ≥ B ≥ C, par (modèle, couleur, stockage), en
  // REMONTANT le prix du grade supérieur UNIQUEMENT quand l'ordre est violé. Calcul
  // sur le prix de vente — l'ingestion Foxway n'est pas touchée. Le même prix sert
  // à l'affichage ET au paiement (cf. computeCoherentPrices / coherentSkuPrice).
  function coherenceBump(lower: number): number {
    // « un peu au-dessus » : +4 % (au moins 10 €), arrondi au multiple de 5 sup.
    return Math.ceil((lower + Math.max(10, Math.round(lower * 0.04))) / 5) * 5;
  }

  // Table `storage|grade|color` → prix de vente cohérent (contient TOUTES les
  // variantes ; le prix = brut quand l'ordre est déjà respecté).
  export function computeCoherentPrices(products: RawProduct[]): Map<string, number> {
    // 1) prix MINI brut par (storage, color, displayGrade)
    const cheapest = new Map<string, number>();
    for (const s of products) {
      if (!s.is_active) continue;
      const g = displayGrade(s.grade);
      if (!g) continue;
      const price = asNumber(s.price, Infinity);
      if (!Number.isFinite(price) || price <= 0) continue;
      const storage = normalizeStorage(s.storage_capacity) || STORAGE_PLACEHOLDER;
      const color = (s.color || STORAGE_PLACEHOLDER).trim() || STORAGE_PLACEHOLDER;
      const k = `${storage}|${color}|${g}`;
      const cur = cheapest.get(k);
      if (cur == null || price < cur) cheapest.set(k, price);
    }
    // 2) regroupe par (storage, color) puis impose C ≤ B ≤ A
    const groups = new Map<string, Partial<Record<DisplayGrade, number>>>();
    for (const [k, price] of cheapest) {
      const [storage, color, g] = k.split('|');
      const gk = `${storage}|${color}`;
      const grp = groups.get(gk) || {};
      grp[g as DisplayGrade] = price;
      groups.set(gk, grp);
    }
    const out = new Map<string, number>();
    for (const [gk, grp] of groups) {
      const [storage, color] = gk.split('|');
      const cohC = grp.C;
      let cohB = grp.B;
      let cohA = grp.A;
      if (cohB != null && cohC != null && cohB <= cohC) cohB = coherenceBump(cohC);
      const lowerForA = cohB != null ? cohB : cohC;
      if (cohA != null && lowerForA != null && cohA <= lowerForA) cohA = coherenceBump(lowerForA);
      if (cohC != null) out.set(`${storage}|C|${color}`, cohC);
      if (cohB != null) out.set(`${storage}|B|${color}`, cohB);
      if (cohA != null) out.set(`${storage}|A|${color}`, cohA);
    }
    return out;
  }

  // Prix de vente cohérent d'un SKU précis (checkout). Renvoie le prix ajusté si la
  // variante est concernée, sinon le prix brut du SKU.
  export function coherentSkuPrice(siblings: RawProduct[], sku: RawProduct): number {
    const raw = asNumber(sku.price, 0);
    const g = displayGrade(sku.grade);
    if (!g) return raw;
    const storage = normalizeStorage(sku.storage_capacity) || STORAGE_PLACEHOLDER;
    const color = (sku.color || STORAGE_PLACEHOLDER).trim() || STORAGE_PLACEHOLDER;
    const coh = computeCoherentPrices(siblings).get(`${storage}|${g}|${color}`);
    return coh != null ? coh : raw;
  }

  ```

  Après (le bloc entier est supprimé ; la section suivante `// Detail page: build a variant matrix…` enchaîne directement — ne rien laisser à la place).

  > Note : après suppression, `STORAGE_PLACEHOLDER` reste utilisé par `groupSkusByModel`/`buildVariantMatrix`, `displayGrade` reste utilisé l.145/256, `DISPLAY_GRADE_ORDER` l.308. Seul `type DisplayGrade` devient inutilisé → retiré au Step 4.

- [ ] **Step 3 : `productVariants.ts` — `buildVariantMatrix` garde le prix brut**

  Avant :
  ```ts
    // Cohérence prix : on remplace le prix brut par le prix de vente cohérent
    // (A ≥ B ≥ C) — même valeur qu'au checkout (coherentSkuPrice).
    const coherent = computeCoherentPrices(skus);
    for (const v of variants) {
      const p = coherent.get(`${v.storage}|${v.grade}|${v.color}`);
      if (p != null) v.price = p;
    }

    // Stable, predictable axis order (meilleur → pire selon les 3 grades client)
  ```

  Après :
  ```ts
    // Prix manuels : v.price = prix STOCKÉ du SKU le moins cher de la variante
    // (calculé ci-dessus). La couleur ne modifie plus le prix — après migration,
    // toutes les couleurs d'un (storage, grade) partagent le même products.price.

    // Stable, predictable axis order (meilleur → pire selon les 3 grades client)
  ```

- [ ] **Step 4 : `productVariants.ts` — retirer `type DisplayGrade` de l'import**

  Avant :
  ```ts
  import { displayGrade, modelSlug, DISPLAY_GRADE_ORDER, type DisplayGrade } from './products';
  ```

  Après :
  ```ts
  import { displayGrade, modelSlug, DISPLAY_GRADE_ORDER } from './products';
  ```

- [ ] **Step 5 : `checkout/route.ts` — retirer l'import `coherentSkuPrice`**

  Avant :
  ```ts
  import { coherentSkuPrice, type RawProduct } from '@/lib/productVariants';
  ```

  Après :
  ```ts
  import type { RawProduct } from '@/lib/productVariants';
  ```

- [ ] **Step 6 : `checkout/route.ts` — facturer le prix STOCKÉ brut**

  Avant :
  ```ts
      // Prix de vente COHÉRENT (Grade A ≥ B ≥ C), identique à l'affichage vitrine.
      // On recalcule ici pour garantir paiement == prix affiché (pas d'écart).
      const priceDb = createAdminClient();
      const sibCache = new Map<string, RawProduct[]>();
      const unitPrice = new Map<string, number>();
      for (const item of cartItems) {
        const p = item.product;
        const mk = `${p.brand}|${p.model}`;
        let sibs = sibCache.get(mk);
        if (!sibs) {
          const { data } = await priceDb
            .from('products')
            .select('id,brand,model,storage_capacity,color,grade,price,stock,is_active')
            .eq('is_active', true)
            .eq('brand', p.brand)
            .eq('model', p.model);
          sibs = (data && data.length ? data : [p]) as RawProduct[];
          sibCache.set(mk, sibs);
        }
        unitPrice.set(item.id, coherentSkuPrice(sibs, p as RawProduct));
      }
      const priceOf = (item: { id: string; product: { price: string | number } }) =>
        unitPrice.get(item.id) ?? (Number(item.product.price) || 0);
  ```

  Après :
  ```ts
      // Prix manuels : on facture le products.price STOCKÉ de la ligne (source de
      // vérité). Plus de recalcul de cohérence runtime — la couleur ne change pas
      // le prix, le prix affiché en fiche == products.price == prix Stripe.
      const priceOf = (item: { product: { price: string | number } }) =>
        Number(item.product.price) || 0;
  ```

  > `priceOf(item)` est appelé plus bas avec l'objet `item` complet (`cartItems`) ; la nouvelle signature (`{ product: { price } }`) reste satisfaite par les appels existants (l.95, l.128, l.150, l.200).

- [ ] **Step 7 : `checkout/route.ts` — recaler les commentaires « prix cohérent »**

  Avant :
  ```ts
            unit_amount: Math.round(priceOf(item) * 100), // cents (prix cohérent)
  ```

  Après :
  ```ts
            unit_amount: Math.round(priceOf(item) * 100), // cents (prix stocké)
  ```

  Puis, plus bas — Avant :
  ```ts
        // Prix RÉELLEMENT facturé (prix cohérent recalculé serveur), pas le prix brut
        // en base — garantit que la commande enregistre ce qui a été payé via Stripe.
        price_at_purchase: priceOf(item),
  ```

  Après :
  ```ts
        // Prix RÉELLEMENT facturé = products.price stocké (prix manuel), identique
        // à l'affichage fiche et au montant Stripe.
        price_at_purchase: priceOf(item),
  ```

- [ ] **Step 8 : `checkout/route.ts` — nettoyer l'import `RawProduct` s'il est orphelin**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && grep -n "RawProduct" src/app/api/checkout/route.ts
  ```
  Si **seule la ligne d'import** ressort, la supprimer :

  Avant :
  ```ts
  import type { RawProduct } from '@/lib/productVariants';
  ```

  Après : *(supprimer entièrement la ligne)*

  > `createAdminClient` reste utilisé ailleurs (referral codes, orders) — **ne pas** toucher à son import. `grep -n "createAdminClient" src/app/api/checkout/route.ts` doit montrer l'import + ≥2 usages.

- [ ] **Step 9 : `BestOffers.tsx` — retirer `coherentSkuPrice` de l'import**

  Avant :
  ```ts
  import { normalizeStorage, coherentSkuPrice } from '@/lib/productVariants';
  ```

  Après :
  ```ts
  import { normalizeStorage } from '@/lib/productVariants';
  ```

- [ ] **Step 10 : `BestOffers.tsx` — lire le prix brut de la ligne représentante**

  Avant :
  ```ts
            // Prix de vente COHÉRENT (A≥B≥C) pour le représentant de chaque modèle,
            // calculé sur TOUS les SKU du modèle → même prix que la fiche.
            const skusByModel = new Map<string, any[]>();
            for (const p of allProducts) {
              if (p.category === 'accessoires' || !/iphone/i.test(p.model || '')) continue;
              const k = (p.model || '').trim();
              if (!k) continue;
              (skusByModel.get(k) || skusByModel.set(k, []).get(k)!).push(p);
            }
            const models = [...byModel.values()].map((p: any) => ({
              ...p,
              price: String(coherentSkuPrice(skusByModel.get((p.model || '').trim()) || [p], p)),
              original_price: p.compare_at_price != null ? String(p.compare_at_price) : p.original_price,
            }));
  ```

  Après :
  ```ts
            // Prix manuels : prix STOCKÉ brut du représentant (SKU le moins cher du
            // modèle, déjà retenu dans byModel) → identique au prix de la fiche.
            const models = [...byModel.values()].map((p: any) => ({
              ...p,
              price: String(p.price),
              original_price: p.compare_at_price != null ? String(p.compare_at_price) : p.original_price,
            }));
  ```

- [ ] **Step 11 : Vérifier l'absence de tout résidu de cohérence**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && grep -rn "coherentSkuPrice\|computeCoherentPrices\|coherenceBump" src/ --include="*.ts" --include="*.tsx"
  ```
  Attendu : **aucune sortie**.

- [ ] **Step 12 : Vérifier la compilation TypeScript**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && npx tsc --noEmit --skipLibCheck
  ```
  Attendu : **aucune erreur** (sortie vide, exit 0). Pas de `TS2304: Cannot find name 'coherentSkuPrice'`.

- [ ] **Step 13 : Vérification manuelle — couleur n'affecte pas le prix** *(à exécuter APRÈS la migration Task E)*

  Lancer `npm run dev`, puis :
  1. Ouvrir une fiche `/products/[id]` d'un iPhone multi-couleurs. Noter le prix.
  2. Cliquer chaque pastille **Couleur** (sans changer stockage ni grade) → le prix affiché (et « 3× sans frais ») reste **strictement identique** ; seules la photo héro et la miniature changent.
  3. Changer **Stockage** ou **Grade** → le prix **doit** changer.
  4. Ajouter au panier → `/checkout` → session Stripe : `unit_amount` Stripe == prix affiché en fiche, au centime près.
  5. Home `/` « Recommandés pour vous » : prix des cartes == prix de la fiche.
  6. Catalogue `/products` : « À partir de … € » == `MIN(products.price)` des lignes actives du modèle.

- [ ] **Step 14 : Commit**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && git add src/lib/productVariants.ts src/app/api/checkout/route.ts src/components/home/BestOffers.tsx && git commit -m "$(cat <<'EOF'
feat(prix): prix stocké brut partout, couleur hors axe prix

Supprime la cohérence runtime A>=B>=C (computeCoherentPrices,
coherentSkuPrice, coherenceBump) du catalogue, de la home et du
checkout. Le prix affiché ET facturé devient products.price stocké
(prix manuels). La couleur reste un axe de selection (swatch, photo,
exemplaire expedie) mais ne modifie plus le prix.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
  ```

---

## WS5 — Grille admin `/admin/prix` (saisie prix & stock)

> Net-new, **doit exister AVANT la migration (Task E)** (le stock repart à 0 → il faut un écran pour le resaisir). Conforme à la spec §10.
> Réutilise exactement : `requireAdmin()` (`@/lib/auth`), `createAdminClient()` (`@/lib/supabase-admin`), le RPC SQL `bulk_update_prices(updates jsonb)` (migration `018`), `displayGrade()` / `DISPLAY_GRADES` / `DISPLAY_GRADE_ORDER` (`@/lib/products`), `normalizeStorage()` (`@/lib/productVariants`).
> Aucun test automatisé : vérification par `npx tsc --noEmit --skipLibCheck` + checklist manuelle.

### Task D1 : Endpoint API `/api/admin/prix` (lecture groupée + écriture prix/stock)

**Files:**
- Create: `src/app/api/admin/prix/route.ts` — GET (catalogue groupé) + PUT (prix sur toutes les couleurs via RPC, ou stock par couleur)

**Interfaces:**
- Consumes : `requireAdmin()` de `@/lib/auth`, `createAdminClient()` de `@/lib/supabase-admin`, RPC `bulk_update_prices(updates jsonb)` (renvoie `integer`), `displayGrade(raw): 'A'|'B'|'C'|null` et `DISPLAY_GRADE_ORDER` de `@/lib/products`, `normalizeStorage(raw): string|null` de `@/lib/productVariants`.
- Produces :
  - `GET /api/admin/prix` → `{ groups: PrixGroup[] }`
  - `PUT /api/admin/prix` (price)  body `{ kind: 'price'; model: string; storage: string | null; grade: 'A'|'B'|'C'; price: number; compare_at_price?: number | null }` → `{ updated: number }`
  - `PUT /api/admin/prix` (stock)  body `{ kind: 'stock'; productId: string; stock: number }` → `{ updated: number }`
  - Types exportés : `PrixColorStock`, `PrixGroup`.

- [ ] **Step 1 : Créer le fichier complet `src/app/api/admin/prix/route.ts`** (fichier neuf) :

  ```ts
  import { NextResponse } from 'next/server';
  import { createAdminClient } from '@/lib/supabase-admin';
  import { requireAdmin } from '@/lib/auth';
  import { displayGrade, DISPLAY_GRADE_ORDER, type DisplayGrade } from '@/lib/products';
  import { normalizeStorage } from '@/lib/productVariants';

  // ── Types de réponse (consommés par src/app/admin/prix/page.tsx) ─────────────
  export interface PrixColorStock {
    color: string | null;
    productId: string;
    stock: number;
  }
  export interface PrixGroup {
    model: string;
    brand: string;
    storage: string | null;          // null = pas de stockage (ex. S25 Ultra)
    grade: DisplayGrade;             // 'A' | 'B' | 'C'
    price: number;                   // prix partagé du (modèle, stockage, grade)
    compareAtPrice: number | null;   // prix barré partagé (ou null)
    colors: PrixColorStock[];        // détail stock par couleur
  }

  type AdminDb = ReturnType<typeof createAdminClient>;

  interface Row {
    id: string;
    brand: string | null;
    model: string | null;
    storage_capacity: string | null;
    color: string | null;
    grade: string | null;
    price: number | string | null;
    compare_at_price: number | string | null;
    stock: number | null;
  }

  const num = (v: unknown): number => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    return Number.isFinite(n) ? n : 0;
  };

  // PostgREST plafonne chaque requête à ~1000 lignes : on pagine comme
  // fetchAllProductRows() dans margins-db.ts (ORDER BY id déterministe).
  const PAGE = 1000;
  async function fetchActiveTelephoneRows(db: AdminDb): Promise<Row[]> {
    const all: Row[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await db
        .from('products')
        .select('id, brand, model, storage_capacity, color, grade, price, compare_at_price, stock')
        .eq('is_active', true)
        .eq('category', 'telephones')
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error || !data) break;
      all.push(...(data as Row[]));
      if (data.length < PAGE) break;
      from += PAGE;
      if (from > 100_000) break; // garde-fou
    }
    return all;
  }

  // GET /api/admin/prix
  // Regroupe le catalogue téléphone actif en une entrée par (modèle, stockage,
  // grade affiché A/B/C), avec prix/compare_at partagés + stock par couleur.
  export async function GET() {
    const { response } = await requireAdmin();
    if (response) return response;

    const db = createAdminClient();
    const rows = await fetchActiveTelephoneRows(db);

    // Clé de groupe = model | storage normalisé | grade affiché.
    const map = new Map<string, {
      brand: string; model: string; storage: string | null; grade: DisplayGrade;
      prices: number[]; compareAts: number[];
      colors: Map<string, PrixColorStock>;
    }>();

    for (const r of rows) {
      const model = (r.model ?? '').trim();
      if (!model) continue;
      const g = displayGrade(r.grade);
      if (!g) continue; // D/E ou grade illisible → exclus (cf. spec §4)
      const storage = normalizeStorage(r.storage_capacity);
      const key = `${model.toLowerCase()}|${storage ?? ''}|${g}`;

      let grp = map.get(key);
      if (!grp) {
        grp = {
          brand: (r.brand ?? '').trim(), model, storage, grade: g,
          prices: [], compareAts: [], colors: new Map(),
        };
        map.set(key, grp);
      }
      grp.prices.push(num(r.price));
      if (r.compare_at_price != null) grp.compareAts.push(num(r.compare_at_price));

      // Une entrée stock par couleur. Pré-migration plusieurs lignes peuvent
      // partager une couleur : on garde la 1re (ORDER BY id) et on somme le stock.
      const colorKey = r.color ?? '';
      const existing = grp.colors.get(colorKey);
      if (existing) {
        existing.stock += num(r.stock);
      } else {
        grp.colors.set(colorKey, { color: r.color, productId: r.id, stock: num(r.stock) });
      }
    }

    const groups: PrixGroup[] = Array.from(map.values()).map((grp) => ({
      brand: grp.brand,
      model: grp.model,
      storage: grp.storage,
      grade: grp.grade,
      // Prix « à partir de » = MIN (uniforme après migration → MIN == valeur unique).
      price: grp.prices.length ? Math.min(...grp.prices) : 0,
      compareAtPrice: grp.compareAts.length ? Math.min(...grp.compareAts) : null,
      colors: Array.from(grp.colors.values()).sort((a, b) =>
        (a.color ?? '').localeCompare(b.color ?? '')
      ),
    }));

    // Tri stable : modèle, puis stockage, puis grade A/B/C.
    const gradeRank = (g: DisplayGrade) => DISPLAY_GRADE_ORDER.indexOf(g);
    groups.sort((a, b) =>
      a.model.localeCompare(b.model) ||
      (a.storage ?? '').localeCompare(b.storage ?? '') ||
      gradeRank(a.grade) - gradeRank(b.grade)
    );

    return NextResponse.json({ groups });
  }

  // ── Corps de la requête PUT (discriminé par `kind`) ──────────────────────────
  type PutBody =
    | { kind: 'price'; model: string; storage: string | null; grade: DisplayGrade; price: number; compare_at_price?: number | null }
    | { kind: 'stock'; productId: string; stock: number };

  // PUT /api/admin/prix
  //  - kind:'price' → résout TOUS les ids couleur actifs du (modèle, stockage,
  //    grade) puis écrit price (+compare_at) en masse via bulk_update_prices.
  //  - kind:'stock' → update stock sur un seul productId.
  export async function PUT(request: Request) {
    const { response } = await requireAdmin();
    if (response) return response;

    const body = (await request.json().catch(() => null)) as PutBody | null;
    if (!body || (body.kind !== 'price' && body.kind !== 'stock')) {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    }

    const db = createAdminClient();

    if (body.kind === 'stock') {
      const stock = Math.max(0, Math.trunc(Number(body.stock)));
      if (!body.productId || !Number.isFinite(stock)) {
        return NextResponse.json({ error: 'productId/stock invalides' }, { status: 400 });
      }
      const { error } = await db
        .from('products')
        .update({ stock, updated_at: new Date().toISOString() })
        .eq('id', body.productId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ updated: 1 });
    }

    // kind === 'price'
    const price = Number(body.price);
    if (!body.model || !body.grade || !Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'model/grade/price invalides' }, { status: 400 });
    }
    const hasCap = body.compare_at_price !== undefined;
    const cap = hasCap && body.compare_at_price != null ? Number(body.compare_at_price) : null;

    // Résoudre TOUS les ids couleur actifs du groupe. On filtre côté SQL sur
    // model + is_active + catégorie, puis côté JS sur le stockage NORMALISÉ et
    // le grade AFFICHÉ (les valeurs brutes en base sont sales : '256 GO', 'A+'…).
    const targetStorage = body.storage; // déjà normalisé côté UI (ex. '128 Go' | null)
    const { data: candidates, error: selErr } = await db
      .from('products')
      .select('id, storage_capacity, grade')
      .eq('is_active', true)
      .eq('category', 'telephones')
      .eq('model', body.model);
    if (selErr) return NextResponse.json({ error: selErr.message }, { status: 400 });

    const ids = (candidates ?? [])
      .filter((c) =>
        normalizeStorage(c.storage_capacity as string | null) === targetStorage &&
        displayGrade(c.grade as string | null) === body.grade
      )
      .map((c) => c.id as string);

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Aucune ligne active pour ce groupe' }, { status: 404 });
    }

    // Écriture EN MASSE via le RPC bulk_update_prices (1 seul UPDATE serveur).
    const updates = ids.map((id) => {
      const payload: { id: string; price: number; compare_at_price?: number | null } = { id, price };
      if (hasCap) payload.compare_at_price = cap;
      return payload;
    });
    const { error: rpcErr } = await db.rpc('bulk_update_prices', { updates });
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 400 });

    return NextResponse.json({ updated: ids.length });
  }
  ```

  > Note RPC : `bulk_update_prices` ne touche `compare_at_price` **que** si la clé est présente dans l'objet (cf. migration 018). En envoyant `compare_at_price: null` on l'efface volontairement ; en l'omettant on le laisse intact.

- [ ] **Step 2 : Vérifier la compilation.**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && npx tsc --noEmit --skipLibCheck
  ```
  Attendu : aucune erreur (exit 0).

- [ ] **Step 3 : Commit.**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && git add src/app/api/admin/prix/route.ts && git commit -m "$(cat <<'EOF'
feat(admin/prix): endpoint API lecture groupée + écriture prix/stock

GET regroupe le catalogue téléphone actif par (modèle, stockage, grade A/B/C)
avec prix partagé + stock par couleur. PUT écrit le prix sur toutes les couleurs
du groupe via bulk_update_prices, ou le stock sur une seule ligne couleur.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
  ```

### Task D2 : Page admin `/admin/prix` (grille éditable)

**Files:**
- Create: `src/app/admin/prix/page.tsx` — table groupée par modèle, prix éditable par (stockage×grade), stock par couleur dépliable, boutons « Enregistrer » → PUT

**Interfaces:**
- Consumes : `GET /api/admin/prix` et `PUT /api/admin/prix` (Task D1) ; types `PrixGroup` / `PrixColorStock` importés depuis `@/app/api/admin/prix/route`.
- Produces : composant page React `PrixPage` (export default) sur `/admin/prix`.

- [ ] **Step 1 : Créer le fichier complet `src/app/admin/prix/page.tsx`** (fichier neuf) :

  ```tsx
  'use client';

  import { useEffect, useState, useCallback } from 'react';
  import type { PrixGroup, PrixColorStock } from '@/app/api/admin/prix/route';
  import { DISPLAY_GRADE_ORDER, type DisplayGrade } from '@/lib/products';

  const NO_STORE: RequestInit = { cache: 'no-store' };
  const inputStyle = { padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6 };
  const GRADES: DisplayGrade[] = DISPLAY_GRADE_ORDER;

  // Clé identifiant un (modèle, stockage, grade) côté client.
  const groupKey = (g: { model: string; storage: string | null; grade: DisplayGrade }) =>
    `${g.model}|${g.storage ?? ''}|${g.grade}`;

  export default function PrixPage() {
    const [groups, setGroups] = useState<PrixGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<string | null>(null);

    const load = useCallback(async () => {
      setLoading(true);
      const r = await fetch('/api/admin/prix', NO_STORE);
      const d = await r.json();
      setGroups(d.groups ?? []);
      setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // Modèles uniques, ordre d'apparition (le GET trie déjà modèle→stockage→grade).
    const models = Array.from(new Set(groups.map((g) => g.model)));

    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 500, color: '#0f172a', marginBottom: 4 }}>Prix &amp; stock</h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Saisie manuelle des prix par (modèle, stockage, grade). Le prix est partagé
            par toutes les couleurs. Le stock se saisit couleur par couleur.
          </p>
        </div>

        {message && <p style={{ color: '#16a34a', fontSize: '0.85rem', marginBottom: 12 }}>{message}</p>}

        {loading ? (
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Chargement…</p>
        ) : (
          models.map((model) => (
            <ModelBlock
              key={model}
              model={model}
              groups={groups.filter((g) => g.model === model)}
              onSaved={(msg) => setMessage(msg)}
            />
          ))
        )}
      </div>
    );
  }

  // Un bloc par modèle : table (stockage × grade) pour le prix, + stock dépliable.
  function ModelBlock({ model, groups, onSaved }: {
    model: string;
    groups: PrixGroup[];
    onSaved: (msg: string) => void;
  }) {
    const brand = groups[0]?.brand ?? '';
    // Stockages distincts présents pour ce modèle (null = ligne « sans stockage »).
    const storages = Array.from(new Set(groups.map((g) => g.storage ?? '')))
      .sort((a, b) => a.localeCompare(b));
    const byKey = new Map(groups.map((g) => [groupKey(g), g] as const));

    return (
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>
          {brand} {model}
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#64748b' }}>
                <th style={{ padding: 10 }}>Stockage</th>
                {GRADES.map((g) => <th key={g} style={{ padding: 10 }}>Grade {g}</th>)}
              </tr>
            </thead>
            <tbody>
              {storages.map((s) => (
                <tr key={s || '∅'} style={{ borderTop: '1px solid #f1f5f9', verticalAlign: 'top' }}>
                  <td style={{ padding: 10, fontWeight: 500, color: '#0f172a' }}>{s || '—'}</td>
                  {GRADES.map((g) => {
                    const grp = byKey.get(`${model}|${s}|${g}`);
                    return (
                      <td key={g} style={{ padding: 10 }}>
                        {grp ? <PriceCell group={grp} onSaved={onSaved} /> : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Cellule prix + barré pour un (modèle, stockage, grade) + stock par couleur dépliable.
  function PriceCell({ group, onSaved }: { group: PrixGroup; onSaved: (msg: string) => void }) {
    const [price, setPrice] = useState(String(group.price ?? ''));
    const [compareAt, setCompareAt] = useState(group.compareAtPrice != null ? String(group.compareAtPrice) : '');
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const savePrice = async () => {
      setBusy(true);
      const r = await fetch('/api/admin/prix', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'price',
          model: group.model,
          storage: group.storage,
          grade: group.grade,
          price: Number(price),
          compare_at_price: compareAt.trim() === '' ? null : Number(compareAt),
        }),
      });
      const d = await r.json();
      setBusy(false);
      onSaved(d.error ? `Erreur : ${d.error}` : `${d.updated ?? 0} couleur(s) mises à jour (${group.storage ?? '—'} · ${group.grade}).`);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 150 }}>
        <input
          type="number" step="0.01" min={0} placeholder="Prix"
          value={price} onChange={(e) => setPrice(e.target.value)}
          style={{ ...inputStyle, width: 110 }}
        />
        <input
          type="number" step="0.01" min={0} placeholder="Barré"
          value={compareAt} onChange={(e) => setCompareAt(e.target.value)}
          style={{ ...inputStyle, width: 110, color: '#94a3b8' }}
        />
        <button onClick={savePrice} disabled={busy}
          style={{ padding: '5px 10px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 6, cursor: busy ? 'wait' : 'pointer', fontWeight: 500, fontSize: '0.78rem' }}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button onClick={() => setOpen((o) => !o)}
          style={{ padding: 0, background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.75rem', textAlign: 'left' }}>
          {open ? 'Masquer le stock' : `Stock par couleur (${group.colors.length})`}
        </button>
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
            {group.colors.map((c) => (
              <StockRow key={c.productId} color={c} onSaved={onSaved} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Une ligne stock = une couleur (= 1 productId). Met à jour UNIQUEMENT cette ligne.
  function StockRow({ color, onSaved }: { color: PrixColorStock; onSaved: (msg: string) => void }) {
    const [stock, setStock] = useState(String(color.stock ?? 0));
    const [busy, setBusy] = useState(false);

    const save = async () => {
      setBusy(true);
      const r = await fetch('/api/admin/prix', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'stock', productId: color.productId, stock: Number(stock) }),
      });
      const d = await r.json();
      setBusy(false);
      onSaved(d.error ? `Erreur : ${d.error}` : `Stock « ${color.color ?? '—'} » = ${Number(stock)}.`);
    };

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ flex: 1, fontSize: '0.75rem', color: '#475569' }}>{color.color ?? '—'}</span>
        <input
          type="number" min={0} step={1}
          value={stock} onChange={(e) => setStock(e.target.value)}
          style={{ ...inputStyle, width: 56, padding: '3px 6px' }}
        />
        <button onClick={save} disabled={busy}
          style={{ background: 'none', border: 'none', color: busy ? '#94a3b8' : '#16a34a', cursor: busy ? 'wait' : 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
          OK
        </button>
      </div>
    );
  }
  ```

  > Importer les types depuis la route (`import type { … }`) est volontaire (même pattern que `margins/page.tsx` qui importe de `@/lib/margins`). Comme `route.ts` n'exporte que des **interfaces** (effacées à la compilation), aucun code serveur n'est tiré dans le bundle client.

- [ ] **Step 2 : Vérifier la compilation.**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && npx tsc --noEmit --skipLibCheck
  ```
  Attendu : aucune erreur (exit 0).

- [ ] **Step 3 : Commit.**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && git add src/app/admin/prix/page.tsx && git commit -m "$(cat <<'EOF'
feat(admin/prix): grille de saisie prix & stock groupée par modèle

Table (stockage × grade) à prix éditable partagé par couleur, + stock dépliable
par couleur. Pré-rempli depuis GET /api/admin/prix, écriture via PUT.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
  ```

### Task D3 : Lien de navigation « Prix & stock » dans la sidebar admin

**Files:**
- Modify: `src/app/admin/layout.tsx:22-31` — ajouter l'entrée nav `/admin/prix` + import de l'icône `Tag`

**Interfaces:**
- Consumes : route `/admin/prix` (Task D2). Produces : entrée de menu.

- [ ] **Step 1 : Importer l'icône `Tag` de lucide-react.**

  Avant :
  ```
        Gavel,
        Percent,
      } from 'lucide-react';
  ```
  Après :
  ```
        Gavel,
        Percent,
        Tag,
      } from 'lucide-react';
  ```

- [ ] **Step 2 : Ajouter l'entrée de menu après « Marges ».**

  Avant :
  ```
    { href: '/admin/margins', label: 'Marges', icon: Percent, badgeKey: null },
    { href: '/admin/orders', label: 'Commandes', icon: ShoppingCart, badgeKey: 'pending_orders' as const },
  ```
  Après :
  ```
    { href: '/admin/margins', label: 'Marges', icon: Percent, badgeKey: null },
    { href: '/admin/prix', label: 'Prix & stock', icon: Tag, badgeKey: null },
    { href: '/admin/orders', label: 'Commandes', icon: ShoppingCart, badgeKey: 'pending_orders' as const },
  ```

  > Si le code réel diffère légèrement (ordre/regroupement des imports `lucide-react` ou des `navItems`), appliquer l'**équivalent** : ajouter `Tag` à l'import et l'entrée `{ href: '/admin/prix', label: 'Prix & stock', icon: Tag, badgeKey: null }` dans `navItems`, en conservant toutes les entrées existantes.

- [ ] **Step 3 : Vérifier la compilation.**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && npx tsc --noEmit --skipLibCheck
  ```
  Attendu : aucune erreur (exit 0).

- [ ] **Step 4 : Commit.**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && git add src/app/admin/layout.tsx && git commit -m "$(cat <<'EOF'
feat(admin): entrée de menu « Prix & stock » vers /admin/prix

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
  ```

### Vérification manuelle WS5 (post-implémentation, idéalement après Task E)

> `npm run dev`, se connecter en admin, ouvrir `/admin/prix`.

- [ ] **Lecture** : blocs par modèle ; table (lignes = stockages, colonnes = Grade A/B/C) ; prix + barré pré-remplis. Les modèles sans stockage (S25 Ultra) apparaissent sur une ligne « — ».
- [ ] **Écriture prix → toutes les couleurs** : modifier le prix d'une cellule (ex. iPhone 12 / 128 Go / B), « Enregistrer ». Vérifier en base (MCP `execute_sql`, `klungktcrjlwxqfbbbec`) :
  ```sql
  SELECT color, price FROM products
  WHERE model = 'iPhone 12' AND storage_capacity ILIKE '128%' AND grade ILIKE 'B%'
    AND is_active = true AND category = 'telephones'
  ORDER BY color;
  ```
  Attendu : **toutes** les lignes couleur ont le **même** `price` = la valeur saisie.
- [ ] **Barré effaçable** : vider « Barré » + Enregistrer → `compare_at_price` = `NULL` sur toutes les couleurs ; saisir une valeur → `compare_at_price` = valeur.
- [ ] **Écriture stock → une seule ligne** : déplier « Stock par couleur », changer une couleur, « OK ». Seule cette ligne change (`price` partagé, `stock` indépendant).
- [ ] **Périmètre** : aucun accessoire ni grade D/E dans la grille.
- [ ] **Auth** : `GET /api/admin/prix` sans session → 401 ; non-admin → 403.

---

## WS1 — Migration de données SQL

> Convention : le dernier numéro est `018` (utilisé deux fois). Le prochain libre est **`019`**.

### Task E: Migration de données SQL — consolidation catalogue magasin (`019_catalogue_magasin.sql`)

**Files:**
- Create: `supabase/migrations/019_catalogue_magasin.sql`

**Interfaces:**
- Consumes : RPC `public.bulk_update_prices` (migration `018`, non appelé ici) ; trigger `trg_grade_de_inactive` / `enforce_grade_de_inactive()` (compatible) ; colonne `products.source CHECK (source IN ('manual','fluxitron'))` (migration `006`).
- Produces : helpers SQL éphémères `fn_normalize_storage_telephones(text)` (réplique `normalizeStorage`) et `fn_display_grade_telephones(text)` (réplique `displayGrade`) ; invariant post-migration : 1 ligne active `telephones` = 1 tuple `(model, storage normalisé, grade∈{A,B,C}, color)` ; `price` dénormalisé ; `stock=0` ; `source='manual'` ; 0 ligne `source='fluxitron'`.

- [ ] **Step 0 (AVERTISSEMENT — bloquant) : confirmer l'ordre d'exécution.** Cette migration s'exécute **EN DERNIER** : après le merge du code (Tasks A–C) **ET** après la livraison de la grille `/admin/prix` (Task D). Elle met **`stock=0` sur toutes les lignes téléphones consolidées** → **plus rien n'est achetable** tant que le stock n'est pas ressaisi dans `/admin/prix`. Ne pas appliquer en prod sans avoir validé ce point avec l'utilisateur.

- [ ] **Step 1 : Créer le fichier** `supabase/migrations/019_catalogue_magasin.sql` (contenu intégral) :

  ```sql
  -- =====================================================================
  -- TEL & CASH -- Migration 019
  -- Catalogue 100 % magasin : consolidation + prix manuels + abandon Fluxitron.
  -- Spec : docs/superpowers/specs/2026-06-22-catalogue-magasin-prix-manuels-design.md (§5)
  --
  -- IDEMPOTENTE & NON DESTRUCTIVE :
  --   * Aucune ligne supprimée (FK cart_items ON DELETE CASCADE,
  --     order_items ON DELETE SET NULL) → on désactive (is_active=false).
  --   * Rejouable : chaque passe re-filtre sur is_active=true et recalcule la
  --     normalisation (displayGrade('A')='A', normalize('256 Go')='256 Go').
  --
  -- AVERTISSEMENT : met stock=0 sur toutes les lignes téléphones consolidées
  --   → site inachetable jusqu'à saisie du stock dans /admin/prix (décision D7).
  --
  -- Périmètre : category='telephones' uniquement (8 accessoires NON touchés).
  -- =====================================================================

  BEGIN;

  -- ---------------------------------------------------------------------
  -- 0) Helpers SQL éphémères répliquant la logique TypeScript.
  -- ---------------------------------------------------------------------

  -- Réplique normalizeStorage() (src/lib/productVariants.ts:17) :
  --   '256 GO' / '256' / '256 GB' -> '256 Go'
  --   '1024' / '1 TO' / '1 to'    -> '1 To'
  --   NULL / '' / '—' / non parsable -> NULL  (S25 Ultra reste NULL)
  CREATE OR REPLACE FUNCTION public.fn_normalize_storage_telephones(raw text)
  RETURNS text
  LANGUAGE plpgsql
  IMMUTABLE
  AS $$
  DECLARE
    s     text;
    m     text[];
    num   bigint;
    unit  text;
    gb    bigint;
  BEGIN
    IF raw IS NULL THEN RETURN NULL; END IF;
    s := btrim(raw);
    IF s = '' OR s = '—' THEN RETURN NULL; END IF;

    -- (\d{1,4})\s*(to|tb|go|gb)? insensible à la casse — 1er match
    m := regexp_match(s, '(\d{1,4})\s*(to|tb|go|gb)?', 'i');
    IF m IS NULL THEN RETURN NULL; END IF;

    num  := (m[1])::bigint;
    unit := lower(coalesce(m[2], ''));
    gb   := num;
    IF unit IN ('to', 'tb') THEN
      gb := num * 1024;                       -- To/TB -> Go pour le calcul
    END IF;

    IF gb <= 0 THEN RETURN NULL; END IF;
    IF gb >= 1024 AND gb % 1024 = 0 THEN
      RETURN (gb / 1024)::text || ' To';
    END IF;
    RETURN gb::text || ' Go';
  END;
  $$;

  -- Réplique displayGrade() (src/lib/products.ts:112) repliée en A/B/C :
  --   A+, A           -> A
  --   B+, B           -> B
  --   C+, C, D, E     -> C
  --   non reconnu / NULL -> NULL
  CREATE OR REPLACE FUNCTION public.fn_display_grade_telephones(raw text)
  RETURNS text
  LANGUAGE plpgsql
  IMMUTABLE
  AS $$
  DECLARE
    g       text;
    letter  text;
    m       text[];
  BEGIN
    IF raw IS NULL THEN RETURN NULL; END IF;
    g := upper(btrim(regexp_replace(raw, '\s+', ' ', 'g')));
    IF g = '' THEN RETURN NULL; END IF;

    -- Lettres canoniques A/B/C avec « + » éventuel.
    m := regexp_match(g, '\m(?:GRADE\s*)?([ABC])\s*(\+)?');
    IF m IS NOT NULL THEN
      letter := m[1] || CASE WHEN m[2] IS NOT NULL THEN '+' ELSE '' END;
      IF letter IN ('A+','A') THEN RETURN 'A'; END IF;
      IF letter IN ('B+','B') THEN RETURN 'B'; END IF;
      IF letter IN ('C+','C') THEN RETURN 'C'; END IF;
    END IF;

    -- Grades Foxway D / E -> repliés en C.
    m := regexp_match(g, '\m(?:GRADE\s*)?([DE])\M');
    IF m IS NOT NULL THEN
      RETURN 'C';
    END IF;

    -- Libellés FR legacy.
    IF g LIKE 'PARFAIT%' OR g LIKE 'EXCELLENT%' THEN RETURN 'A'; END IF;     -- ->A
    IF g LIKE 'TRÈS BON%' OR g LIKE 'TRES BON%' THEN RETURN 'B'; END IF;     -- B+ -> B
    IF g LIKE 'BON %' OR g = 'BON' THEN RETURN 'B'; END IF;                  -- ->B
    IF position('CORRECT' IN g) > 0 THEN RETURN 'C'; END IF;                 -- ->C

    RETURN NULL;
  END;
  $$;

  -- ---------------------------------------------------------------------
  -- 1) Normaliser storage_capacity (telephones). NULL conservés.
  --    Idempotent : '256 Go' -> '256 Go'.
  -- ---------------------------------------------------------------------
  UPDATE public.products p
  SET storage_capacity = public.fn_normalize_storage_telephones(p.storage_capacity)
  WHERE p.category = 'telephones'
    AND p.storage_capacity IS NOT NULL
    AND public.fn_normalize_storage_telephones(p.storage_capacity) IS DISTINCT FROM p.storage_capacity;

  -- ---------------------------------------------------------------------
  -- 2) Exclure D / E / grade NULL (telephones) : is_active=false.
  --    Idempotent : ne réactive jamais.
  -- ---------------------------------------------------------------------
  UPDATE public.products p
  SET is_active = false
  WHERE p.category = 'telephones'
    AND p.is_active = true
    AND (p.grade IS NULL OR public.fn_display_grade_telephones(p.grade) IS NULL OR p.grade IN ('D','E'));

  -- ---------------------------------------------------------------------
  -- 3) Seed des prix de départ AVANT toute mutation de price/grade.
  --    Prix par (model, storage normalisé, grade affiché) = MIN(price) des
  --    lignes ACTIVES restantes (le « à partir de »). Capturé en table TEMP.
  -- ---------------------------------------------------------------------
  CREATE TEMP TABLE _seed_prices ON COMMIT DROP AS
  SELECT
    p.model                                              AS model,
    p.storage_capacity                                   AS storage_capacity,  -- déjà normalisé (NULL ok)
    public.fn_display_grade_telephones(p.grade)          AS dgrade,
    MIN(p.price)                                         AS seed_price
  FROM public.products p
  WHERE p.category = 'telephones'
    AND p.is_active = true
    AND public.fn_display_grade_telephones(p.grade) IS NOT NULL
  GROUP BY p.model, p.storage_capacity, public.fn_display_grade_telephones(p.grade);

  -- ---------------------------------------------------------------------
  -- 4) Consolidation par groupe G = (model, storage normalisé, displayGrade, color)
  --    sur les lignes ACTIVES restantes :
  --      - canonique = plus petit id (ORDER BY id) ;
  --      - canonique : grade -> A/B/C, images -> union dédupliquée de G,
  --        source='manual', stock=0 ;
  --      - autres lignes de G : is_active=false (jamais DELETE).
  --    NULL (storage ou color) groupés ensemble via la PARTITION (NULL = NULL).
  -- ---------------------------------------------------------------------

  -- 4a) Désigner la canonique de chaque groupe + collecter l'union d'images.
  CREATE TEMP TABLE _consolidation ON COMMIT DROP AS
  WITH active_tel AS (
    SELECT
      p.id,
      p.model,
      p.storage_capacity,
      p.color,
      public.fn_display_grade_telephones(p.grade) AS dgrade,
      p.images
    FROM public.products p
    WHERE p.category = 'telephones'
      AND p.is_active = true
      AND public.fn_display_grade_telephones(p.grade) IS NOT NULL
  ),
  ranked AS (
    SELECT
      a.*,
      first_value(a.id) OVER (
        PARTITION BY a.model, a.storage_capacity, a.dgrade, a.color
        ORDER BY a.id
      ) AS canonical_id
    FROM active_tel a
  ),
  -- union dédupliquée des images de tout le groupe (ordre stable)
  group_images AS (
    SELECT
      r.canonical_id,
      array_agg(img ORDER BY img) AS merged_images
    FROM (
      SELECT DISTINCT r.canonical_id, img
      FROM ranked r
      LEFT JOIN LATERAL unnest(coalesce(r.images, ARRAY[]::text[])) AS img ON true
      WHERE img IS NOT NULL
    ) r
    GROUP BY r.canonical_id
  )
  SELECT
    r.id,
    r.canonical_id,
    (r.id = r.canonical_id)                          AS is_canonical,
    r.dgrade,
    gi.merged_images
  FROM ranked r
  LEFT JOIN group_images gi ON gi.canonical_id = r.canonical_id;

  -- 4b) Mettre à jour les lignes CANONIQUES.
  UPDATE public.products p
  SET grade   = c.dgrade,
      images  = c.merged_images,
      source  = 'manual',
      stock   = 0
  FROM _consolidation c
  WHERE p.id = c.id
    AND c.is_canonical = true;

  -- 4c) Désactiver les AUTRES lignes du groupe (jamais DELETE).
  UPDATE public.products p
  SET is_active = false
  FROM _consolidation c
  WHERE p.id = c.id
    AND c.is_canonical = false;

  -- ---------------------------------------------------------------------
  -- 5) Seed du prix sur TOUTES les lignes couleur du groupe (dénormalisation).
  --    Écrit le MIN pré-migration sur chaque canonique active du
  --    (model, storage normalisé, grade A/B/C). compare_at_price conservé.
  -- ---------------------------------------------------------------------
  UPDATE public.products p
  SET price = s.seed_price
  FROM _seed_prices s
  WHERE p.category = 'telephones'
    AND p.is_active = true
    AND p.grade IN ('A','B','C')
    AND p.model IS NOT DISTINCT FROM s.model
    AND p.storage_capacity IS NOT DISTINCT FROM s.storage_capacity
    AND p.grade IS NOT DISTINCT FROM s.dgrade
    AND p.price IS DISTINCT FROM s.seed_price;

  -- ---------------------------------------------------------------------
  -- 6) Convertir toutes les lignes restantes source='fluxitron' -> 'manual'.
  -- ---------------------------------------------------------------------
  UPDATE public.products
  SET source = 'manual'
  WHERE source = 'fluxitron';

  -- ---------------------------------------------------------------------
  -- 7) Nettoyage des helpers éphémères.
  -- ---------------------------------------------------------------------
  DROP FUNCTION IF EXISTS public.fn_normalize_storage_telephones(text);
  DROP FUNCTION IF EXISTS public.fn_display_grade_telephones(text);

  COMMIT;
  ```

- [ ] **Step 2 : Appliquer la migration** via le MCP Supabase `apply_migration`, projet `klungktcrjlwxqfbbbec`, name = `019_catalogue_magasin`, query = le contenu intégral ci-dessus. Attendu : succès sans erreur.

- [ ] **Step 3 : Vérif (a) — plus aucune ligne `source='fluxitron'`** (MCP `execute_sql`) :
  ```sql
  SELECT count(*) AS fluxitron_rows FROM products WHERE source='fluxitron';
  ```
  Attendu : `[{"fluxitron_rows":0}]`.

- [ ] **Step 4 : Vérif (b) — lignes actives = tuples distincts `(model, storage, A/B/C, color)`** :
  ```sql
  SELECT
    (SELECT count(*) FROM products
       WHERE category='telephones' AND is_active=true) AS active_rows,
    (SELECT count(*) FROM (
       SELECT DISTINCT model, storage_capacity, grade, color
       FROM products
       WHERE category='telephones' AND is_active=true AND grade IN ('A','B','C')
     ) d) AS distinct_tuples;
  ```
  Attendu : `active_rows = distinct_tuples` (≈ 2 900) → exactement une ligne active par tuple.

- [ ] **Step 5 : Vérif (c) — prix unique par `(model, storage, grade)` sur toutes les couleurs** :
  ```sql
  SELECT count(*) AS groups_with_price_spread
  FROM (
    SELECT model, storage_capacity, grade, max(price) - min(price) AS spread
    FROM products
    WHERE category='telephones' AND is_active=true AND grade IN ('A','B','C')
    GROUP BY model, storage_capacity, grade
  ) g
  WHERE g.spread <> 0;
  ```
  Attendu : `[{"groups_with_price_spread":0}]`.

- [ ] **Step 6 : Vérif (d) — aucune ligne active D/E ni grade hors A/B/C** :
  ```sql
  SELECT
    (SELECT count(*) FROM products
       WHERE category='telephones' AND is_active=true AND grade IN ('D','E')) AS active_de,
    (SELECT count(*) FROM products
       WHERE category='telephones' AND is_active=true
         AND (grade IS NULL OR grade NOT IN ('A','B','C'))) AS active_non_abc;
  ```
  Attendu : `[{"active_de":0,"active_non_abc":0}]`.

- [ ] **Step 7 : Vérif idempotence** — réappliquer le même SQL puis ré-exécuter Steps 3–6. Attendu : résultats identiques.

- [ ] **Step 8 : Type-check du repo** (inchangé par cette tâche SQL mais exigé par le cycle).
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && npx tsc --noEmit --skipLibCheck
  ```
  Attendu : aucune erreur.

- [ ] **Step 9 : Commit.**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && git add supabase/migrations/019_catalogue_magasin.sql && git commit -m "$(cat <<'EOF'
feat(catalogue): migration consolidation magasin + prix manuels (019)

Migration idempotente non destructive scopée telephones :
normalisation stockage Go/To, exclusion D/E/NULL, consolidation
(model,storage,grade A/B/C,color) sur une ligne canonique (images
union, source=manual, stock=0), seed prix MIN par (model,storage,grade)
sur toutes les couleurs, conversion fluxitron->manual.

AVERTISSEMENT : met stock=0 partout, site inachetable jusqu'a saisie
du stock dans /admin/prix (decision D7).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
  ```

---

## WS6 — Images (vérification seulement)

### Task F : Images — vérification seulement (aucune modification)

**WS6 ne modifie AUCUN fichier.** Per spec §8/§11.4/§12, le système d'images curatées est conservé tel quel. Cette tâche prouve, après la migration Task E, que chaque swatch couleur affiche la bonne photo curatée (ou un placeholder), jamais une couleur fausse.

**Files:**
- Modify: *aucun*. `src/lib/modelImages.ts`, `src/lib/productImage.ts`, `src/app/products/[id]/ProductDetailClient.tsx` restent **inchangés**.

**Interfaces:**
- Consumes : invariant migration Task E (spec §5.3.b) — sur la ligne canonique de chaque groupe `(model, storage normalisé, displayGrade, color)`, `images` = **union dédupliquée** des images ; il reste **une ligne active par couleur** ; le champ `color` **n'est pas renommé**. Fonctions consommées (non modifiées) : `resolveProductImage(product, selectedColor, { strict: true })`, `modelImageKey(brand, model, color?)`.
- Produces : *none*.

> **Pourquoi aucun changement de code n'est nécessaire** :
> - La fiche résout l'image **uniquement** par `(brand, model, color)` en mode strict (`heroImage` `ProductDetailClient.tsx:149`, `colorImage(c)` `:180` via `siblings.find((s) => (s.color||'').trim() === c)`).
> - En mode strict, `resolveProductImage` ne renvoie QUE `curatedColorImage(brand, model, color)` (couleur exacte puis `COLOR_ALIASES`), sinon `phonePlaceholder(...)`. **Le nombre de lignes n'intervient jamais.**
> - Après Task E il reste **exactement une** ligne active par couleur → `siblings.find` non ambigu ; `representativeImage = firstImage(s.images)` sur l'union → toujours peuplé.
> - **Seul risque réel (côté Task E, pas F)** : si la clé de groupe de la migration ne contenait PAS `color`, les swatches perdraient leur photo. Le Step 3 le détecte.

- [ ] **Step 1 : Vérifier qu'aucun fichier image n'a été modifié.**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && git status --porcelain src/lib/modelImages.ts src/lib/productImage.ts
  ```
  Attendu : **sortie vide**.

- [ ] **Step 2 : Type-check.**
  ```bash
  cd "/Users/fantin/Documents/CODE/Site WEB/TEL and CASH" && npx tsc --noEmit --skipLibCheck
  ```
  Attendu : aucune erreur (exit 0).

- [ ] **Step 3 : (SQL) confirmer une ligne active PAR couleur après migration** (MCP `execute_sql`) :
  ```sql
  SELECT storage_capacity, grade, color, count(*) AS lignes_actives
  FROM products
  WHERE category = 'telephones'
    AND brand = 'Apple' AND model = 'iPhone 13'
    AND is_active = true
  GROUP BY storage_capacity, grade, color
  ORDER BY storage_capacity, grade, color;
  ```
  Attendu : `lignes_actives = 1` sur **chaque** ligne, et **plusieurs `color` distinctes** par `(storage, grade)`. Si une seule couleur par `(storage, grade)` → **alerte : Task E a fusionné les couleurs** → corriger la clé de groupe de la migration.

- [ ] **Step 4 : (manuel) fiche iPhone multi-couleur AVEC photos curatées.** `npm run dev`, ouvrir un iPhone 13. Cliquer chaque swatch : la **hero** change pour le packshot de CETTE couleur ; le **prix ne change pas** ; aucune photo d'une autre couleur. Croiser avec `MODEL_IMAGES` (ex. `apple|iphone 13|green` → `/images/apple-iphone-13-green.png`, fichier présent sous `public/images/`).

- [ ] **Step 5 : (manuel) couleur générique → alias Apple.** Sélectionner une couleur « Black »/« Grey » sans entrée exacte → photo de l'alias attendu (ex. `iphone 13` → `midnight`), jamais une autre teinte.

- [ ] **Step 6 : (manuel) modèle SANS entrée curatée → placeholder.** Ouvrir un modèle absent de `MODEL_IMAGES` → **silhouette grise placeholder** avec le nom du modèle, pas d'image cassée.

- [ ] **Step 7 : (manuel) cas S25 Ultra (storage NULL).** Sélecteur de stockage masqué, mais swatches couleur fonctionnels (photo curatée ou placeholder).

- [ ] **Step 8 : conclusion.** WS6 = vérification seulement : **aucun commit** (aucun diff). Si le Step 3 révèle une fusion de couleurs, **remonter** : c'est un défaut de la clé de groupe de Task E.

---

## Récapitulatif d'exécution & cohérence

**Ordre impératif :** Task 0 → A → B → C → D (D1, D2, D3) → E → F.

**Pourquoi cet ordre :**
- **A (couper Fluxitron)** d'abord : plus aucune écriture externe pendant la suite.
- **B (débrancher marges)** : `recomputeAndWritePrices` no-op → plus rien n'écrase un prix manuel.
- **C (prix brut + couleur hors prix)** : front + checkout lisent `products.price` stocké.
- **D (grille `/admin/prix`)** : indispensable AVANT E pour pouvoir resaisir le stock.
- **E (migration)** : dernier pas, met `stock=0` et consolide. ⚠️ site inachetable jusqu'à saisie stock.
- **F (images)** : vérification post-migration.

**Couverture de la spec :** §5→E, §6→B+C, §7→C, §8→F, §9→A, §10→D, §11 (stock 0 / WIP)→Task 0 + E Step 0, §13→vérifs distribuées.

**Cohérence des interfaces (vérifiée) :**
- B rend `recomputeAndWritePrices` no-op mais **garde** le RPC `bulk_update_prices` ; **D appelle le RPC directement** (`db.rpc('bulk_update_prices', …)`), pas la fonction no-op. ✓
- C supprime `computeCoherentPrices`/`coherentSkuPrice` ; aucun autre consommateur que checkout/BestOffers (grep Step 11). ✓
- C retire `type DisplayGrade` de l'**import** de `productVariants.ts` mais ne touche pas les **exports** de `products.ts` (`displayGrade`, `DISPLAY_GRADE_ORDER`, `DisplayGrade`), que **D** importe. ✓
- D importe `normalizeStorage` de `productVariants.ts` (non supprimé par C). ✓
- E (SQL) réplique `displayGrade`/`normalizeStorage` de façon idempotente, cohérente avec la résolution JS de D. ✓
- F dépend de l'invariant « clé de groupe E contient `color` » — garanti par le `PARTITION BY … , a.color` de E §4a. ✓

**Note transitoire :** entre C et E, des données non consolidées peuvent afficher des prix différents par couleur (le code lit le prix brut de chaque ligne). Résolu par E. Exécuter A→F en une même fenêtre de déploiement.
