# Design — Bibliothèque de photos smartphones par couleur (gratuit + validation)

**Date :** 2026-06-15
**Statut :** approuvé (design), spec à relire avant plan d'implémentation

## Problème

Le catalogue TEL & CASH (1000 produits hors accessoires, 66 modèles, 5 marques :
Apple, Samsung, Xiaomi, Google, OnePlus) contient des images de qualité et de
provenance inégales :

- **iPhones « OK »** (~20 modèles) : fichiers locaux `public/images/<brand>-<model>-<color>.png`,
  **une photo pro par couleur**. À conserver tels quels.
- **Tous les Android + iPhones récents/anciens non-locaux** : images d'un fournisseur
  dropshipping (`hel1.your-objectstorage.com`). Elles se chargent (HTTP 200) mais sont
  **souvent identiques quelle que soit la couleur** (ex : iPhone 14 *Yellow* et *Purple*
  → même fichier `final_1.jpg`) → **couleur non respectée**.
- **Quelques produits** en vrai placeholder (`placehold.co`, supabase, `10C google`).

**Objectif :** chaque produit (modèle + couleur) doit afficher une **photo pro dont la
couleur correspond réellement au modèle et à la variante**, sans décalage. Sources
**gratuites uniquement**. Aucune marque ajoutée hors catalogue.

### Contrainte de qualité centrale

Une recherche par mots-clés ramène parfois une coque, un autre modèle, un rendu, ou la
mauvaise couleur. Un import automatique aveugle **produira des erreurs**. La garantie
« zéro décalage » repose donc sur une **étape de validation visuelle humaine** avant
toute écriture en base.

## Périmètre

- **Cible par défaut :** tout produit dont l'image principale **n'est pas** un fichier
  local `/images/` — soit ~264 variantes / ~46 modèles, regroupées au niveau
  **modèle + couleur** (une recherche par couleur, appliquée à toutes les variantes de
  stockage de ce modèle+couleur).
- **Denylist par défaut :** les 20 modèles 100 % locaux + les iPhones majoritairement
  locaux (11, 12, 13, 14, 15… qui ne traînent qu'une variante parasite). Éditable.
- **Allowlist explicite :** iPhone 12 Pro, 12 Pro Max, 17 Pro Max, Air, et tout modèle
  que l'utilisateur veut forcer.
- Tout le périmètre est piloté par un `config.yaml` (allowlist / denylist / hosts
  considérés « à refaire »). Le **risque de mauvais périmètre est faible** car rien
  n'est écrit sans validation manuelle.
- **Hors périmètre :** marques absentes du catalogue (Oppo, Huawei, Honor, Nothing,
  Motorola, Sony, Asus, Realme, Vivo) ; accessoires.

## Architecture

Python 3.12. Deux exécutables + une lib commune.

```
tools/phone-images/
├── config.yaml              # marques, denylist/allowlist, hosts "à refaire", seuils
├── requirements.txt
├── README.md
├── fetch_images.py          # script principal : recherche → téléchargement → tri
├── build_review.py          # génère phones/review.html (appelé en fin de fetch)
├── import_selected.py       # lit les choix validés → public/images + update Supabase
├── lib/
│   ├── catalog.py           # lecture catalogue + NORMALISATION (dédoublonnage modèles/couleurs)
│   ├── sources.py           # Wikimedia, DuckDuckGo, fallback HTML constructeur/retail
│   ├── scoring.py           # filtres (≥800px, ratio, fond), score couleur/domaine
│   ├── dedupe.py            # pHash : doublons exacts + quasi-identiques
│   ├── viewdetect.py        # heuristique front/back/side/angle/lifestyle (best-effort)
│   ├── state.py             # reprise (JSON), idempotence
│   └── report.py            # CSV + logs
└── (sortie) phones/<Marque>/<Modèle>/<Couleur>/brand_model_color_<view>.png
```

### Flux de données

1. **`catalog.py`** lit les produits via Supabase (clé service depuis `.env.local`),
   filtre par périmètre, **normalise** :
   - fusionne doublons modèles : `iPhone Xs`/`XS`, `12 Mini`/`12 mini`, `S24`/`Galaxy S24`,
     `10C google` → libellé propre.
   - mappe les noms couleur marketing (Midnight, Sierra Blue, Graphite…) vers des termes
     de recherche + une couleur canonique.
   - produit la liste de travail `[(brand, model_clean, color_clean, search_terms, variant_ids[])]`.
2. **`sources.py`** pour chaque (modèle, couleur), par priorité :
   - **Wikimedia Commons API** (licencié, propre) ;
   - **DuckDuckGo Images** (endpoint non-officiel, sans clé) filtré domaines
     constructeurs/retail + résolution ;
   - **fallback** : page constructeur/e-commerce parsée en HTML.
   Retourne des candidates `{url, width, height, source, alt}`.
3. **`scoring.py`** : rejette < 800px, miniatures ; favorise ratio portrait + fond clair,
   confiance du domaine, **présence du nom de couleur** dans URL/alt ; rejette hors-sujet.
4. **`dedupe.py`** : pHash → supprime exacts et quasi-identiques ; garde les N meilleures.
5. **`viewdetect.py`** : heuristique (ratio, blancheur du fond, contours) →
   front / back / side / angle / lifestyle. **Best-effort, affiché dans la planche.**
6. Téléchargement HR dans `phones/<Marque>/<Modèle>/<Couleur>/` nommé
   `brand_model_color_<view>.png`. **`state.py`** marque l'avancement → **reprise auto**.
7. **`report.py`** : CSV (`brand, model, year, color, image_count, source_url`) + logs détaillés.
8. **`build_review.py`** : `phones/review.html` — par modèle+couleur, 3-4 meilleures
   candidates, case à cocher « garder celle-ci » / « aucune ». Choix exportés en JSON.

### Validation puis écriture

9. **`import_selected.py`** lit le JSON de choix :
   - enregistre l'image retenue en **`public/images/<brand>-<model>-<color>.png`**
     (exactement la convention des iPhones OK) ;
   - met à jour `products.images = ['/images/<...>.png']` pour **toutes les variantes**
     du modèle+couleur (via les `variant_ids`).
   - idempotent : ne réécrit que ce qui a changé ; log avant/après.

## Gestion d'erreurs & robustesse

- Téléchargement **parallèle** (pool borné), timeouts, retry exponentiel par requête.
- **Reprise** : état JSON par (modèle, couleur) — relance reprend où ça s'est arrêté.
- Source qui casse (DuckDuckGo non-officiel) → bascule sur la suivante, log clair.
- Image inutilisable / introuvable → laissée vide dans la planche, signalée dans le CSV
  (`image_count = 0`) → complétion manuelle (extension navigateur) hors script.
- **Aucune écriture base sans validation** : `fetch` et `build_review` ne touchent jamais
  Supabase ; seul `import_selected` écrit, après choix humain.

## Tests

- `catalog.py` : tests unitaires sur la normalisation (cas réels : `Xs/XS`, `S24`,
  `10C google`, doublons mini).
- `scoring.py` / `dedupe.py` : fixtures d'images (bonne couleur, mauvaise couleur,
  miniature, doublon) → asserts sur tri/rejet.
- `viewdetect.py` : petit jeu étiqueté → mesure du taux de bon classement (best-effort).
- `import_selected.py` : dry-run (`--dry-run`) qui imprime les écritures sans les appliquer.

## Limites assumées (honnêteté)

- Le gratuit **ne garantit ni 100 % de couverture ni 0 erreur** en automatique → la
  planche de validation est la garantie qualité.
- La détection de vue est heuristique, pas ML → étiquetage indicatif, corrigible à la main.
- Les CGU des sources varient ; l'usage des images relève de la responsabilité du
  propriétaire du site (revendeur reconditionné).

## Livrables

`requirements.txt`, `README.md`, `fetch_images.py`, `build_review.py`,
`import_selected.py`, lib, logs détaillés, rapport CSV.
