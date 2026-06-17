"""Lecture + normalisation du catalogue depuis Supabase (REST, clé service).

Produit une worklist groupée par (brand, model_canonique, color_canonique) avec
la liste des variant_ids concernés et les termes de recherche.
"""
import os
import re
import json
import requests

# Mapping couleurs FR -> EN (termes de recherche) + couleur canonique pour le slug.
COLOR_FR_EN = {
    "noir": "Black", "blanc": "White", "vert": "Green", "bleu": "Blue",
    "rouge": "Red", "rose": "Pink", "violet": "Purple", "or": "Gold",
    "argent": "Silver", "gris": "Grey", "jaune": "Yellow", "graphite": "Graphite",
    "titane": "Titanium", "titane naturel": "Natural Titanium", "minuit": "Midnight",
    "lumiere stellaire": "Starlight", "corail": "Coral",
}

# Fusion de modèles doublons / nettoyage de libellés douteux.
MODEL_CANON = {
    "iphone xs": "iPhone XS",
    "xs": "iPhone XS",
    "iphone 12 mini": "iPhone 12 mini",
    "10c google": "Pixel",            # libellé cassé -> on tentera "Google Pixel 10C" via brand
    "s24": "Galaxy S24",
}


def find_root(start=None):
    """Remonte les dossiers jusqu'à trouver .env.local (racine du projet)."""
    d = os.path.abspath(start or os.getcwd())
    while True:
        if os.path.exists(os.path.join(d, ".env.local")):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            raise FileNotFoundError(".env.local introuvable en remontant depuis " + os.getcwd())
        d = parent


def _env(path=None):
    if path is None:
        path = os.path.join(find_root(), ".env.local")
    env = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env


def canon_model(brand: str, model: str) -> str:
    key = (model or "").strip().lower()
    if key in MODEL_CANON:
        return MODEL_CANON[key]
    # normalise la casse de "Mini"/"mini" pour éviter les doublons
    m = re.sub(r"\bMini\b", "mini", (model or "").strip())
    return m


def canon_color(color: str) -> str:
    c = (color or "").strip()
    if not c:
        return ""
    key = c.lower()
    return COLOR_FR_EN.get(key, c)  # garde tel quel si déjà en anglais / marketing


def fetch_products(env):
    url = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + "/rest/v1/products"
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    out, offset, page = [], 0, 1000
    while True:
        params = {"select": "id,brand,model,color,category,images", "category": "neq.accessoires",
                  "limit": page, "offset": offset}
        r = requests.get(url, headers=headers, params=params, timeout=30)
        r.raise_for_status()
        batch = r.json()
        out.extend(batch)
        if len(batch) < page:
            break
        offset += page
    return out


def first_image(p):
    imgs = [u for u in (p.get("images") or []) if u]
    return imgs[0] if imgs else None


def in_scope(p, cfg):
    """True si le produit doit être (re)photographié."""
    brand = p.get("brand") or ""
    if brand not in cfg["brands"]:
        return False
    # Restriction par marque : si la marque a une liste "process_only", seuls ces
    # modeles (canoniques) sont traites.
    only = (cfg.get("process_only") or {}).get(brand)
    if only is not None:
        if canon_model(brand, p.get("model")) not in only:
            return False
    model_l = (p.get("model") or "").lower()
    if any(m.lower() == model_l for m in cfg.get("denylist_models", [])):
        return False
    if any(m.lower() == model_l for m in cfg.get("allowlist_models", [])):
        return True
    u = first_image(p)
    if u and any(u.startswith(pre) for pre in cfg["keep_if_image_startswith"]):
        return False  # déjà une image locale pro
    if u is None:
        return True   # aucune image
    return any(h in u for h in cfg["redo_if_host_contains"])


def build_worklist(cfg):
    env = _env()
    products = fetch_products(env)
    groups = {}
    for p in products:
        if not in_scope(p, cfg):
            continue
        brand = p["brand"]
        model = canon_model(brand, p.get("model"))
        color = canon_color(p.get("color"))
        key = (brand, model, color)
        g = groups.setdefault(key, {"brand": brand, "model": model, "color": color,
                                     "variant_ids": [], "current_images": set()})
        g["variant_ids"].append(p["id"])
        if first_image(p):
            g["current_images"].add(first_image(p))
    work = []
    for (brand, model, color), g in sorted(groups.items()):
        terms = f"{brand} {model} {color} smartphone".replace("  ", " ").strip()
        work.append({
            "brand": brand, "model": model, "color": color,
            "search": terms, "variant_ids": g["variant_ids"],
            "current_images": sorted(g["current_images"]),
        })
    return work, env


if __name__ == "__main__":
    import yaml
    cfg = yaml.safe_load(open("config.yaml", encoding="utf-8"))
    work, _ = build_worklist(cfg)
    print(f"{len(work)} couples (modele, couleur) a traiter")
    for w in work:
        print(f"  {w['brand']:8} | {w['model']:22} | {w['color']:18} | {len(w['variant_ids'])} variantes | q='{w['search']}'")
