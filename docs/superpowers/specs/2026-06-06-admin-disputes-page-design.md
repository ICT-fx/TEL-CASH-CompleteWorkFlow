# Design — Page admin « Litiges » (lecture seule)

**Date** : 2026-06-06
**Statut** : approuvé

## Contexte

L'anti-scam au remboursement est déjà construit et solide :

- **Garde-fous pré-achat** (`src/lib/fraud-guards.ts`) — blocklist email/IP/user/IMEI, plafond 1ère commande compte récent.
- **Workflow retour/remboursement** (`src/app/api/admin/returns/[id]/route.ts`) — RMA : approbation → étiquette → réception → inspection (IMEI/état/reset usine) → remboursement Stripe déclenché **manuellement** par l'admin. Jamais d'auto-remboursement.
- **Dossier de preuves anti-chargeback** (`src/app/api/admin/orders/[id]/ship/route.ts`) — IMEI expédié par article + photos d'expédition obligatoires + tracking, horodaté. Affiché dans le détail commande admin.
- **Détection de litige** — webhook `charge.dispute.created` (`src/app/api/webhooks/stripe/route.ts`) → statut commande `disputed` + insertion dans la table `disputes`.

**Seul écart constaté** : la table `disputes` est **écrite** par le webhook mais **lue nulle part**. Aucune page admin ne liste les litiges ; la contestation se fait à la main dans le dashboard Stripe sans vue centralisée.

## Objectif

Donner à l'admin une vue centralisée, **en lecture seule**, des litiges, reliée au dossier de preuves déjà collecté. La soumission des preuves reste manuelle dans le dashboard Stripe (décision validée : on ne soumet pas via l'API).

Hors périmètre : soumission de preuves via l'API Stripe, scoring de risque, durcissement « jamais reçu ». Ces sujets pourront faire l'objet de specs séparées.

## Composants

### 1. API — `GET /api/admin/disputes`

Nouveau fichier : `src/app/api/admin/disputes/route.ts`.

- Suit le pattern de `src/app/api/admin/returns/route.ts` : `requireAdmin()` + `createAdminClient()`.
- Requête table `disputes`, triée `created_at` desc, jointe à :
  - `order:orders(id, total_amount, status)`
  - le profil client via l'order (email, nom) — résolu en deux temps si la jointure imbriquée n'est pas directe.
- Filtre optionnel `?status=` (cohérent avec returns).
- Renvoie `{ disputes: [...] }`.
- Gère `order_id = null` (litige dont la commande n'a pas été retrouvée par le webhook) sans planter.

### 2. Page — `/admin/disputes`

Nouveau fichier : `src/app/admin/disputes/page.tsx`.

- Tableau **lecture seule**, style aligné sur `src/app/admin/orders/page.tsx`.
- Colonnes : Date · Client · Montant · Raison · Statut · lien → commande.
- `reason` et `status` Stripe traduits en libellés FR via un petit mapping local
  (ex. `fraudulent` → « Frauduleux », `product_not_received` → « Produit non reçu »,
  `needs_response` → « À répondre », `won` → « Gagné », `lost` → « Perdu »).
- Chaque ligne renvoie vers `/admin/orders/[order_id]` (qui affiche déjà le dossier de
  preuves). Si `order_id` est null, ligne affichée sans lien, mention « Commande inconnue ».

### 3. Sidebar

Modifier `src/app/admin/layout.tsx` :

- Ajouter dans `navItems` : `{ href: '/admin/disputes', label: 'Litiges', icon: Gavel, badgeKey: null }`
  (importer `Gavel` depuis `lucide-react`). `badgeKey: null` — pas de compteur (périmètre « affichage »).

### 4. Webhook — rafraîchissement du statut (option (b) retenue)

Modifier `src/app/api/webhooks/stripe/route.ts` :

- Ajouter les cas `charge.dispute.updated` et `charge.dispute.closed` :
  - Retrouver la ligne `disputes` par `stripe_dispute_id`.
  - Mettre à jour `status` avec `dispute.status` (et `updated_at` si la colonne existe).
  - Sur `closed` : si `dispute.status === 'won'`, on peut laisser la commande en l'état ;
    si `lost`, la commande reste `disputed` (pas de changement de statut commande automatique —
    cohérent avec « l'admin décide »). Comportement exact à figer dans le plan.

## Flux de données

1. Stripe émet `charge.dispute.created` → webhook insère la ligne `disputes` + commande `disputed` (existant).
2. Stripe émet `charge.dispute.updated`/`closed` → webhook met à jour `disputes.status` (nouveau, option b).
3. Admin ouvre « Litiges » → `GET /api/admin/disputes` → tableau.
4. Admin clique une ligne → `/admin/orders/[order_id]` → dossier de preuves déjà affiché.
5. Admin soumet les preuves **manuellement** dans le dashboard Stripe.

## Gestion des erreurs

- Accès non-admin : `requireAdmin()` renvoie la réponse 401/403 (pattern existant).
- Litige sans commande liée (`order_id = null`) : affiché sans lien, libellé « Commande inconnue ».
- Échec de la requête Supabase : renvoyer `{ error }` avec code 500 (pattern existant).

## Tests / vérification

- Pas de framework de test configuré dans le repo.
- Vérification manuelle via Stripe CLI : `stripe trigger charge.dispute.created` puis
  `charge.dispute.updated` / `.closed`, et contrôle que la page `/admin/disputes`
  liste le litige et reflète le statut mis à jour.

## Hypothèses à confirmer au moment du plan

- Schéma exact de la table `disputes` (colonnes disponibles, présence d'un `updated_at`).
- Possibilité de jointure imbriquée `disputes → orders → profiles` via PostgREST,
  sinon résolution en deux requêtes.
