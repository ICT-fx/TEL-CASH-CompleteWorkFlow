# Bon de commande fournisseur — Design

Date : 2026-06-08

## Problème

Les clients commandent et paient sur le site, mais rien n'est transmis au
fournisseur (Foxway). L'admin doit aujourd'hui recommander chaque produit à la
main. On veut pouvoir, en une seule action, générer un bon de commande
regroupant tous les produits des commandes encore au statut « payé », et marquer
ces commandes comme transmises au fournisseur.

## Décisions validées

- **Format du bon** : page imprimable (Cmd+P → PDF).
- **Regroupement** : une ligne par `model + storage_capacity + color + grade`,
  avec la quantité totale.
- **Action unique** : le bouton génère le bon ET passe les commandes payées au
  nouveau statut interne.
- **Vue client** : le nouveau statut s'affiche « En préparation » (statut interne
  jamais exposé tel quel).
- **Historique** : chaque bon est enregistré (table dédiée), réimprimable.

## 1. Nouveau statut `supplier_ordered`

Flux : `pending → paid → supplier_ordered → shipped → delivered`
(`cancelled` / `refunded` / `disputed` inchangés).

- Migration : étend le `CHECK` de `orders.status` pour accepter `supplier_ordered`.
- Admin (`StatusBadge.tsx`) : libellé « Commande fournisseur », couleur teal.
  Ajout au rank/timeline de `admin/orders/[id]/page.tsx`, au filtre `active` de
  `api/admin/orders/route.ts`, et nouvel onglet « Commande fournisseur » dans la
  liste.
- Client (`account/orders/page.tsx` + `[id]/page.tsx`) : mappé sur
  « En préparation », même étape visuelle que « Payée ».
- Fluxitron (`mappers.ts`) : `supplier_ordered → financialStatus 'paid'`.

## 2. Table `supplier_orders`

```
supplier_orders
  id            uuid pk        default gen_random_uuid()
  po_number     int            séquentiel lisible (n°1, n°2…)
  lines         jsonb          snapshot [{brand, model, storage, color, grade, qty}]
  order_ids     uuid[]         commandes incluses
  total_units   int
  created_at    timestamptz    default now()
```

Le snapshot `lines` fige ce qui a été commandé, indépendamment des modifications
produits ultérieures.

## 3. Action « Commander chez le fournisseur »

Bouton dans l'en-tête de `admin/orders/page.tsx`, avec le compteur de commandes
`paid` en attente (désactivé si 0).

1. Clic → modale de confirmation : « X commandes payées · Y produits à commander.
   Générer le bon et marquer ces commandes comme Commande fournisseur ? »
2. Confirme → `POST /api/admin/orders/supplier-order` :
   - récupère les commandes `status=paid` + `order_items` + produits ;
   - agrège par `model + storage_capacity + color + grade` → quantité ;
   - crée le `supplier_orders` (snapshot + `order_ids` + `po_number`) ;
   - passe ces commandes en `supplier_ordered` ;
   - renvoie l'`id` du bon.
3. Redirection vers la page imprimable `/admin/orders/supplier-order/[id]`.

Sécurité anti double-commande : on n'enregistre le bon qu'après bascule réussie
des statuts ; si aucune commande `paid`, on renvoie une erreur explicite.

## 4. Page imprimable `/admin/orders/supplier-order/[id]`

`GET /api/admin/orders/supplier-order/[id]` → rend le bon, CSS `@media print`.

```
[logo TEL & CASH]                         BON DE COMMANDE n°12
                                          Date : 08/06/2026
PC ANGERS — EURL au capital de 10 000 €
RCS Angers 985 009 695 · TVA FR48985009695
Enseigne : Tel and Cash
10 rue Saint-Étienne, 49100 Angers
Tél : 0285359532 · contact@telandcash.fr
─────────────────────────────────────────────
Modèle              Stockage  Couleur  Grade  Qté
iPhone 13           128 Go    Noir     A      3
Samsung S22         256 Go    Blanc    B      1
─────────────────────────────────────────────
                          Total unités à commander : 4
```

## 5. Fichiers

Créer :
- `supabase/migrations/011_supplier_orders.sql`
- `src/app/api/admin/orders/supplier-order/route.ts` (POST)
- `src/app/api/admin/orders/supplier-order/[id]/route.ts` (GET)
- `src/app/admin/orders/supplier-order/[id]/page.tsx` (print)

Modifier :
- `src/app/admin/orders/page.tsx` (bouton + modale + onglet)
- `src/components/admin/ui/StatusBadge.tsx`
- `src/app/admin/orders/[id]/page.tsx` (rank / timeline / transitions)
- `src/app/api/admin/orders/route.ts` (filtre `active`)
- `src/app/account/orders/page.tsx` + `[id]/page.tsx`
- `src/app/api/v1/_lib/mappers.ts`

## Constantes société (en-tête du bon)

```
PC ANGERS — EURL au capital social de 10 000 €
RCS Angers : 985 009 695
TVA intracommunautaire : FR48985009695
Enseigne : Tel and Cash
Adresse : 10 rue Saint-Étienne, 49100 Angers
Téléphone : 0285359532
Email : contact@telandcash.fr
```
