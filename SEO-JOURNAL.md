# SEO-JOURNAL — TEL & CASH (telandcash.fr)

Journal tenu par la routine quotidienne SEO/GEO. À lire en premier à chaque run, à compléter en dernier.
Zone interdite (jamais touchée) : panier, checkout, webhooks Stripe, `/api/v1/*`, `useCart.ts`, `groupByModel`.

## État des lieux — 2026-10-04 (run 1)
Les 10 correctifs préparés par l'audit Cowork ont été vérifiés dans le code réel : aucun n'était présent sur `main`
(seul `alternateName` existait, avec une seule valeur « TEL & CASH — PC Angers »). Tous appliqués, un commit par point
(les points 2 et 8 partagent un commit sur la fiche produit, car ils modifient le même bloc JSON-LD).

## Chantiers faits
1. `public/llms.txt` + `alternateName` = [« TEL & CASH — PC Angers », « Phone Cash Angers », « PC Angers Phone Cash »]
2. `hasMerchantReturnPolicy` (Store + offres produit) : **14 jours** (délai légal), retour par courrier, frais à la charge du client
3. `/google-shopping.xml` : flux Merchant Center (1 entrée par SKU vendable de `v_catalog_products`)
4. FAQPage JSON-LD sur la home (4 Q/R sur 5, texte identique à `<FAQ />`)
5. `canonical` ajouté sur 8 pages statiques
6. `sameAs` Snapchat
7. `geo` + `hasMap`
8. `priceValidUntil` (aujourd'hui + 30 j) + `shippingDetails` (9,90 €, 5-10 j ouvrés, France)
9. `/accessoires` : 308 permanent, retiré du sitemap
10. FAQ : « délai légal de rétractation de 30 jours » → « délai de rétractation de 30 jours »

## À vérifier par Yanis / le développeur
- **Flux Google Shopping : jamais testé sur les vraies données** (pas d'accès à la base depuis la routine). Ouvrir `/google-shopping.xml`
  après déploiement, vérifier titres/prix/images, puis seulement le brancher dans Merchant Center. Un SKU = une URL (pas de regroupement par modèle).
- **Incohérence de texte à trancher (non modifiée)** : `/engagements` promet « retour 30 jours, gratuit » ; `/retours` dit « frais de retour à votre
  charge » pour la rétractation de 14 jours ; CGV 12.2 présente le 30 jours comme avantage commercial. Le JSON-LD ne déclare que le légal (14 j).
- **Incohérence garantie (non modifiée)** : `Grades.tsx` et `/reconditionnement` indiquent 24 mois pour le grade A mais 12 mois pour B et C,
  alors que le reste du site (metadata, FAQ, engagements) dit « 24 mois » pour tous. Pour cette raison, `warranty` n'a PAS été ajouté au JSON-LD produit
  (il aurait déclaré une durée fausse pour certains grades). À corriger côté contenu, puis ajouter `warranty`.
- Branche : le correctif est poussé sur `claude/festive-franklin-yf4dg3` (branche imposée par la session) et non `claude/tel-cash-YYYY-MM-DD`.
  Cette branche contenait déjà un commit du dépôt (`81700ea`, checkout) non présent sur `main`, inclus dans la PR.

## Chantiers en attente
- ProductGroup + hasVariant (recommandation Google) : restructuration, **ne pas lancer sans validation de Yanis**.
- Axe GEO/contenu (prochains runs) : recherche réelle des requêtes « smartphone reconditionné Angers », concurrents locaux, contenu avec chiffres propres au magasin en tête de page.

## Décisions déjà prises (ne pas rouvrir)
Pas de Review/AggregateRating ; pas de gtin/mpn ; pas de WebSite+SearchAction ; pas d'ItemList sur /products.

## Erreurs commises et corrigées
- (run 1) Tentative d'export d'une constante depuis `layout.tsx` : interdit par Next (exports de layout restreints) — retiré avant commit.

## Techniques apprises
- `npm ci` puis `npx tsc --noEmit` (en ignorant `scripts/` et `tools/`) sert de vérification rapide ; pas de tests configurés.
