"""Pipeline principal : recherche -> score -> téléchargement -> détourage -> staging.

Sortie (dans phones/) :
  phones/<Marque>/<Modèle>/<Couleur>/cand0.png ... candN.png   (cand0 = meilleur)
  phones/state.json        (reprise)
  phones/selection.json    (choix + variant_ids + backup des images actuelles)
  phones/report.csv        (rapport)
  phones/review.html       (contrôle visuel humain)

Usage :
  python fetch_images.py            # tout le périmètre, reprise auto
  python fetch_images.py --limit 8  # n'en traite que 8 (test)
"""
import os
import sys
import csv
import json
import argparse
from concurrent.futures import ThreadPoolExecutor

import yaml
import imagehash
from PIL import Image
import io

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib import catalog, sources, scoring        # noqa: E402
from lib.slug import image_name, slugify          # noqa: E402
from lib import imageproc                          # noqa: E402

OUT = os.path.join(HERE, "phones")


def load_state():
    p = os.path.join(OUT, "state.json")
    if os.path.exists(p):
        return json.load(open(p, encoding="utf-8"))
    return {"done": {}}


def save_json(name, obj):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def phash(png_bytes):
    return str(imagehash.phash(Image.open(io.BytesIO(png_bytes))))


def _collect_candidates(w, cfg):
    brand, model, color = w["brand"], w["model"], w["color"]
    cands = sources.ddg_images(w["search"], cfg["candidates_per_query"], cfg["ddg_pause"])
    # requête secondaire si trop peu de résultats (phrasing alternatif)
    if len({c["url"] for c in cands}) < 10:
        alt = f"{brand} {model} {color}".strip()
        seen = {c["url"] for c in cands}
        for c in sources.ddg_images(alt, cfg["candidates_per_query"], cfg["ddg_pause"]):
            if c["url"] not in seen:
                cands.append(c)
                seen.add(c["url"])
    if cfg.get("use_wikimedia") and len(cands) < 5:
        cands += sources.wikimedia_images(w["search"])
    return cands


def process_group(w, cfg, log):
    """Cherche et traite les candidates d'un couple (modèle, couleur)."""
    brand, model, color = w["brand"], w["model"], w["color"]
    cands = _collect_candidates(w, cfg)
    ranked = scoring.rank(cands, brand, model, color, cfg)
    log(f"  {brand} {model} {color}: {len(cands)} candidates, {len(ranked)} retenues apres filtre")

    rel_dir = os.path.join(brand, slugify(model), slugify(color) or "default")
    abs_dir = os.path.join(OUT, rel_dir)
    os.makedirs(abs_dir, exist_ok=True)

    def fetch(entry):
        sc, c = entry
        raw = sources.download(c["url"], cfg["timeout"])
        if not raw:
            return None
        try:
            png, white = imageproc.process_bytes(raw)
        except Exception:
            return None
        return (sc, c, png, white)

    # télécharge + traite un lot, dédup par pHash
    processed, hashes = [], []
    with ThreadPoolExecutor(max_workers=cfg["parallel"]) as ex:
        for res in ex.map(fetch, ranked[: max(cfg["keep_top"] * 3, 9)]):
            if not res:
                continue
            sc, c, png, white = res
            h = imagehash.hex_to_hash(phash(png))
            if any(h - hh <= cfg["phash_distance"] for hh in hashes):
                continue
            hashes.append(h)
            processed.append((sc, c, png, white))

    # PRÉFÉRENCE FORTE aux fonds blancs (packshots), puis au score
    processed.sort(key=lambda t: (t[3], t[0]), reverse=True)
    processed = processed[: cfg["keep_top"]]

    saved = []
    for idx, (sc, c, png, white) in enumerate(processed):
        fn = f"cand{idx}.png"
        with open(os.path.join(abs_dir, fn), "wb") as f:
            f.write(png)
        saved.append({
            "file": os.path.join(rel_dir, fn).replace("\\", "/"),
            "score": round(sc, 2), "white_bg": white,
            "source": c["source"], "src_url": c["url"],
            "src_w": c["width"], "src_h": c["height"],
        })
    return saved


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--only-brand", default=None)
    args = ap.parse_args()

    cfg = yaml.safe_load(open(os.path.join(HERE, "config.yaml"), encoding="utf-8"))
    work, _ = catalog.build_worklist(cfg)
    if args.only_brand:
        work = [w for w in work if w["brand"] == args.only_brand]
    if args.limit:
        work = work[: args.limit]

    state = load_state()
    selection = {}
    sel_path = os.path.join(OUT, "selection.json")
    if os.path.exists(sel_path):
        selection = json.load(open(sel_path, encoding="utf-8"))

    def log(m):
        print(m, flush=True)

    log(f"== {len(work)} couples a traiter ==")
    for i, w in enumerate(work, 1):
        key = f"{w['brand']}|{w['model']}|{w['color']}"
        if state["done"].get(key):
            continue
        log(f"[{i}/{len(work)}] {key}")
        try:
            saved = process_group(w, cfg, log)
        except Exception as e:
            log(f"  ERREUR {type(e).__name__}: {e}")
            saved = []
        selection[key] = {
            "brand": w["brand"], "model": w["model"], "color": w["color"],
            "image_name": image_name(w["brand"], w["model"], w["color"]),
            "variant_ids": w["variant_ids"],
            "current_images": w["current_images"],
            "candidates": saved,
            "chosen": saved[0]["file"] if saved else None,
        }
        state["done"][key] = True
        save_json("state.json", state)
        save_json("selection.json", selection)

    write_report(selection)
    write_review(selection)
    n_ok = sum(1 for v in selection.values() if v["chosen"])
    log(f"\nTermine. {n_ok}/{len(selection)} couples avec une image. "
        f"Review: phones/review.html  |  CSV: phones/report.csv")


def write_report(selection):
    with open(os.path.join(OUT, "report.csv"), "w", newline="", encoding="utf-8") as f:
        wr = csv.writer(f)
        wr.writerow(["brand", "model", "year", "color", "image_count", "source_url"])
        for v in selection.values():
            src = v["candidates"][0]["src_url"] if v["candidates"] else ""
            wr.writerow([v["brand"], v["model"], "", v["color"], len(v["candidates"]), src])


def write_review(selection):
    rows = []
    for key, v in sorted(selection.items()):
        cards = ""
        for j, c in enumerate(v["candidates"]):
            tag = "★ choisie" if j == 0 else f"alt {j}"
            cards += (f'<figure class="{ "chosen" if j==0 else "" }">'
                      f'<img src="{c["file"]}" loading="lazy">'
                      f'<figcaption>{tag} · score {c["score"]} · {c["src_w"]}x{c["src_h"]}'
                      f'<br><span>{c["source"]}</span></figcaption></figure>')
        if not v["candidates"]:
            cards = '<div class="empty">Aucune image trouvée — à compléter manuellement</div>'
        rows.append(f'<section><h2>{v["brand"]} {v["model"]} — {v["color"]} '
                    f'<small>({len(v["variant_ids"])} variantes → {v["image_name"]}.png)</small></h2>'
                    f'<div class="row">{cards}</div></section>')
    html = ("<!doctype html><meta charset=utf-8><title>Review photos</title>"
            "<style>body{font-family:system-ui;margin:24px;background:#0f1117;color:#e7e9ee}"
            "h2{font-size:15px;border-top:1px solid #283;margin-top:28px;padding-top:14px}"
            "small{color:#8a93a6;font-weight:400}.row{display:flex;gap:14px;flex-wrap:wrap}"
            "figure{margin:0;width:180px;background:#fff;border-radius:10px;padding:6px}"
            "figure.chosen{outline:3px solid #3ad07a}img{width:100%;height:168px;object-fit:contain;"
            "background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 50%/16px 16px}"
            "figcaption{font-size:11px;color:#222;padding:4px}figcaption span{color:#666}"
            ".empty{color:#e2557b;padding:12px}</style>"
            f"<h1>Contrôle photos — {sum(1 for v in selection.values() if v['chosen'])}/"
            f"{len(selection)} couples avec image</h1>" + "".join(rows))
    with open(os.path.join(OUT, "review.html"), "w", encoding="utf-8") as f:
        f.write(html)


if __name__ == "__main__":
    main()
