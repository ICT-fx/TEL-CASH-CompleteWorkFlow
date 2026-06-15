"""Importe les images fournies à la main (dossier NewPhonesImages du Bureau).

Mapping explicite fichier -> (marque, modèle STOCKÉ, couleur STOCKÉE). Chaque image
est détourée (fond uni blanc/coloré -> transparent) + recentrée 1000x1000, copiée
dans public/images/<slug>.png, et câblée dans un bloc MANUEL de modelImages.ts
(prioritaire sur le bloc AUTO, donc remplace une couleur auparavant rejetée).

  python manual_import.py            # dry-run (liste ce qui serait fait)
  python manual_import.py --apply
"""
import os
import sys
import json
import argparse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib import catalog, imageproc           # noqa: E402
from lib.slug import image_name as slugname  # noqa: E402

SRC = r"C:\Users\yanis\Desktop\NewPhonesImages"
M_START = "  // === MANUAL phone-images START (images fournies a la main) ==="
M_END = "  // === MANUAL phone-images END ==="

# (fichier source, marque, modele STOCKE, couleur STOCKEE)
MAP = [
    ("GOOGLEPixel9profold noir.jpg", "Google", "Pixel 9 Pro Fold 5G", "Black"),
    ("Redmi Note 14 Pro noirr.jpg", "Xiaomi", "Redmi Note 14 Pro 5G", "Black"),
    ("Xiaomi 13 ultra blanc.jpg", "Xiaomi", "13 Ultra 5G", "White"),
    ("imageye___-_imgi_13_GALAXY_S23_BLACK_ALL_f207.webp", "Samsung", "Galaxy S23 5G", "Black"),
    ("imageye___-_imgi_13_GALAXY_S23_GREEN_ALL_f031.webp", "Samsung", "Galaxy S23 5G", "Green"),
    ("imageye___-_imgi_13_GALAXY_S23_GREEN_ALL_f031.webp", "Samsung", "Galaxy S23", "Vert"),
    ("imageye___-_imgi_13_GALAXY_S23_VIOLET_ALL_0552.webp", "Samsung", "Galaxy S23 5G", "Purple"),
    ("imageye___-_imgi_13_Galaxy_S25_Duos_bleu_all_af6a.webp", "Samsung", "Galaxy S25 5G", "Blue"),
    ("imageye___-_imgi_13_Galaxy_S25_Duos_noir_all_9fc3.webp", "Samsung", "Galaxy S25 5G", "Black"),
    ("imageye___-_imgi_13_Redmi_Note_13_Dual_noir_all_34d9.webp", "Xiaomi", "Redmi Note 13 5G", "Black"),
    ("imageye___-_imgi_13_Redmi_Note_13_Pro_noir_all_11a1.webp", "Xiaomi", "Redmi Note 13 Pro 5G", "Black"),
    ("imageye___-_imgi_13_SAMSUNG_GALAXY_Z_FLIP_3_CREAM_ALL_5631.webp", "Samsung", "Galaxy Z Flip3 5G", "Beige"),
    ("imageye___-_imgi_13_SAMSUNG_GALAXY_Z_FLIP_3_PURPLE_ALL_c7f7.webp", "Samsung", "Galaxy Z Flip3 5G", "Purple"),
    ("imageye___-_imgi_13_Xiaomi_12T_5G___ALL_73e0.webp", "Xiaomi", "Xiaomi 12T 5G", "Black"),
    ("imageye___-_imgi_13_iPhone_17_bleu_all_93a4.webp", "Apple", "iPhone 17", "Blue"),
    ("imageye___-_imgi_13_iPhone_17_pro_argent_all_b42b.webp", "Apple", "iPhone 17 Pro", "Silver"),
    ("imageye___-_imgi_13_iPhone_17_pro_orange_all_8da6.webp", "Apple", "iPhone 17 Pro", "Orange"),
    ("imageye___-_imgi_13_iPhone_17_vert_all_cb4e.webp", "Apple", "iPhone 17", "Green"),
    ("imageye___-_imgi_13_iphone_16e_black_full_265c.jpg", "Apple", "iPhone 16e", "Black"),
    ("imageye___-_imgi_13_redmi_note_12_pro_black_full_40e1.webp", "Xiaomi", "Redmi Note 12 Pro 5G", "Black"),
    ("imageye___-_imgi_13_redmi_note_12_pro_blue_full_1618.webp", "Xiaomi", "Redmi Note 12 Pro 5G", "Blue"),
    ("imageye___-_imgi_13_xiaomi_14t_dual_noir_all_6733.webp", "Xiaomi", "14T 5G", "Black"),
    ("imageye___-_imgi_13_xiaomi_14t_dual_vert_all_81d5.webp", "Xiaomi", "14T 5G", "Green"),
    # ajouts ultérieurs
    ("GOOGLE pixel 9 noir.jpg", "Google", "Pixel 9 5G", "Black"),
    ("ONEPLUS 15 noir.webp", "OnePlus", "15 5G", "Black"),
    ("XIAOMI 17 noir.jpg", "Xiaomi", "17 Ultra 5G", "Black"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    root = catalog.find_root()
    img_dir = os.path.join(root, "public", "images")

    # couples (marque, modele, couleur) existants en base, pour valider le mapping
    env = catalog._env()
    valid = {(p.get("brand"), p.get("model"), p.get("color")) for p in catalog.fetch_products(env)}

    entries = {}
    handled_names = set()
    for fname, brand, model, color in MAP:
        src = os.path.join(SRC, fname)
        ok_db = (brand, model, color) in valid
        flag = "" if ok_db else "  ⚠️ (couple absent du catalogue)"
        if not os.path.exists(src):
            print(f"  ❌ introuvable: {fname}")
            continue
        name = slugname(brand, model, color)
        handled_names.add(name)
        print(f"  {brand} | {model} | {color} -> {name}.png{flag}")
        if args.apply:
            raw = open(src, "rb").read()
            png, _ = imageproc.process_bytes(raw)
            open(os.path.join(img_dir, name + ".png"), "wb").write(png)
        entries[f"{brand.lower()}|{model.lower()}|{color.lower()}"] = f"/images/{name}.png"

    if args.apply:
        # liste des image_names gérés en manuel -> build_model_images les exclut du
        # bloc AUTO (sinon clés dupliquées dans l'objet MODEL_IMAGES).
        with open(os.path.join(HERE, "phones", "manual-handled.txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(sorted(handled_names)) + "\n")

        ts = os.path.join(root, "src", "lib", "modelImages.ts")
        src_ts = open(ts, encoding="utf-8").read()
        block = "\n".join([M_START] + [f'  {json.dumps(k)}: {json.dumps(v)},'
                                       for k, v in sorted(entries.items())] + [M_END])
        if M_START in src_ts and M_END in src_ts:
            before = src_ts[: src_ts.index(M_START)].rstrip("\n") + "\n"
            after = src_ts[src_ts.index(M_END) + len(M_END):]
            src_ts = before + block + after
        else:
            idx = src_ts.rindex("};")            # insère AVANT la fermeture (après AUTO)
            src_ts = src_ts[:idx] + block + "\n" + src_ts[idx:]
        open(ts, "w", encoding="utf-8").write(src_ts)
        print(f"\nOK: {len(entries)} entrees MANUEL ecrites dans modelImages.ts + images traitees.")
    else:
        print(f"\nDRY-RUN — {len(entries)} entrées prêtes (utilise --apply).")


if __name__ == "__main__":
    main()
