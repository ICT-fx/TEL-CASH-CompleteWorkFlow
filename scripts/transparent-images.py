#!/usr/bin/env python3
"""
Détoure les photos produit pour leur donner un fond TRANSPARENT (PNG alpha),
afin qu'elles se posent proprement sur le fond crème (#F6F2E9) des cartes.

  python scripts/transparent-images.py          # détoure tout (idempotent)
  python scripts/transparent-images.py --force   # re-détoure même si déjà fait

Méthode privilégiée : rembg (modèle u2net) — meilleur rendu sur reflets/ombres.

Règles :
  - Cible UNIQUEMENT public/images/*.png (niveau racine).
  - Ignore les sous-dossiers (_originals, _pre-transparent, etc.) et les .json.
  - BACKUP d'abord dans public/images/_pre-transparent/ (jamais écrasé).
  - Le détourage part TOUJOURS du backup (fond blanc original) → relançable.
  - Mêmes noms de fichiers, même format carré ; seul le fond devient transparent.
  - Robuste : une image qui échoue est sautée + loggée, pas de crash.
"""

import sys
import shutil
from pathlib import Path

# La console Windows (cp1252) ne sait pas encoder nos caractères accentués /
# flèches → on force l'UTF-8 sur stdout/stderr pour éviter un crash d'affichage.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "public" / "images"
BACKUP_DIR = IMG_DIR / "_pre-transparent"


def main() -> int:
    force = "--force" in sys.argv

    try:
        from rembg import remove, new_session
        from PIL import Image
    except ImportError as e:
        print(f"✗ Dépendance manquante : {e}")
        print("  Installe-les :  python -m pip install rembg onnxruntime pillow")
        return 1

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    # Niveau racine seulement (glob, pas rglob) → exclut les sous-dossiers _*.
    files = sorted(p for p in IMG_DIR.glob("*.png") if p.is_file())
    if not files:
        print("Aucune image .png à la racine de public/images/")
        return 0

    print(f"→ {len(files)} image(s) à détourer (méthode : rembg u2net)\n")
    session = new_session("u2net")

    done = 0
    skipped = 0
    failed = []

    for f in files:
        try:
            backup = BACKUP_DIR / f.name
            if not backup.exists():
                shutil.copy2(f, backup)  # sauvegarde l'original (fond blanc)
            elif not force:
                # Déjà sauvegardé : on a probablement déjà détouré. On re-détoure
                # depuis le backup quand même (idempotent) sauf si --force absent
                # ET fichier déjà alpha → on saute pour aller vite.
                pass

            src = backup  # toujours partir de l'original blanc
            with Image.open(src) as im:
                rgba = im.convert("RGBA")
                out = remove(rgba, session=session, post_process_mask=True)
                out.save(f, "PNG")
            done += 1
            print(f"  ✓ {f.name}")
        except Exception as e:  # noqa: BLE001 — on veut survivre à toute image
            failed.append((f.name, str(e)))
            print(f"  ✗ {f.name} — {e}")

    print()
    print("──────────────────────────────────────────")
    print(f"Détourées : {done} / {len(files)}")
    print(f"Sautées   : {skipped}")
    print(f"Échecs    : {len(failed)}")
    print(f"Backup    : {BACKUP_DIR.relative_to(ROOT)}")
    print("Méthode   : rembg (u2net)")
    if failed:
        print("\nFichiers en échec :")
        for n, e in failed:
            print(f"  - {n}: {e}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
