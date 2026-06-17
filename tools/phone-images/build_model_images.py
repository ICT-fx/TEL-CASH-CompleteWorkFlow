"""Génère/maj MODEL_IMAGES dans src/lib/modelImages.ts (source d'affichage du front).

Le front (listing téléphones + fiche produit) lit MODEL_IMAGES en mode STRICT et
ignore products.images. Donc TOUT passe par ici.

Règles :
  - clé = marque|modèle|couleur (valeurs STOCKÉES en base, minuscules).
  - FALLBACK couleur : une couleur sans photo propre réutilise la photo d'une
    AUTRE couleur du même modèle (préférence fond détouré). Évite le placeholder
    quand une couleur (souvent celle en stock) n'a pas été trouvée.
  - REJET : reject.txt liste les couples/modèles dont l'image est mauvaise
    (paysage, infographie, animal…). On ne les utilise pas → placeholder, et ils
    sortent dans phones/manual-todo.txt (à compléter à la main).

  python build_model_images.py
"""
import os
import sys
import json
import requests
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib import catalog  # noqa: E402

OUT = os.path.join(HERE, "phones")


def load_rejected_names():
    """image_name à NE PAS émettre dans le bloc AUTO :
    - rejetés par la vérification visuelle (rejected-images.txt)
    - gérés par le bloc MANUEL (manual-handled.txt) -> évite les clés dupliquées."""
    s = set()
    for fn in ("rejected-images.txt", "manual-handled.txt"):
        p = os.path.join(OUT, fn)
        if os.path.exists(p):
            for line in open(p, encoding="utf-8"):
                line = line.strip()
                if line and not line.startswith("#"):
                    s.add(line)
    return s
START = "  // === AUTO-GENERATED phone-images START (ne pas editer a la main) ==="
END = "  // === AUTO-GENERATED phone-images END ==="


def load_reject():
    """reject.txt : une entrée par ligne, 'marque|modele' ou 'marque|modele|couleur'."""
    p = os.path.join(HERE, "reject.txt")
    rej = set()
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            line = line.strip().lower()
            if line and not line.startswith("#"):
                rej.add(line)
    return rej


def is_rejected(rej, brand, model, color):
    b, m, c = brand.lower(), model.lower(), color.lower()
    return f"{b}|{m}" in rej or f"{b}|{m}|{c}" in rej


def main():
    root = catalog.find_root()
    env = catalog._env()
    base = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + "/rest/v1/products"
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    h = {"apikey": key, "Authorization": f"Bearer {key}"}

    cfg = yaml.safe_load(open(os.path.join(HERE, "config.yaml"), encoding="utf-8"))
    color_fallback = bool(cfg.get("color_fallback", False))
    sel = json.load(open(os.path.join(OUT, "selection.json"), encoding="utf-8"))
    rej = load_reject()
    rejected_names = load_rejected_names()   # rejets de la vérif visuelle

    # variant_id -> (image_name, white_bg)  pour les couples avec image NON rejetée
    vid_info = {}
    for v in sel.values():
        if not v.get("chosen"):
            continue
        if v["image_name"] in rejected_names:
            continue   # image jugée mauvaise visuellement -> ignorée (placeholder)
        cand = v["candidates"][0]
        for pid in v["variant_ids"]:
            vid_info[pid] = (v["image_name"], bool(cand.get("white_bg")))

    # On ne garde QUE les produits qu'on a CIBLÉS (présents dans la sélection),
    # indépendamment de l'image actuelle en base (qu'on a pu déjà mettre à jour).
    # Évite d'exclure les couples déjà importés et de polluer avec les iPhones OK.
    target_ids = {pid for v in sel.values() for pid in v["variant_ids"]}
    products = [p for p in catalog.fetch_products(env) if p["id"] in target_ids]

    # groupe par (brand, stored_model) -> { stored_color: (img_name, white_bg) }
    model_colors = {}        # (b,m) -> set des couleurs stockées
    model_color_img = {}     # (b,m) -> {color: (name, white)}
    for p in products:
        brand = (p.get("brand") or "").strip()
        model = (p.get("model") or "").strip()
        color = (p.get("color") or "").strip()
        if not (brand and model and color):
            continue
        km = (brand, model)
        model_colors.setdefault(km, set()).add(color)
        info = vid_info.get(p["id"])
        if info and not is_rejected(rej, brand, model, color):
            model_color_img.setdefault(km, {})[color] = info

    entries = {}
    todo = []   # (brand, model, color) sans image -> à compléter main
    for (brand, model), colors in sorted(model_colors.items()):
        have = model_color_img.get((brand, model), {})
        # image de repli du modèle (si color_fallback activé) : préférer fond détouré
        fallback = None
        if color_fallback:
            for col, (name, white) in have.items():
                if white:
                    fallback = name
                    break
            if fallback is None and have:
                fallback = next(iter(have.values()))[0]

        # on ne traite que les modèles qui ont AU MOINS une image (sinon rien à mettre)
        for color in sorted(colors):
            rejected = is_rejected(rej, brand, model, color)
            own = None if rejected else have.get(color)
            if own:
                name = own[0]
            elif fallback:
                # couleur sans image propre (ou rejetée) -> photo d'une couleur
                # SŒUR du même modèle (mieux qu'un placeholder facon "logo").
                name = fallback
            else:
                todo.append((brand, model, color, "rejeté" if rejected else "aucune image"))
                continue
            k = f"{brand.lower()}|{model.lower()}|{color.lower()}"
            entries[k] = f"/images/{name}.png"

    # n'écrire que pour les marques qu'on gère (sécurité : pas d'écrasement iPhone OK)
    # -> on garde toutes les entrées générées (elles viennent de nos couples).

    block = "\n".join([START] + [f'  {json.dumps(k)}: {json.dumps(entries[k])},'
                                 for k in sorted(entries)] + [END])

    ts_path = os.path.join(root, "src", "lib", "modelImages.ts")
    src = open(ts_path, encoding="utf-8").read()
    if START in src and END in src:
        before = src[: src.index(START)].rstrip("\n") + "\n"
        after = src[src.index(END) + len(END):]
        new = before + block + after
    else:
        idx = src.rindex("};")
        new = src[:idx] + block + "\n" + src[idx:]
    open(ts_path, "w", encoding="utf-8").write(new)

    # rapport à compléter à la main
    with open(os.path.join(OUT, "manual-todo.txt"), "w", encoding="utf-8") as f:
        f.write("# Téléphones SANS photo correcte (placeholder) — à compléter à la main\n")
        for brand, model, color, why in sorted(set(todo)):
            f.write(f"{brand} | {model} | {color}  ({why})\n")

    print(f"{len(entries)} entrées MODEL_IMAGES écrites.")
    print(f"{len(set(todo))} couples laissés en placeholder -> phones/manual-todo.txt")


if __name__ == "__main__":
    main()
