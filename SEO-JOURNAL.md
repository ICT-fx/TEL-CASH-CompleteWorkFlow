# SEO-JOURNAL — TEL & CASH (telandcash.fr)

Journal de la routine SEO/GEO quotidienne. À lire en premier à chaque run, à compléter en dernier.
Zone interdite : panier, checkout, webhooks Stripe, /api/v1/*, useCart.ts, groupByModel.

## État des lieux (2026-10-05, run 1)
- Aucun des 10 correctifs préparés par la tâche Cowork n'était présent sur main (vérifié dans le code).
- Le Store JSON-LD (layout.tsx) avait déjà : adresse, horaires, téléphone, sameAs Instagram/TikTok, alternateName (nom unique).

## Chantiers faits — PR du 2026-10-05 (branche claude/tel-cash-2026-10-05), un commit par point
- #10 FAQ : « légal » retiré du délai de rétractation de 30 jours (délai légal réel = 14 j).
- #9 /accessoires : redirect 308 + retrait du sitemap.
- #5 canonical sur 8 pages statiques (chemin relatif résolu via metadataBase).
- #1 public/llms.txt + alternateName ["TEL & CASH — PC Angers", "Phone Cash Angers", "PC Angers Phone Cash"].
- #6 sameAs Snapchat.
- #7 geo + hasMap (coordonnées de la fiche Google, pin 47.4734475 / -0.5495324).
- #2 hasMerchantReturnPolicy (Store + fiches téléphone) et warranty 24 mois (fiches téléphone). Nouveau fichier src/lib/seo-ld.ts.
- #8 priceValidUntil (+1 an au rendu) et shippingDetails (9,90 €, 5–10 jours ouvrés, France) sur l'offre des fiches téléphone.
- #4 FAQPage sur la home (4 Q/R, la question Klarna est volontairement exclue).
- Vérifié : `tsc --noEmit` OK. Lint non configuré dans le repo (ESLint demande une config interactive). Pas de test visuel.

## Chantiers en attente
- #3 flux Google Merchant (src/app/google-shopping.xml/route.ts) : NON appliqué. Jamais testé contre les vraies données Supabase et aucun accès DB depuis cette session. À faire avec un accès (ou par Yanis/le dev) : vérifier images, URLs, prix, grade, puis soumettre à Merchant Center.
- Recommandation stratégique ProductGroup + hasVariant : attend la validation de Yanis (restructuration, pas un ajout).

## Hypothèses à vérifier (pour Yanis)
- Politique de retour dans le JSON-LD : on a codé 14 jours, retour par courrier, frais à la charge du client (c'est ce que dit /retours). Le site affiche aussi « retour 30 jours » ailleurs (home, méta layout, /engagements) alors que /retours distingue 14 j (rétractation) et 30 j (produit défectueux). Incohérence de wording à trancher avec Edouard.
- Le délai de livraison 5–10 jours et 9,90 € sont lus depuis src/lib/shipping.ts ; si NEXT_PUBLIC_SHIPPING_FEE_EUR change, le JSON-LD suit.
- FAQ.tsx et le JSON-LD de page.tsx dupliquent le texte : à garder synchronisés (ou factoriser plus tard).
- Rappel : le JSON-LD aide Google (pack local, compréhension de l'entreprise) mais n'a pas d'effet mesurable prouvé sur les citations IA (étude Ahrefs 2026). Pour le GEO, le levier est le contenu chiffré en tête de page.

## Erreurs commises et corrigées
- Aucune pour l'instant.

## Techniques apprises
- Les pages statiques « use client » portent leurs metadata dans un layout.tsx voisin ; les autres dans page.tsx.
- Le middleware ne bloque pas /llms.txt (seuls /admin et /api/admin sont protégés).

## Axes à explorer aux prochains runs (recherches web à faire, rien fait au run 1)
- Requêtes « smartphone reconditionné Angers » : concurrence locale et ce que citent les moteurs IA.
- Contenu chiffré en tête de page (batterie ≥ 85 %, 60 points de contrôle, délais) sur /reconditionnement et les pages catégories.
