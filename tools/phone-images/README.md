# Bibliothèque photos smartphones (par couleur)

Pipeline **gratuit** qui constitue une photo pro **par modèle + couleur** pour le
catalogue TEL & CASH, puis met à jour la base après validation.

Cible : les téléphones du catalogue qui n'ont **pas** déjà une photo locale pro
(`/images/...`). Aucune marque hors catalogue n'est ajoutée. Périmètre piloté par
`config.yaml` (notamment `process_only.Apple` qui limite Apple aux modèles à refaire).

## Installation

```bash
py -3.12 -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.txt
```

Nécessite `.env.local` à la racine du projet (`NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`).

## Étapes

### 1. Récupération (ne touche PAS la base)

```bash
./.venv/Scripts/python.exe fetch_images.py            # tout le périmètre (reprise auto)
./.venv/Scripts/python.exe fetch_images.py --limit 8  # test rapide
./.venv/Scripts/python.exe fetch_images.py --only-brand Samsung
```

Pour chaque couple (modèle, couleur) : recherche DuckDuckGo Images (+ requête
secondaire si peu de résultats) → filtre (≥800px, domaines de confiance, rejet
coques/wallpapers/rendus) → téléchargement → **détourage fond blanc** + canvas
1000×1000 transparent (rendu identique aux iPhones existants) → **dédup pHash** →
**préférence forte aux packshots fond blanc**.

Sorties dans `phones/` :
- `phones/<Marque>/<modèle>/<couleur>/cand0.png …` (cand0 = meilleure)
- `phones/state.json` — reprise (relancer reprend où ça s'est arrêté)
- `phones/selection.json` — choix + `variant_ids` + images actuelles
- `phones/report.csv` — `brand, model, year, color, image_count, source_url`
- `phones/review.html` — **planche de contrôle visuel** (ouvre-la pour valider)

### 2. Contrôle

Ouvre `phones/review.html` : la candidate retenue (★) est encadrée en vert, avec
ses alternatives. Repère les couples sans image ou mal choisis.

### 3. Import (écrit la base — réversible)

```bash
./.venv/Scripts/python.exe import_selected.py            # DRY-RUN (n'écrit rien)
./.venv/Scripts/python.exe import_selected.py --apply    # copie public/images + update base
./.venv/Scripts/python.exe import_selected.py --rollback # restaure les images d'avant
```

`--apply` sauvegarde d'abord les images actuelles dans `phones/backup-images.json`,
copie l'image retenue en `public/images/<marque-modèle-couleur>.png`, puis met à jour
`products.images` pour **toutes les variantes** du couple. `--rollback` annule.

## Limites assumées

- Sources gratuites → ni 100 % de couverture ni 0 erreur garantis : la planche de
  validation (étape 2) est la vraie garantie qualité.
- Détection de vue heuristique (non utilisée pour le choix final, qui privilégie le
  packshot fond blanc).
- DuckDuckGo peut throttler sur de gros volumes → relancer `fetch_images.py`
  (reprise auto) comble les trous.
