# TEL & CASH — Refonte visuelle du back-office, étape 1 : Dashboard

**Date** : 2026-08-21
**Statut** : design approuvé (direction « Vitrine », 1c) — implémentation à venir
**Origine** : maquettes produites par Claude Design (`design-handoffs/backoffice-dashboard/`, non versionné), arbitrées par le client entre 3 directions.

---

## 1. Périmètre

Refonte **visuelle uniquement** du back-office admin. Aucune fonctionnalité, aucune route API, aucun contrat de données ne change. Ce qui change : la palette, la sémantique des couleurs de statut, la hiérarchie visuelle du dashboard, et la lisibilité du graphique de ventes.

**Contrainte explicite du client : ne pas toucher au backend.** Vérifié : toutes les données nécessaires (y compris pour distinguer les deux cas d'annulation, cf. §3) sont déjà renvoyées par `GET /api/admin/stats` (`select('*')` sur `orders`) — la distinction se fait entièrement côté client, à partir des champs déjà présents (`refund_amount`, `refunded_at`, `stripe_refund_id`).

**Étape 1 (ce document)** : Dashboard (`/admin`, `src/app/admin/page.tsx`) + les primitives partagées qu'il utilise (`StatusBadge`, `StatTile`, `Avatar`, `MiniBarChart`, sidebar `admin/layout.tsx`).

**Étape 2 (hors périmètre de ce doc, à mockup­per ensuite)** : Liste des commandes (`src/app/admin/orders/page.tsx`) et fiche détail (`src/app/admin/orders/[id]/page.tsx`), qui réutiliseront le même système de couleurs (§3) mais n'ont pas encore de maquette Claude Design. Décisions déjà actées pour cette étape 2, à respecter quand elle sera maquettée :
- Onglets de filtre séparés « Annulées (jamais payées) » et « Annulées + remboursées ».
- Filtre secondaire domicile / retrait boutique.
- Timeline de la fiche adaptée au retrait boutique (« Prête à retirer » / « Retirée »).
- Bloc de vérification du code de retrait visuellement détaché du reste de la page.

---

## 2. Le socle : palette et sémantique des statuts (non négociable, s'applique partout)

Remplace `src/components/admin/ui/StatusBadge.tsx`, qui utilise aujourd'hui sept teintes sans règle de correspondance.

### Règle

Une teinte = un sens. L'intensité = l'urgence.

| Couleur | Hex | Sens | Usage |
| --- | --- | --- | --- |
| Bleu | `#2F6BFF` | En cours / à faire | Payée, cmd. fournisseur, expédiée, prête à retirer, actions primaires, liens |
| Vert | `#12693F` | Terminé, positif | Livrée, retirée, variation de CA positive, taux de conversion |
| Gris | `#9A9A90` | Neutre, sans suite | Panier ouvert, paiement non finalisé, paiement échoué, retour traité |
| Rouge | `#B02A1E` | Vrai problème, argent sorti | Litige, annulée & remboursée |
| Ambre | `#B0781A` | **Stock uniquement** | Stock faible, rupture |

Aucune autre couleur ne porte de sens. Les **avatars clients deviennent monochromes** (`background #EFEFEC` / `color #6B6B63`) — la palette de 8 couleurs aléatoires de `Avatar.tsx` (fonction `paletteIndex`) est supprimée : c'était une source majeure de bruit visuel sans information réelle.

### Deux niveaux d'intensité

- **Plein** (`background` = couleur, texte blanc, `font-weight 600`, pas de point) : réservé à un seul cas, `paid` → « Payée · à traiter ». C'est la seule chose qui demande une action immédiate.
- **Teinté** (fond clair, texte foncé, `font-weight 500`, point de 5px de la couleur foncée) : tous les autres statuts.

### Table de remappage (source de vérité pour l'implémentation)

| clé DB | Libellé actuel | **Nouveau libellé** | bg | fg | point |
| --- | --- | --- | --- | --- | --- |
| `pending` | En attente | **Panier ouvert** | `#F0F0ED` | `#6B6B63` | `#9A9A90` |
| `awaiting_payment` | Paiement différé | **Paiement en attente** | `#F0F0ED` | `#6B6B63` | `#9A9A90` |
| `paid` | Payée | **Payée · à traiter** | `#2F6BFF` | `#FFFFFF` | aucun (plein) |
| `supplier_ordered` | Commande fournisseur | **Cmd. fournisseur** | `#E7EEFF` | `#1B4ACB` | `#2F6BFF` |
| `shipped` (non pickup) | Expédiée | **Expédiée** | `#E7EEFF` | `#1B4ACB` | `#2F6BFF` |
| `shipped` (pickup) | — | **Prête à retirer** | `#E7EEFF` | `#1B4ACB` | `#2F6BFF` |
| `delivered` (non pickup) | Livrée | **Livrée** | `#E3F3E9` | `#12693F` | `#12693F` |
| `delivered` (pickup) | Livrée | **Retirée** | `#E3F3E9` | `#12693F` | `#12693F` |
| `refunded` | Retour | **Retour traité** | `#F0F0ED` | `#6B6B63` | `#9A9A90` |
| `failed` | Échouée | **Paiement échoué** | `#F0F0ED` | `#6B6B63` | `#9A9A90` |
| `disputed` | Litige | **Litige** | `#FBE9E7` | `#B02A1E` | `#B02A1E` |
| `cancelled` | Annulée | voir ci-dessous | — | — | — |

Pickup vs non-pickup : même logique que `pickupAwareLabel()` dans `src/lib/orderStatus.ts` (déjà extrait aujourd'hui même, réutiliser tel quel — pas de nouvelle fonction).

### Le point dur : `cancelled` se dédouble

`cancelled` couvre aujourd'hui deux situations que le commerçant ne doit jamais confondre. Discriminant : **présence d'un remboursement** (`refunded_at` non nul, ou `refund_amount` non nul).

**(a) Jamais payée — « Paiement non finalisé »**
- Ton neutre : `background #F0F0ED`, texte `#6B6B63`, point `#9A9A90`, `font-weight 500`
- Cas fréquent (~64 sur 77 dans les données actuelles), aucune faute, aucune action
- Montant affiché normalement

**(b) Payée puis annulée — « Annulée & remboursée »**
- Ton problème : `background #FBE9E7`, texte `#B02A1E`, point `#B02A1E`, `font-weight 600`
- Cas rare (~3 sur 77), comptable, à tracer
- **Montant barré** (`text-decoration: line-through`)

Implémentation, décidée pour lever toute ambiguïté à l'implémentation : `StatusBadge` gagne une prop `refunded?: boolean`, sans effet sur aucun statut sauf `cancelled` (où elle choisit entre le variant neutre (a) et le variant problème (b) ci-dessus). Le prop `label` existant continue de gérer l'override pickup (« Prête à retirer » / « Retirée »), indépendant de `refunded`. Chaque appelant (`admin/page.tsx` pour les dernières commandes, et l'étape 2 pour la liste/fiche) calcule `refunded={order.status === 'cancelled' && Boolean(order.refunded_at || order.refund_amount)}` et le passe. Le montant barré (`text-decoration: line-through`) est géré par l'appelant à l'affichage du montant, pas par `StatusBadge` (qui n'affiche pas de montant).

---

## 3. Dashboard — direction retenue : « Vitrine » (1c)

Cartes contrastées, gros chiffres. Contenu identique à l'existant, largeur de référence desktop 1400px (sidebar comprise), desktop d'abord (le mobile garde le tiroir existant sous 1100px).

### Fond et cartes
- Fond de page `#EDEFF3` (neutre froid).
- Cartes blanches, `border-radius: 14px`, `box-shadow: 0 1px 2px rgba(16,24,40,.05), 0 4px 16px rgba(16,24,40,.04)`, pas de bordure.
- Padding intérieur 18–22px, gap extérieur 14px.

### Sidebar
- 220px, items `border-radius: 9px`. Actif : `background #EEF3FF`, `color #1B4ACB`.
- Badge de compteur « Commandes » : bleu `#2F6BFF` (plus rouge — une file d'attente n'est pas un problème). Rouge conservé uniquement pour « Litiges ». Ambre pour « Stock ».

### KPI (4 tuiles, `StatTile`)
- Valeur en `font-weight 700`, `font-size 34px`, `letter-spacing -.03em`.
- Chaque tuile a une pastille d'icône 28×28, `border-radius 8px`, fond teinté (bleu/vert/ambre/gris selon le sens §2, pas de couleur arbitraire).
- **La tuile « À expédier » est pleine `#2F6BFF`**, texte blanc, `box-shadow 0 2px 12px rgba(47,107,255,.28)` — ancre visuelle de l'écran, seul KPI en couleur pleine.

### Graphique + Paniers
- Côte à côte : `grid-template-columns: 1fr 320px`.
- Carte Paniers : compteur en `font-weight 700 40px`, barre empilée vert/gris 8px (payés vs en attente), bouton pleine largeur « Relancer les N paniers » (`background #EEF3FF`, `color #1B4ACB`) → lien vers `/admin/carts`, comportement inchangé.

### Dernières commandes
- Lignes ~61px : avatar 36×36 `border-radius 11px` (monochrome, §2), montant `font-weight 700 13.5px` avec la date dessous, badge à droite `padding 4px 10px` `border-radius 7px`.
- Hover `background #FAFBFD`. Clic → `/admin/orders/[id]`, inchangé.

### Top modèles vendus
- Barres pleine largeur 7px sous chaque libellé (pas une colonne de barres comme aujourd'hui).

### Graphique de ventes — correctif prioritaire, indépendant de la direction visuelle

Problème actuel (`src/components/admin/ui/MiniBarChart.tsx`) : 30 `<rect>` avec un `<title>` en infobulle et **aucun axe** — il faut survoler chaque barre pour connaître la date.

Correctif :
- `viewBox="0 0 1080 186"`, `width:100%`, `height:auto`, `overflow:visible`. **Supprimer `preserveAspectRatio="none"`** (déforme les rayons, empêche tout texte lisible).
- Zone de barres : hauteur 148px, ligne de base `y=150.5` (`stroke #E4E4DF`), ligne intermédiaire `y=75.5` (`stroke #F2F2EF`).
- 30 barres, `gap: 6` → `barW = (1080 - 6×29) / 30 ≈ 30.2`, `rx=2.5`. Remplissage `#2F6BFF` si vente, `#EDEDEA` si jour à zéro (hauteur minimale 3px pour rester visible).
- **Labels d'axe** : `<text>` centré sur la barre à `y=167`, `font 500 10.5px Inter`, `fill #9A9A90`, affiché un jour sur `labelEvery` (défaut 3) + toujours la dernière barre. Nom du mois seulement à la première barre, au dernier jour, et aux jours 1–3.
- Total 30 jours affiché dans le titre du bloc, meilleure journée en annotation à droite.
- Conserver le `<title>` par barre (infobulle + accessibilité) — complément, plus seul moyen de lire la donnée.

---

## 4. Fichiers du codebase à modifier

| Cible | Fichier |
| --- | --- |
| Palette + remappage des statuts | `src/components/admin/ui/StatusBadge.tsx` |
| Axe des dates du graphique | `src/components/admin/ui/MiniBarChart.tsx` |
| Avatars monochromes | `src/components/admin/ui/Avatar.tsx` |
| Tuiles KPI (gros chiffres, pastille d'icône) | `src/components/admin/ui/StatTile.tsx` |
| Layout du dashboard | `src/app/admin/page.tsx` |
| Sidebar, badges de compteur | `src/app/admin/layout.tsx` |
| Styles `admin-*` génériques | `src/app/globals.css` |

Aucune route API, aucun fichier `src/app/api/**` (hors le correctif de sécurité déjà livré séparément, commit `f90c6f4`, sans rapport avec ce chantier).

## 5. Typographie et tokens

- Police : Inter (400/500/600/700), déjà auto-hébergée via `next/font`. JetBrains Mono (500/600) à ajouter, réservée aux identifiants/montants tabulaires — **nouvelle dépendance de police**, à charger via `next/font/google` comme Inter (pas de `<link>` externe).
- `font-variant-numeric: tabular-nums` sur toute colonne de chiffres alignés.
- Neutres (fond froid, 1c) : `#EDEFF3` fond · `#FFFFFF` surface · `#E2E5EB` bordure · `#F1F3F7` séparateur · `#111827` texte · `#4B5563` / `#6B7280` secondaire · `#9CA3AF` tertiaire · `#EFF1F5` fond neutre.
- Couleurs sémantiques : voir §2, plus `#1B4ACB` (bleu foncé, texte/hover), `#EEF3FF` (bleu très clair), `#E3F3E9` (vert teinté), `#FBE9E7` (rouge teinté), `#F6ECD8` (ambre teinté).
- Transitions : 0ms ou 120ms ease-out max — c'est un outil de travail, pas une vitrine marketing.

## 6. Hors périmètre

- Le graphique reste un SVG dependency-free (pas de librairie de charts).
- Pas de nouvel état serveur : mêmes endpoints (`GET /api/admin/stats`, `GET /api/admin/notifications`).
- Étape 2 (Commandes liste + détail) : voir §1, spec séparée après maquettage.
