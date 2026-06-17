"""Filtrage + score des candidates pour limiter le décalage (mauvais modèle/couleur)."""

# Termes qui trahissent une image hors-sujet (accessoire, rendu, fond d'écran...).
BAD_TERMS = [
    "case", "coque", "cover", "etui", "étui", "screen", "protector", "verre",
    "wallpaper", "fond-ecran", "fond d", "vector", "icon", "logo", "clipart",
    "unboxing", "review", "vs", "comparison", "comparatif", "leak", "render", "concept",
    "sticker", "skin", "charger", "chargeur", "cable", "câble", "battery",
    "specs", "spec-", "fiche-technique", "datasheet", "infographic", "infographie",
    "landscape", "paysage", "pont", "bridge", "wallpapers", "animal", "tutorial",
]

COLOR_SYNONYMS = {
    "Black": ["black", "noir", "midnight", "graphite", "obsidian", "phantom black"],
    "White": ["white", "blanc", "starlight", "ceramic", "porcelain"],
    "Blue": ["blue", "bleu", "sierra", "pacific", "navy", "ice blue", "icy"],
    "Green": ["green", "vert", "alpine", "sage", "mint", "emerald"],
    "Red": ["red", "rouge", "product red", "(product)red"],
    "Pink": ["pink", "rose", "peach"],
    "Purple": ["purple", "violet", "lavender", "lilac", "deep purple"],
    "Gold": ["gold", "or", "champagne"],
    "Silver": ["silver", "argent", "platinum", "titanium silver"],
    "Grey": ["grey", "gray", "gris", "space gray", "space grey", "graphite", "titanium"],
    "Yellow": ["yellow", "jaune"],
    "Graphite": ["graphite", "grey", "gray", "gris"],
    "Titanium": ["titanium", "titane", "natural titanium"],
    "Beige": ["beige", "sandstone", "cream", "almond"],
    "Orange": ["orange", "cosmic orange"],
    "Ice Blue": ["ice blue", "icy blue", "light blue", "bleu glace"],
}


def color_terms(color):
    return COLOR_SYNONYMS.get(color, [color.lower()]) if color else []


def model_tokens(model):
    """Tokens significatifs du modèle (chiffres + mots clés) pour vérifier la présence."""
    toks = []
    for w in model.lower().replace("(", " ").replace(")", " ").split():
        if w in ("5g", "4g", "smartphone"):
            continue
        toks.append(w)
    return toks


def score_candidate(c, brand, model, color, cfg):
    text = f"{c.get('url','')} {c.get('source','')} {c.get('title','')}".lower()
    w, h = c.get("width", 0), c.get("height", 0)

    # rejets durs
    if w < cfg["min_width"] or h < cfg["min_height"]:
        return None
    # paysage = jamais un packshot de téléphone (rejet dur)
    if w and h and w / h > 1.4:
        return None
    if any(b in c.get("source", "").lower() or b in c.get("url", "").lower()
           for b in cfg.get("blocked_domains", [])):
        return None
    if any(t in text for t in BAD_TERMS):
        return None

    s = 0.0
    # résolution (plafonnée)
    s += min((w * h) / 1_000_000, 6.0)
    # ratio portrait (téléphone) — bonus si h >= w
    if h >= w:
        s += 2.0
    elif w / max(h, 1) > 1.6:
        s -= 1.5
    # domaine de confiance
    if any(d in c.get("source", "").lower() or d in c.get("url", "").lower()
           for d in cfg.get("trusted_domains", [])):
        s += 3.0
    # marque présente
    if brand.lower() in text:
        s += 1.0
    # tokens du modèle présents
    mt = model_tokens(model)
    hit = sum(1 for t in mt if t in text)
    s += 2.0 * (hit / max(len(mt), 1))
    # couleur présente
    if color and any(ct in text for ct in color_terms(color)):
        s += 3.0
    return s


def rank(candidates, brand, model, color, cfg):
    scored = []
    for c in candidates:
        sc = score_candidate(c, brand, model, color, cfg)
        if sc is not None:
            scored.append((sc, c))
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored
