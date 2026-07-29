# TEL & CASH — Click & Collect (retrait en boutique, PC Angers)

**Date** : 2026-07-29
**Statut** : design approuvé (Approche A) — implémentation en cours sur `feat/click-and-collect`
**Site** : EN PROD — branche locale dédiée, commits locaux, pas de push sans validation.

---

## 1. Problème & objectif

Au checkout, une seule option existe aujourd'hui : livraison à domicile payante (9,90 €), transporteur Chronopost. Le client veut ajouter une deuxième option, gratuite : **retrait en boutique à Angers**, sans toucher au flux domicile existant.

## 2. Décisions cadrées

- **D1 — Nouveau champ, pas de recyclage.** `orders.delivery_method` (`'home' | 'pickup'`), distinct de `orders.shipping_method` (qui reste le champ « transporteur », inchangé, non pertinent en pickup).
- **D2 — Aucun nouveau statut.** Le cycle `paid → shipped → delivered` reste identique en base. Seuls les **libellés affichés** changent si `delivery_method = 'pickup'` : « Prête à retirer » / « Retirée ». `StatusBadge` supporte déjà un prop `label` d'override — pas de nouvelle logique de statut à construire.
- **D3 — Réutilisation du flux d'expédition existant.** L'action admin « Expédier » (`/api/admin/orders/[id]/ship`) sert de déclencheur unique pour « prête à retirer » en pickup : IMEI et photos ne sont plus exigés dans ce cas (contexte différent — remise en main propre avec pièce d'identité, pas d'expédition), mais restent saisissables si l'admin le souhaite.
- **D4 — Boxtal jamais sollicité pour le pickup.** Le bouton de génération de bordereau est masqué côté admin ; `shipping-label/route.ts` reste inchangé (aucune commande pickup n'a d'adresse à transmettre).
- **D5 — Adresse.** En pickup, les champs postaux du formulaire de checkout sont masqués (nom + téléphone conservés). Le serveur force `shipping_address: null` et `shipping_method: null` côté API quelle que soit la valeur envoyée par le client (défense en profondeur, cohérent avec « pas de bordereau généré par erreur »).
- **D6 — Sécurité en bonus.** La faille RLS trouvée à l'audit (policy `profiles` UPDATE sans `WITH CHECK`, permettant en théorie une auto-promotion de rôle via l'API PostgREST directe) est corrigée dans la même migration, indépendamment du reste — ce n'est pas lié au Click & Collect mais l'occasion ne doit pas attendre le chantier 2.

## 3. Migration `038_delivery_method_and_profiles_rls_fix.sql`

```sql
ALTER TABLE public.orders
  ADD COLUMN delivery_method TEXT NOT NULL DEFAULT 'home'
    CHECK (delivery_method IN ('home', 'pickup'));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );
```

`DEFAULT 'home'` rend la migration rétrocompatible avec tous les inserts existants (test-order, bons fournisseur, etc.) sans modification ailleurs. Le `WITH CHECK` ne s'applique qu'au rôle Postgres `authenticated` (RLS) — la clé `service_role` (tout le code admin) le contourne déjà nativement, donc aucune route existante n'est affectée.

## 4. Parcours client (checkout)

`src/app/checkout/page.tsx` : la carte « Mode de livraison » (aujourd'hui statique) devient un vrai choix à deux options : *Livraison à domicile — 9,90 €* / *Retrait en boutique — Angers — Gratuit*. En pickup : champs adresse postale masqués (nom + téléphone gardés et toujours requis), frais = 0 €, total recalculé. En domicile : comportement strictement inchangé (même state, même validation, même payload).

`src/app/api/checkout/route.ts` : nouveau champ `delivery_method` dans le body ; si `pickup`, la ligne Stripe « Livraison » n'est pas ajoutée et `shipping_address`/`shipping_method` sont forcés à `null` avant insert.

## 5. Parcours admin

- Liste et détail commande : badge « Retrait magasin » toujours visible (pas seulement dans la zone méta masquée en mobile).
- Détail commande : bloc « Livraison » remplacé par l'adresse du magasin (Angers) en pickup ; bouton Boxtal absent ; bouton « Expédier » relabellé « Marquer prête à retirer », photos/IMEI optionnels ; bouton « Marquer comme livrée » relabellé « Marquer comme retirée » ; timeline relabellée.
- Liste : filtre simple (client-side, même pattern que la recherche existante) par mode de livraison.

## 6. Emails

- `sendOrderConfirmationEmail` : le paragraphe mentionnant le délai transporteur (5–10 j) est remplacé par l'info retrait si pickup.
- `sendNewOrderMerchantEmail` : la ligne « Livraison » affiche « Retrait magasin (Angers) » si pickup, pour que l'admin le voie immédiatement sans ouvrir la commande.
- Nouvelle fonction `sendPickupReadyEmail` (calquée sur `sendShippedEmail`) : adresse du magasin, horaires, mention pièce d'identité — envoyée depuis `ship/route.ts` quand `delivery_method = 'pickup'` (jamais depuis `shipping-label/route.ts`, qui n'est jamais appelé en pickup).

## 7. Cohérence

- `src/app/api/v1/_lib/mappers.ts` : `delivery_method` relayé vers `FluxitronOrder` (le mapper ne relayait déjà pas `shipping_method` — pas bloquant, mais évite une dérive supplémentaire pendant qu'on est dans ce fichier).
- `src/components/home/Delivery.tsx` : la carte « Click & Collect » annonçait déjà (à tort) un retrait « Paris 11e en 2h » — corrigée en « Retrait gratuit en boutique à Angers », alignée sur la vraie feature.

## 8. Hors périmètre

- Pas de nouveaux statuts de commande.
- Pas de notion de créneau/RDV de retrait.
- Le chantier 2 (comptes directeur/employé) est indépendant et démarre après validation + push de celui-ci.
