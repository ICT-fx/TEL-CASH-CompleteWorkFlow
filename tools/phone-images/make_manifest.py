"""Génère phones/verify-manifest.json : la liste des images à vérifier visuellement.

Chaque entrée : {idx, key, image_name, path (absolu), brand, model, color}.
Les agents de vérification lisent ce fichier, regardent chaque image (path) et
rendent un verdict ok/reject.
"""
import os
import sys
import json

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "phones")


def main():
    sel = json.load(open(os.path.join(OUT, "selection.json"), encoding="utf-8"))
    man = []
    for key, v in sorted(sel.items()):
        if not v.get("chosen"):
            continue
        path = os.path.abspath(os.path.join(OUT, v["chosen"]))
        man.append({
            "idx": len(man),
            "key": key,
            "image_name": v["image_name"],
            "path": path,
            "brand": v["brand"],
            "model": v["model"],
            "color": v["color"],
        })
    json.dump(man, open(os.path.join(OUT, "verify-manifest.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    print(f"{len(man)} images à vérifier -> phones/verify-manifest.json")


if __name__ == "__main__":
    main()
