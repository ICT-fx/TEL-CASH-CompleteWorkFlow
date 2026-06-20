# Fluxitron — couverture de synchronisation incomplète (variantes sautées)

**Date :** 2026-06-18
**Boutique :** TEL & CASH (connecteur Custom Store, API `/api/v1/`)

## Symptôme

Lors d'une re-synchronisation catalogue + prix depuis le Hub Fluxitron, une partie
des variantes d'un produit multi-variantes **ne reçoit jamais** les mises à jour
(prix/stock). Les lignes concernées conservent des données figées (dernière
modification plusieurs jours avant la sync).

## Cas mesuré

- Produit : **Apple iPhone 12 64 Go** (un produit Fluxitron = 213 variantes
  physiques, une par IMEI ; chez nous = 213 lignes `products` partageant le même
  `fluxitron_group_id = 9b6b7cdb-c4cc-4eed-970f-12543f8db8d3`).
- Sur une re-sync : **194 / 213 variantes mises à jour**, **19 sautées (~9 %)**.
- Les 19 sautées datent toutes de l'import initial (11/06) et n'ont pas bougé,
  alors que leurs sœurs ont été mises à jour le jour de la sync.
- Conséquence concrète : un iPhone 12 64 Go grade A reste à un **coût de 465 €**
  (les autres grade A du même lot sont à 195-235 €) parce que la correction n'a
  jamais été poussée sur cette variante.

Exemples de SKU sautés (préfixe `FLX-` ajouté côté boutique) :
`00103550600013`, `00103550500222`, `00103550500685`, `00103550500777`,
`00103550501190`, `00103550700446`, `00103550600916`, `00103550500023`, …
(19 au total dans ce seul groupe).

## Côté boutique : ce qui est déjà en place

Notre endpoint `GET /api/v1/products/{id}` renvoie **toutes** les variantes du
groupe (tous les membres partageant `fluxitron_group_id`), pas seulement la ligne
demandée — précisément pour que le contrôle de dérive de Fluxitron retrouve
chaque variante enregistrée. Chaque variante expose son **propre `id`** et
`productId` (= l'id de la ligne `products`), ainsi que son `sku`.

Les mises à jour ciblent la ligne par cet `id` :
- `PUT /api/v1/products/{id}/variants/{variantId}` → `update ... where id = variantId`
- `POST /api/v1/prices/batch` → `update ... where id = (variantId | productId)`

Donc dès que Fluxitron pousse une mise à jour avec le bon `variantId`, elle
s'applique. Les 19 lignes sautées **n'ont reçu aucun appel** (leur `updated_at`
n'a pas bougé), ce n'est pas un rejet de notre côté.

## Questions / demande à Fluxitron

1. Sur quel critère le Hub décide-t-il des variantes à pousser lors d'une
   re-sync ? (toutes les variantes retournées par notre GET, ou seulement
   celles présentes dans un registre interne ?)
2. Pourquoi ~9 % des variantes d'un même produit sont-elles systématiquement
   ignorées alors qu'elles figurent dans la réponse GET avec un `id`/`sku`
   distinct ?
3. Y a-t-il une pagination ou une limite côté Hub sur le nombre de variantes
   traitées par produit (213 variantes ici) ?
4. Comment forcer un ré-enregistrement complet des variantes d'un produit pour
   resynchroniser les lignes laissées de côté ?

## Identifiants utiles (pour le support Fluxitron)

- `fluxitron_group_id` du cas : `9b6b7cdb-c4cc-4eed-970f-12543f8db8d3`
- Endpoint GET concerné : `GET /api/v1/products/9b6b7cdb-c4cc-4eed-970f-12543f8db8d3`
- Spec connecteur : `public/openapi.yaml`
