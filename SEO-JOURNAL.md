# SEO-JOURNAL — TEL & CASH (telandcash.fr)

Journal tenu par la routine SEO/GEO quotidienne. À lire en premier, à compléter en dernier à chaque run.

## État des lieux (2026-10-02, run n°1)
- Les 10 correctifs préparés par l'audit Cowork (04/09/2026) n'étaient **présents nulle part** dans `main` : vérifié point par point dans le code.
- Zone interdite (jamais touchée) : panier, checkout, webhooks Stripe, `/api/v1/*`, `useCart.ts`, `groupByModel`.

## Chantiers faits (PR du 2026-10-02, branche `claude/tel-cash-2026-10-02`, 1 commit par point)
1. `public/llms.txt` + `alternateName` du Store = [nom actuel, « Phone Cash Angers », « PC Angers Phone Cash »]
2. `hasMerchantReturnPolicy` (Store : 14 jours, retour par colis, frais de retour à la charge du client) + `warranty` (fiches iPhone : 24 mois)
3. `/google-shopping.xml` (flux Merchant Center) — **non testé sur les vraies données** (pas d'accès base depuis la routine). Voir « À vérifier ».
4. `FAQPage` JSON-LD sur la home (4 Q/R sur 5 ; la Q/R « retour 30 jours » est volontairement écartée, voir hypothèses). Les Q/R sont maintenant dans `src/components/home/faqData.ts` (source unique FAQ visible + schéma).
5. `alternates.canonical` sur 8 pages statiques
6. `sameAs` Snapchat
7. `geo` + `hasMap` (coordonnées reprises de StoreStory/Reviews)
8. `priceValidUntil` (31/12 de l'année en cours) + `shippingDetails` (9,90 €, 5-10 jours ouvrés, FR)
9. `/accessoires` : redirection 308 + retrait du sitemap
10. FAQ : retrait du mot « légal » (30 jours commercial ≠ 14 jours légal)

## Chantiers en attente
- **ProductGroup + hasVariant** (recommandation Google) : attend la validation explicite de Yanis (restructuration, une URL par variante).
- Recherche mots-clés / concurrence « smartphone reconditionné Angers » et opportunités GEO : à lancer au run n°2 (non fait au run n°1, consacré aux 10 points).

## Hypothèses à vérifier / points pour Yanis
- **Garantie incohérente sur le site** : /engagements, FAQ, meta des fiches disent « 24 mois pour tous », mais la section Grades (home) et /reconditionnement affichent 24 mois pour le grade A et **12 mois pour B et C**. Le JSON-LD `warranty` reprend « 24 mois » (aligné sur /engagements et sur les meta des fiches). À trancher côté Edouard, puis aligner le contenu — non modifié (contenu visible).
- **« 30 jours » vs 14 jours** : /retours distingue 14 jours (rétractation légale) et 30 jours (produit défectueux) ; les CGV 12.2 parlent d'un « 30 jours » commercial. Le texte de la FAQ et les meta des fiches parlent de « retour 30 jours » : à clarifier côté Edouard. Le schéma `MerchantReturnPolicy` n'annonce que les 14 jours légaux (prudent).
- **Flux Google Shopping** : vérifier en ouvrant `/google-shopping.xml` en production (≥1 `<item>`, prix, images réelles, liens qui répondent en 200) avant de le brancher dans Merchant Center. Le `g:link` pointe vers la fiche du SKU de la variante.
- Commentaire obsolète dans `src/app/products/[id]/page.tsx` : « les avis affichés sont des exemples (démo) » alors que la décision est « avis réels mais génériques » — sans impact, non touché.
- `priceValidUntil` est calculé au rendu (année courante) : la fiche étant dynamique, la valeur reste valide.

## Erreurs commises et corrigées
- (aucune à ce jour)

## Techniques apprises
- Les pages `qui-sommes-nous`, `engagements`, `reconditionnement`, `contact` sont des client components : leurs metadata sont dans `layout.tsx`. `metadataBase` est défini dans le layout racine, donc un canonical relatif (`/retours`) suffit.
- Un module `'use client'` ne peut pas exporter de données utilisables par un composant serveur → les Q/R FAQ sont dans un fichier neutre `faqData.ts`.
- Le JSON-LD n'a pas d'effet mesurable sur les citations IA (étude Ahrefs 2026) : le levier GEO est le contenu chiffré et original en tête de page.
- `npm ci` + `npx tsc --noEmit` fonctionne dans la routine (pas de tests configurés).
