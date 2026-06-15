"""Importe les images validées : phones/ -> public/images/ + mise à jour Supabase.

Lit phones/selection.json (chosen = meilleure candidate par couple modèle+couleur),
copie l'image retenue vers public/images/<image_name>.png et met à jour
products.images pour toutes les variantes du couple.

Sécurité :
  - Sauvegarde des images actuelles dans phones/backup-images.json (rollback).
  - Mode DRY-RUN par défaut : n'écrit RIEN sans --apply.

Usage :
  python import_selected.py            # dry-run (affiche ce qui serait fait)
  python import_selected.py --apply    # copie les fichiers + met a jour la base
  python import_selected.py --rollback # restaure les images depuis le backup
"""
import os
import sys
import json
import shutil
import argparse
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib import catalog  # noqa: E402

OUT = os.path.join(HERE, "phones")


def public_images_dir(root):
    return os.path.join(root, "public", "images")


def supabase(env):
    base = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + "/rest/v1/products"
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    h = {"apikey": key, "Authorization": f"Bearer {key}",
         "Content-Type": "application/json", "Prefer": "return=minimal"}
    return base, h


def do_rollback(env):
    bpath = os.path.join(OUT, "backup-images.json")
    if not os.path.exists(bpath):
        print("Aucun backup trouvé.")
        return
    backup = json.load(open(bpath, encoding="utf-8"))
    base, h = supabase(env)
    for pid, images in backup.items():
        requests.patch(f"{base}?id=eq.{pid}", headers=h, json={"images": images}, timeout=30)
    print(f"Rollback: {len(backup)} produits restaurés.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--rollback", action="store_true")
    args = ap.parse_args()

    root = catalog.find_root()
    env = catalog._env()

    if args.rollback:
        do_rollback(env)
        return

    sel = json.load(open(os.path.join(OUT, "selection.json"), encoding="utf-8"))
    img_dir = public_images_dir(root)
    os.makedirs(img_dir, exist_ok=True)

    base, h = supabase(env)

    # 1) BACKUP fiable : lit les images actuelles de toutes les variantes concernées.
    if args.apply:
        all_ids = [pid for v in sel.values() if v.get("chosen") for pid in v["variant_ids"]]
        backup = {}
        for i in range(0, len(all_ids), 200):
            chunk = all_ids[i:i + 200]
            ids = ",".join(chunk)
            r = requests.get(f"{base}?id=in.({ids})&select=id,images", headers=h, timeout=30)
            for row in r.json():
                backup[row["id"]] = row.get("images") or []
        json.dump(backup, open(os.path.join(OUT, "backup-images.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)
        print(f"Backup de {len(backup)} variantes -> phones/backup-images.json")

    # 2) Copie fichiers + PATCH base.
    n_files, n_variants, n_skip = 0, 0, 0
    for key, v in sorted(sel.items()):
        if not v.get("chosen"):
            n_skip += 1
            print(f"  SKIP (aucune image) {key}")
            continue
        src = os.path.join(OUT, v["chosen"])
        name = v["image_name"] + ".png"
        dst = os.path.join(img_dir, name)
        rel_url = f"/images/{name}"
        print(f"  {key} -> public/images/{name}  ({len(v['variant_ids'])} variantes)")
        if args.apply:
            shutil.copyfile(src, dst)
            n_files += 1
            ids = ",".join(v["variant_ids"])
            requests.patch(f"{base}?id=in.({ids})", headers=h,
                           json={"images": [rel_url]}, timeout=30)
            n_variants += len(v["variant_ids"])

    mode = "APPLIQUÉ" if args.apply else "DRY-RUN (rien écrit, utilise --apply)"
    print(f"\n{mode} — {n_files} fichiers, {n_variants} variantes mises à jour, "
          f"{n_skip} couples sans image.")


if __name__ == "__main__":
    main()
