# Relance automatique des commandes abandonnées — Design

**Date :** 2026-07-07
**Statut :** validé — plan d'implémentation écrit (`docs/superpowers/plans/2026-07-07-relance-paniers-abandonnes.md`)

## ⚠️ Mise à jour brownfield (découvert après validation)

Une bonne partie du socle **existe déjà et est commitée** (travail préparatoire) :
`orders.abandoned_reminder_sent_at` (**migration 031**), le cron
`/api/cron/abandoned-cart` (cible aujourd'hui `pending` 24 h–7 j, **sans promo**),
la fonction `sendAbandonedCartEmail()` (avec un paramètre `promoCode` **déjà
prévu mais inutilisé**), l'entrée cron `vercel.json`, et une page admin
`/admin/carts`. Corrections apportées au design ci-dessous en conséquence :

- **On étend l'existant, on ne recrée rien.** Noms réels : route
  `/api/cron/abandoned-cart`, fonction `sendAbandonedCartEmail`, colonne
  `orders.abandoned_reminder_sent_at`. (Oublier les noms « winback_* » du texte
  initial : ils sont remplacés par ces noms.)
- **Nouvelle migration = `034`** (031/032/033 déjà pris : abandoned_cart_reminder, page_views, guest_checkout).
- **Ciblage `cancelled` — garde de sécurité :** ne relancer une commande
  `cancelled` que si elle n'a **jamais été payée** (`stripe_payment_intent IS NULL
  AND refunded_at IS NULL`), sinon on relancerait une commande payée puis
  remboursée par l'admin. **Point important :** Stripe fait expirer la session à
  ~24 h → le webhook passe la commande de `pending` à `cancelled`. Le cron
  existant ne visant que `pending`, il **rate la plupart des abandons** ; inclure
  `cancelled` non payé est donc nécessaire pour que la relance touche vraiment
  les clients.
- Le reste des décisions (−5 %, 7 j, 48 h, désinscription RGPD) est inchangé et
  reporté dans le plan.

## Objectif

Relancer automatiquement par email, environ 2 jours après, les clients qui ont
démarré un paiement mais ne l'ont pas terminé. L'email part de l'adresse
professionnelle existante (`infos@telandcash.fr`) et contient un **code promo
personnel de -5 %, valable 7 jours**, pour inciter à finaliser la commande.

## Périmètre (décisions validées)

- **Cible :** uniquement les commandes non payées, `status ∈ { pending, cancelled }`
  (le client a démarré le checkout Stripe mais n'a pas payé). Les paniers jamais
  passés en checkout (`cart_items` sans commande) sont **hors périmètre**.
- **Délai :** ~2 jours après la création de la commande (48 h).
- **Incitation :** code promo **-5 %** (`discount_type = 'percent'`), **unique par
  client**, **usage unique**, **expire au bout de 7 jours**.
- **Envoi :** Vercel Cron quotidien + réutilisation de l'infrastructure email
  existante ([`src/lib/email.ts`](../../../src/lib/email.ts)), expéditeur
  `infos@telandcash.fr`.
- **RGPD :** lien de désinscription + respect d'un opt-out, inclus dès maintenant.

### Hors périmètre (YAGNI)

- Relance des paniers abandonnés sans commande (`cart_items`).
- Relances multiples / séquences (J+2, J+5, J+10) — une seule relance par commande.
- Codes promo réutilisables ou codes magasin globaux.
- Interface admin dédiée (le mode `dryRun` et les logs suffisent au départ).

## Contexte technique (état actuel)

- Les commandes sont créées avec `status = 'pending'` au démarrage du checkout
  ([`src/app/api/checkout/route.ts`](../../../src/app/api/checkout/route.ts)).
  La session Stripe expire (~24 h par défaut) → le webhook passe la commande en
  `cancelled` (`checkout.session.expired`). À J+2, la plupart sont donc `cancelled` ;
  on traite `pending` **et** `cancelled` par sécurité.
- Checkout réservé aux utilisateurs connectés : chaque commande a un `user_id`,
  donc l'email (`profiles.email`) et le nom (`profiles.full_name`) sont toujours
  disponibles.
- Les articles de la commande sont figés dans `order_items` (snapshot
  `product_name`, `product_sku`, `price_at_purchase`).
- Système d'email complet déjà en place ([`src/lib/email.ts`](../../../src/lib/email.ts))
  via Resend/SMTP, expéditeur résolu par `merchantEmail()` → `infos@telandcash.fr`.
- Cron Vercel déjà utilisé ([`src/app/api/cron/supplier-feed/route.ts`](../../../src/app/api/cron/supplier-feed/route.ts),
  `vercel.json`), auth par `CRON_SECRET`. **Note plan Vercel Hobby : 1 exécution
  cron par jour** — suffisant ici.
- `referral_codes` : `discount_value`, `discount_type ('fixed'|'percent')`,
  `max_uses`, `times_used`, `is_active`, `user_id` (NOT NULL). **Pas de colonne
  d'expiration.** La validation (`/api/referral/validate`) et le calcul de remise
  (`/api/checkout`) ne vérifient que `is_active` et `times_used < max_uses`.
- **Manque important :** la page checkout n'envoie jamais de `referral_code` à
  l'API — le champ est accepté côté serveur mais aucune UI ne le transmet.

## Architecture & flux

```
Vercel Cron (1×/jour, 09:00 UTC)  →  GET /api/cron/winback
  1. Sélection des commandes éligibles :
       status ∈ { pending, cancelled }
       AND created_at ENTRE now-14j ET now-48h
       AND winback_email_sent_at IS NULL
  2. Filtres anti-spam / cohérence :
       - 1 seul email par client par exécution (la commande éligible la plus récente)
       - exclure les clients ayant reçu une relance dans les 30 derniers jours
       - exclure les clients ayant une commande PAYÉE postérieure à la commande abandonnée
       - exclure les clients opt-out (profiles.marketing_opt_out = true)
  3. Pour chaque commande retenue :
       a. créer un code promo perso : RETOUR-XXXXX, percent 5, max_uses 1,
          expires_at = now+7j, source='winback', user_id = commande.user_id
       b. envoyer l'email de relance (articles + code + CTA + lien désinscription)
       c. marquer orders.winback_email_sent_at = now()   (verrou anti-doublon)
```

Ordre b→c volontaire : on marque après un envoi réussi. En cas d'échec d'envoi
non bloquant (email non configuré, etc.), voir « Gestion des erreurs ».

## Composants

### 1. Migration SQL (`supabase/migrations/031_winback_relance.sql`)

- **`orders`** : `ADD COLUMN winback_email_sent_at TIMESTAMPTZ` — verrou anti-doublon.
- **`referral_codes`** :
  - `ADD COLUMN expires_at TIMESTAMPTZ` (NULL = jamais expiré, rétrocompatible avec
    les codes de parrainage existants).
  - `ADD COLUMN source TEXT NOT NULL DEFAULT 'referral'` — distingue les codes de
    relance (`'winback'`) des codes de parrainage.
- **`profiles`** :
  - `ADD COLUMN marketing_opt_out BOOLEAN NOT NULL DEFAULT false`.
  - `ADD COLUMN unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid()` — jeton
    non devinable pour le lien de désinscription (pas d'auth requise pour se
    désinscrire).
- Index utile : `orders (status, created_at) WHERE winback_email_sent_at IS NULL`
  (partiel) pour la requête du cron.
- RLS : les nouvelles colonnes `profiles` ne doivent pas être exposées en écriture
  au client ; la désinscription passe par une route serveur (admin client). Vérifier
  qu'aucune policy existante ne casse.

### 2. Route cron `/api/cron/winback/route.ts` (nouveau)

Calquée sur `supplier-feed` :
- Auth : `CRON_SECRET` (Bearer) **ou** session admin.
- `export const maxDuration = 60` (traitement par lots si besoin).
- **`?dryRun=1`** : calcule et logge la liste des commandes/clients qui seraient
  relancés, **sans** créer de code, **sans** envoyer d'email, **sans** écrire
  `winback_email_sent_at`.
- Constantes en tête de fichier : `DELAI_HEURES = 48`, `FENETRE_JOURS = 14`,
  `REMISE_PCT = 5`, `VALIDITE_JOURS = 7`, `COOLDOWN_JOURS = 30`.
- Interrupteur `WINBACK_ENABLED` (env) : si absent/false, la route ne fait rien
  (retourne un statut « désactivé »).
- Utilise `createAdminClient()` (bypass RLS) pour lecture/écriture.
- Traitement séquentiel/borné (cap ex. 200 commandes/exécution, loggé si atteint —
  pas de troncature silencieuse).

### 3. Génération du code promo (dans la route ou un helper)

Insertion directe dans `referral_codes` (on **n'utilise pas** `/api/referral/generate`
qui applique la règle « un seul code par user ») :
```
{ user_id, code: `RETOUR-${rand5}`, discount_value: 5, discount_type: 'percent',
  max_uses: 1, times_used: 0, is_active: true,
  expires_at: now + 7j, source: 'winback' }
```
Unicité du `code` garantie par la contrainte UNIQUE existante (retry si collision).

### 4. Email `sendAbandonedOrderEmail()` (dans `src/lib/email.ts`)

Nouvelle fonction cohérente avec les templates existants, en français :
- **Objet :** « Vous avez oublié quelque chose ? 🛒 » (ajustable).
- **Corps :** salutation nominative, rappel des **articles** de la commande
  (depuis `order_items`), le **code -5 %** en évidence + **date d'expiration**.
- **CTA :** bouton vers `NEXT_PUBLIC_APP_URL/panier?promo=RETOUR-XXXXX`.
- **Pied :** lien de **désinscription**
  `NEXT_PUBLIC_APP_URL/desinscription?token=<unsubscribe_token>`.
- Respecte `isEmailConfigured()` (no-op propre si non configuré, comme l'existant).

### 5. Câblage du code promo au checkout (obligatoire)

Sans cela, le code envoyé serait inutilisable.
- **Page panier/checkout** : lire `?promo=CODE` (query param), le valider via
  `/api/referral/validate`, l'afficher (montant de remise), et l'**inclure dans le
  POST** vers `/api/checkout` (champ `referral_code`). Persister le code du panier
  jusqu'au checkout (store Zustand ou param d'URL propagé).
- **Vérification d'expiration** à ajouter aux **deux** endroits :
  - `/api/referral/validate` : rejeter si `expires_at` dépassé.
  - `/api/checkout/route.ts` : ne pas appliquer la remise si `expires_at` dépassé.

### 6. Désinscription RGPD `/desinscription` + route

- Page/route publique `/desinscription?token=<uuid>` : recherche le profil par
  `unsubscribe_token`, passe `marketing_opt_out = true`, affiche une confirmation
  en français. Idempotent, pas d'auth requise (le jeton fait foi).
- Le cron exclut `marketing_opt_out = true`.

### 7. Configuration

- `vercel.json` : ajout d'une entrée cron `{ "path": "/api/cron/winback",
  "schedule": "0 9 * * *" }`.
- Variables d'env : réutilise `CRON_SECRET`, `RESEND_API_KEY`/`MERCHANT_EMAIL`/
  `RESEND_FROM`, `NEXT_PUBLIC_APP_URL`. Nouvelle : `WINBACK_ENABLED`.

## Gestion des erreurs & idempotence

- **Anti-doublon :** `winback_email_sent_at IS NULL` dans la sélection + marquage
  après envoi ⇒ jamais deux relances pour la même commande.
- **Anti-spam :** 1 email/client/exécution + cooldown 30 j + exclusion des clients
  ayant déjà racheté.
- **Échec d'envoi :** si `sendAbandonedOrderEmail` retourne `{ sent: false }`
  (email non configuré), on **ne marque pas** la commande (elle sera retentée) ;
  si l'envoi jette une erreur réseau ponctuelle, on logge et on continue sans
  marquer, pour retenter au prochain run. Chaque commande est traitée
  indépendamment (une erreur n'interrompt pas le lot).
- **Idempotence code :** collision de `code` (UNIQUE) → regénérer.

## Vérification

Pas de framework de test dans le repo (`npm run lint` cassé — utiliser
`npx tsc --noEmit --skipLibCheck`).

1. `npx tsc --noEmit --skipLibCheck` — pas d'erreur de types.
2. `GET /api/cron/winback?dryRun=1` (auth admin/CRON_SECRET) sur données réelles :
   vérifier la liste des commandes/clients sélectionnés, sans écriture ni envoi.
3. Test manuel du câblage promo : ouvrir `/panier?promo=<code test>` → la remise
   s'affiche → checkout applique bien -5 %.
4. Test désinscription : ouvrir `/desinscription?token=<uuid>` → `marketing_opt_out`
   passe à true → le client n'est plus sélectionné par le dryRun.

## Risques / points d'attention

- **Marge :** -5 % validé comme compromis marge/incitation.
- **RGPD :** email de démarchage → désinscription obligatoire (incluse). Vérifier
  la base légale (intérêt légitime / relance de commande) côté métier.
- **Panier vide au retour :** si le panier serveur a été vidé, le lien `/panier`
  peut être vide ; l'email liste quand même les articles (snapshot `order_items`)
  pour permettre au client de les retrouver.
- **Fenêtre 14 j :** évite de relancer d'anciennes commandes au premier déploiement.
