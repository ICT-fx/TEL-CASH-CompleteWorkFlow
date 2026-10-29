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
- Branche : le correctif est poussé sur `seo/run-2026-10-04` (branche imposée par la session) et non `seo/AAAA-MM-JJ`.
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

## Run 2026-10-05 (branche seo/quotidien, créée depuis main)
- [x] P0.1 `sitemap.ts` : lecture de `v_catalog_products` paginée par `.range()` (tranches de 1000), 1 URL/modèle = variante au plus petit id (tri `id` asc), images de fiche ajoutées. Vérifié : `tsc --noEmit` OK. Non testé sur données réelles (pas d'accès DB) → ouvrir `/sitemap.xml` après déploiement.
- [ ] P0.2 à P0.3 : prochains runs (un sujet par commit).

## Run 2026-10-06 (branche seo/quotidien recréée depuis main : PR #6 déjà mergée)
- [x] P0.0 `alternateName` JSON-LD et `llms.txt` : mentions « Phone Cash » retirées. « PC ANGERS » (raison sociale légale : mentions, CGV, confidentialité) et `PICKUP_STORE_NAME` (« TEL & CASH — PC Angers », lib/shipping.ts, zone paiement) laissés tels quels : ce n'est pas la marque Phone Cash — à confirmer avec Édouard.
- [x] P0.1 déjà fait le 05/10 (PR #6, mergée).
- [x] P0.2 titles « Angers » : home, /products, /qui-sommes-nous, /contact, fiches (modèles + accessoires). Descriptions existantes conservées (elles citent « retour 30 jours » : en attente d'arbitrage).
- [x] P0.3 `llms.txt` : URLs https://www.telandcash.fr, retrait gratuit, rachat/réparation, Android. Page Angers à ajouter quand elle existera (P1.7). `BASE_URL` du code reste `https://telandcash.fr` (env `NEXT_PUBLIC_APP_URL`) : vérifier que la variable Vercel vaut bien l'URL canonique.
- [ ] P1.4 à P1.7 : prochains runs.

## Run 2026-10-07 (branche seo/quotidien, PR #7 ouverte)
- [x] P1.4 JSON-LD : Store → `MobilePhoneStore` + `@id` `BASE_URL/#store`, `email` infos@telandcash.fr (adresse affichée sur tout le site), `image` = /boutique.jpg + logo ; `seller` des fiches = `{ '@id': BASE_URL/#store }` ; `sku` + `BreadcrumbList` (Accueil > Accessoires > fiche) sur les fiches accessoires. `tsc --noEmit` OK.
- [ ] P1.5 à P1.8 : prochains runs.

## Run 2026-10-08 (branche seo/quotidien, PR #7)
- [x] P1 ajouté : garantie alignée à 24 mois pour A/B/C (`Grades.tsx`, `/reconditionnement` + son layout) ; retours 30 jours en ligne (`merchantReturnDays` 14 → 30 dans layout.tsx et fiches produit, `/retours`, `llms.txt`). `tsc --noEmit` OK.
- Écart à signaler : CGV art. 12 (et 12.2) parlent encore de rétractation 14 jours / « 30 jours » conditionnel — non modifiées (document juridique). `/retours` : la ligne « frais de retour à votre charge sauf accord » est conservée (qui paie le renvoi = non confirmé) ; `returnFees` du JSON-LD idem. Le formulaire `account/orders/[id]/return` (zone compte) cite aussi 14 j / 30 j : non touché.
- [ ] P1.5 (OG), P1.6 (noindex), P1.7 (page Angers) : prochains runs.

## Run 2026-10-11 (branche claude/tel-cash-seo recréée depuis main ; PR #7 déjà fermée/intégrée)
- [x] P1.6 `robots: { index: false, follow: false }` via layouts serveur sur `/auth`, `/account`, `/desinscription` (cart/checkout non touchés). Note : `/auth` et `/account` sont aussi en `Disallow` dans robots.ts ; le noindex complète pour les URLs connues par des liens externes.
- [x] P1.5 OG : `src/lib/seoOg.ts` (`pageSocial`) — image par défaut `/boutique.jpg`, og:url/og:title/description + twitter sur /products, /engagements, /contact, /qui-sommes-nous, /reconditionnement, /accessoires ; image ajoutée au layout racine (Next ne fusionne pas openGraph entre layout et page). `tsc --noEmit` OK.
- [ ] P1.7 (page /iphone-reconditionne-angers), P1.8 (liens modèles côté serveur) : prochains runs.

## Run 2026-10-12 (branche claude/tel-cash-seo, PR #9)
- [x] P1.7 page `/iphone-reconditionne-angers` : réponse directe en tête, infos boutique (constantes `lib/shipping.ts`), tableau boutique vs en ligne, grades/batterie (`lib/grades.ts`), FAQ 6 Q/R + FAQPage/BreadcrumbList/WebPage JSON-LD, liens /products /reconditionnement /engagements /contact. Lien footer (Services), sitemap, llms.txt. `tsc --noEmit` OK ; `next build` local impossible (clé Stripe absente, route admin refund), Vercel fait foi.
- Points : batterie grade A (95 %) est marquée « provisoire » dans `lib/grades.ts` ; accès tram/parking non ajouté (non vérifiable) ; qui paie le renvoi non mentionné.
- [ ] P1.8 (liens modèles côté serveur), P1.9 (IndexNow) : prochains runs.

## Run 2026-10-13 (branche claude/tel-cash-seo recréée depuis main ; PR #9 mergée)
- [x] P1.8 `/products` : liste serveur « Tous nos modèles » (1 lien par modèle, `src/lib/catalogModelLinks.ts`, mêmes règles que le sitemap : v_catalog_products paginée, iPhone < 11 exclus, variante au plus petit id, `prefetch={false}`), revalidée 1 h. Lien Categories `/accessoires` → `/products?category=accessoires` (Footer déjà ok). `tsc --noEmit` OK. Non testé sur données réelles : ouvrir /products après déploiement, vérifier la liste en bas de page.
- [ ] P1.9 (IndexNow), P1.10 (jetons vérification) : prochains runs.

## Run 2026-10-14 (branche claude/tel-cash-seo recréée depuis main ; PR #10 mergée)
- [x] P1.9 IndexNow : clé `d2e84bc7adb9e80b68bdb84ee5cfecd2` (fichier `public/d2e84bc7adb9e80b68bdb84ee5cfecd2.txt`, clé publique par conception), route `/api/cron/indexnow` (auth CRON_SECRET ou admin, comme les autres crons) qui envoie pages statiques + un lien par modèle à api.indexnow.org, planifiée chaque jour 06:30 UTC dans `vercel.json`. `tsc --noEmit` OK. Non testé en live (réseau/DB) : après déploiement, ouvrir `/<clé>.txt` et lancer la route une fois.
- [ ] P1.10 (jetons Search Console/Bing) : en attente des jetons de Yanis. Prochain : P2.11 (contenu GEO).

## Run 2026-10-15 (branche claude/tel-cash-seo recréée depuis main ; PR #11 mergée)
- Constat : main (commit Yanis 5b34d4c du 14/10) a ramené les retours à **14 jours** partout (rétractation légale) et retiré le 30 jours des CGV. Le « 30 jours » du brief du 07/10 est donc supplanté ; le journal du 08/10 est obsolète sur ce point. Je n'y touche pas.
- [x] P2.11 (1/4) nouvelle page `/reconditionne-ou-occasion` : réponse directe en tête, tableau occasion vs reconditionné, grades (`lib/grades.ts`), FAQ 5 Q/R + FAQPage/BreadcrumbList/WebPage JSON-LD, date de mise à jour. Lien footer, sitemap, IndexNow, llms.txt. Faits tirés uniquement de /reconditionnement, lib/grades.ts et du décret cité dans le code. La colonne « Occasion (en général) » est une généralité, pas un chiffre. `tsc --noEmit` OK.
- [ ] P2.11 restant : guide « quel iPhone choisir en 2026 » (besoin des durées de mises à jour iOS : non vérifiable ici), « boutique ou en ligne » (déjà couvert par le tableau de la page Angers), /reconditionnement enrichie. P1.10 : toujours en attente des jetons.

## Run 2026-10-16 (branche claude/tel-cash-seo recréée depuis main ; PR #12 mergée)
- [x] P2.12 (1/3) H1 non animés au premier affichage : `initial={false}` sur le `motion.h1` de `/qui-sommes-nous` et `/reconditionnement` (le H1 est visible dès le rendu serveur, plus de opacity 0 initial). Le H1 de la home n'est pas animé. next/image et prefetch des cartes : prochains runs (cartes catalogue = zone proche du panier, à regarder avec soin).
- [ ] P1.10 toujours en attente des jetons ; P2.11 restant : guide « quel iPhone choisir en 2026 » (durées iOS non vérifiables).

## Run 2026-10-17 (branche claude/tel-cash-seo recréée depuis main ; PR #13 mergée)
- Constat P2.12 : images du Hero déjà optimisées (`fetchPriority="high"` sur les images LCP, `loading="lazy"` sur le reste) ; les `<img>` du catalogue/panier sont en zone sensible, et un passage à `next/image` demande une config de domaines distants impossible à valider sans build local (node_modules absent). Rien patché.
- Rien d'autre d'actionnable sans donnée externe : P1.10 attend les jetons Search Console/Bing de Yanis ; guide « quel iPhone choisir » attend des durées iOS vérifiables.

## Run 2026-10-24 (branche claude/tel-cash-seo recréée depuis main ; PR #14 mergée)
- [x] OUTILLAGE : sous-skills MIT de AgriciDaniel/claude-seo copiés dans `.claude/skills/` (seo-local, seo-schema, seo-geo, seo-technical, seo-ecommerce). Relus avant copie : uniquement du Markdown de consignes SEO, aucun script. Aucun code du site touché.
- Backlog P0 à P2 : tout est fait sauf P1.10 (jetons Search Console/Bing de Yanis) et le guide « quel iPhone choisir » (durées iOS non vérifiables).

## Run 2026-10-26 (branche claude/tel-cash-seo recréée depuis main ; PR #15 mergée)
- Rien d'actionnable : backlog P0 à P2 terminé. En attente : P1.10 (jetons Search Console/Bing de Yanis) et guide « quel iPhone choisir » (durées iOS non vérifiables). Arbitrages Yanis/Édouard toujours ouverts : qui paie le renvoi, avis Google affichés comme avis produit, prix barrés, chiffres « 500K / +15 000 clients », pages rachat/réparation (prix), ProductGroup.

## Run 2026-10-28 (branche claude/tel-cash-seo recréée depuis main ; PR #16 mergée)
- Rien d'actionnable : backlog P0 à P2 terminé, aucun changement de code. En attente : P1.10 (jetons Search Console/Bing de Yanis), guide « quel iPhone choisir » (durées iOS non vérifiables). Arbitrages Yanis/Édouard inchangés.

## Run 2026-10-29 (branche claude/tel-cash-seo recréée depuis main ; PR #17 mergée)
- Rien d'actionnable : aucun changement sur main depuis le 28/10, backlog P0 à P2 terminé. En attente : P1.10 (jetons Search Console/Bing de Yanis), guide « quel iPhone choisir » (durées iOS non vérifiables). Arbitrages Yanis/Édouard inchangés.
