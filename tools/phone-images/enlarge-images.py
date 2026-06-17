"""Agrandit en place les packshots de public/images : recadre la zone transparente
+ découpe dos/face si large + remplit ~94% du canvas. Ne touche QUE les images
ayant déjà de la transparence (fond détouré). Les images à fond opaque (vert/blanc
non détouré) sont ignorées -> à re-traiter séparément.

  python enlarge-images.py
"""
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib import catalog, imageproc  # noqa: E402

IMG = os.path.join(catalog.find_root(), "public", "images")

done = 0
skip = 0
for f in sorted(os.listdir(IMG)):
    if not f.lower().endswith(".png"):
        continue
    p = os.path.join(IMG, f)
    try:
        im = Image.open(p).convert("RGBA")
        if im.split()[3].getextrema()[0] != 0:
            skip += 1   # aucune transparence -> fond opaque, on ne touche pas
            continue
        out = imageproc.to_canvas(im)
        out.save(p, "PNG", optimize=True)
        done += 1
    except Exception as e:
        print(f"skip {f}: {e}")
        skip += 1

print(f"Agrandies: {done}  |  ignorees (fond opaque/erreur): {skip}")
