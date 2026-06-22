# Annulation + remboursement d'une commande par l'admin

**Date** : 2026-06-22
**Statut** : Design validé, prêt pour le plan d'implémentation

## Problème

Quand une commande est payée mais pas encore expédiée, l'admin peut découvrir qu'il
ne trouve pas / ne peut pas sourcer le produit commandé. Il faut alors pouvoir, depuis
l'admin :

1. Annuler la commande dès les premières étapes (statut payé).
2. Écrire un message personnalisé au client expliquant la raison.
3. Déclencher le remboursement Stripe d'un simple bouton.
4. Le client reçoit un mail personnalisé contenant la raison et le montant remboursé.

## Décisions de cadrage (issues du brainstorming)

| Sujet | Décision |
|-------|----------|
| Mail client | Mail **custom via Resend** (déjà en place) contenant le message de l'admin + le montant. Le reçu de remboursement standard de Stripe part en plus, automatiquement. |
| Montant | **Total pré-rempli** (frais de port inclus) mais **ajustable à la baisse** par l'admin (`0,01 ≤ montant ≤ total`). |
| Stock | **Non concerné.** Le stock local ne pilote pas le catalogue magasin → on ne restitue rien, pas de case à cocher. |
| Statuts éligibles | Bouton visible **uniquement** sur `paid` et `supplier_ordered`. Caché dès `shipped`/`delivered` (là c'est un retour, pas une annulation). |
| Statut final | `cancelled` (cohérent avec « annuler la commande » et déjà présent dans le menu admin). |

## Hors périmètre (YAGNI)

- Restitution / ajustement de stock.
- Remboursement partiel par article (l'action annule **toute** la commande ; le montant
  ajustable ne contrôle que l'argent rendu, pas une fulfillment partielle).
- Annulation après expédition (relève du flux retour existant `return_requests`).
- Workflow de validation à plusieurs niveaux.

## Architecture

Approche retenue : **endpoint dédié + modale**. Toute la logique sensible (remboursement
Stripe → maj commande → mail → webhook) est faite côté serveur, de façon atomique et
idempotente, dans une route dédiée. La modale n'envoie que `{ reason, amount }`.

Approches écartées :
- *Étendre le `PUT /api/admin/orders/[id]` générique* : charge une route générique
  d'effets de bord sensibles (Stripe, mail) déclenchables par mégarde. Risqué.
- *Rembourser dans le dashboard Stripe, l'app n'enregistre que via webhook* : ne répond
  pas à « un bouton pour rembourser » et découple le mail personnalisé.

## Composants

### 1. UI — modale dans la page détail commande

Fichier : `src/app/admin/orders/[id]/page.tsx`

- Bouton **« Annuler + rembourser »** (style danger / ghost rouge) dans la barre
  d'actions du header (à côté de « Expédier »), visible **seulement** si
  `order.status === 'paid' || order.status === 'supplier_ordered'`.
- Ouvre `RefundModal` (même patron que `ShipModal` déjà présent en fin de fichier) :
  - **Message au client** — `textarea` **obligatoire** (la raison). Placeholder type :
    « Bonjour, nous sommes désolés mais le produit commandé n'est finalement plus
    disponible… ». Le bouton de confirmation est désactivé tant que le champ est vide.
  - **Montant à rembourser** — input numérique pré-rempli avec `total_amount` (frais de
    port inclus), éditable, borné `0,01 ≤ x ≤ total`. Validation côté client + serveur.
  - Avertissement : « Action irréversible — le remboursement Stripe part immédiatement ».
  - Bouton **« Confirmer le remboursement de X € »**.
  - Pendant l'appel : état `loading`. Succès → toast + `load()` (la commande repasse en
    `cancelled`, le bouton disparaît). Erreur → toast d'erreur, modale conservée.

### 2. API — `POST /api/admin/orders/[id]/refund`

Nouveau fichier : `src/app/api/admin/orders/[id]/refund/route.ts`

- Auth : `requireAdmin()`.
- Corps : `{ reason: string (requis, non vide après trim), amount?: number }`.
- Chargement de la commande (admin client). Gardes-fous, sinon `400`/`409` avec message FR :
  - `status ∈ {paid, supplier_ordered}` — sinon « Cette commande ne peut plus être
    annulée à ce stade ».
  - `stripe_payment_intent` présent — sinon « Paiement non capturé, remboursement
    impossible ».
  - Pas déjà remboursée : `refunded_at` et `stripe_refund_id` vides — sinon « Commande
    déjà remboursée » (idempotence).
  - Montant : défaut = `total_amount` ; valider `0 < amount ≤ total_amount` ; convertir en
    centimes via `Math.round(amount * 100)`.
- `stripe.refunds.create({ payment_intent, amount: cents, reason: 'requested_by_customer',
  metadata: { order_id, admin_id } })`.
  - Si Stripe échoue (ex. charge déjà remboursée, fonds insuffisants) : **ne pas** muter
    la commande, renvoyer `502` + message clair.
- Maj commande (après succès Stripe) :
  - `status = 'cancelled'`
  - `stripe_refund_id = refund.id`
  - `refund_amount = amount`
  - `refunded_at = now()`
  - `notes` : on **ajoute** (sans écraser) une ligne horodatée
    « [<date>] Annulée + remboursée (<montant> €) — <raison> ».
- Mail client : `sendOrderCancelledEmail(...)` (best-effort — voir §3).
- Webhook Fluxitron : `sendFluxitronWebhook('orders/cancel', ...)` (fire-and-forget,
  non bloquant, comme l'existant).
- Réponse : `{ ok: true, refundId, status: 'cancelled', emailSent: boolean }`.

### 3. Mail client — `sendOrderCancelledEmail()`

Fichier : `src/lib/email.ts` (nouvelle fonction exportée, même style que les existantes)

- Signature : `{ to, customerName?, orderNumber, reason, refundAmount }`.
- Objet : « Votre commande <orderNumber> a été annulée et remboursée ».
- Corps HTML aux couleurs TEL & CASH (header sombre + carte) :
  - Excuse + le **message de l'admin** (`reason`), **échappé HTML** pour éviter toute
    injection (la raison est saisie librement). Helper d'échappement local.
  - Bloc « Montant remboursé : X € ».
  - « Le remboursement apparaîtra sur votre moyen de paiement sous 5–10 jours. Stripe
    vous envoie également un reçu de remboursement. »
  - Ligne de contact habituelle.
- Best-effort : réutilise `sendEmail()` ; si `RESEND_API_KEY` absente ou échec HTTP,
  renvoie `{ sent: false, reason }` sans faire échouer le remboursement (déjà effectué).

### 4. Cohérence du webhook `charge.refunded`

Fichier : `src/app/api/webhooks/stripe/route.ts` (~ligne 383)

Quand notre endpoint crée le remboursement, Stripe émet ensuite `charge.refunded`. Le
handler actuel force `status='refunded'` sans condition, ce qui écraserait notre
`cancelled`. Modification : ne passer à `refunded` **que si** le statut courant n'est ni
`cancelled` ni `refunded`.

```ts
// avant : update({ status: 'refunded' })
if (order.status !== 'cancelled' && order.status !== 'refunded') {
  await supabase.from('orders').update({ status: 'refunded' }).eq('id', order.id);
}
```

Conséquence : une annulation admin reste `cancelled` ; un remboursement initié depuis le
dashboard Stripe (sans passer par l'app) continue de basculer la commande en `refunded`.
Les champs `refund_amount/refunded_at/stripe_refund_id` tracent l'argent indépendamment
du statut.

### 5. Données

Aucune migration. Les colonnes `refunded_at`, `refund_amount`, `stripe_refund_id` et
`notes` existent déjà (migration `009_returns_and_fraud.sql`).

## Gestion d'erreurs (récap)

| Cas | Comportement |
|-----|--------------|
| Statut non éligible | `409`, message FR, aucune action. |
| Pas de `stripe_payment_intent` | `400`, message FR. |
| Déjà remboursée | `409` « déjà remboursée » (idempotence anti double-clic). |
| `amount` hors bornes | `400`, message FR. |
| Échec création refund Stripe | `502`, commande **non** mutée, message FR. |
| Échec mail Resend | Remboursement conservé ; `emailSent:false` renvoyé ; log serveur. |
| Échec webhook Fluxitron | Ignoré (fire-and-forget). |

## Vérification (pas de tests automatisés dans ce repo)

1. Stripe en **mode test** : créer une commande payée (route test-order existante),
   ouvrir le détail, cliquer « Annuler + rembourser », saisir une raison + un montant.
2. Vérifier : remboursement visible dans le dashboard Stripe ; `status = cancelled` ;
   `refund_amount` / `refunded_at` / `stripe_refund_id` remplis ; note horodatée ajoutée.
3. Vérifier la réception du **mail Resend** personnalisé (raison + montant).
4. Vérifier que l'arrivée de `charge.refunded` **ne re-bascule pas** la commande en
   `refunded` (reste `cancelled`).
5. Tester un montant ajusté (< total) et un montant invalide (> total → refusé).
6. Typecheck : `npx tsc --noEmit --skipLibCheck` (le lint du repo est cassé).

## Fichiers touchés

- `src/app/admin/orders/[id]/page.tsx` — bouton + `RefundModal` + état + handler.
- `src/app/api/admin/orders/[id]/refund/route.ts` — **nouveau** endpoint.
- `src/lib/email.ts` — **nouvelle** fonction `sendOrderCancelledEmail` + helper d'échappement.
- `src/app/api/webhooks/stripe/route.ts` — garde sur `charge.refunded`.
