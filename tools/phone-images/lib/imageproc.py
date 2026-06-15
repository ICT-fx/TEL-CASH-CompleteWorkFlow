"""Traitement image : détourage du fond clair + canvas carré transparent 1000x1000.

Même rendu que les packshots iPhone locaux (RGBA transparent, sujet centré ~88%).
Détourage par flood-fill depuis les 4 coins (PIL, rapide). Si le fond n'est pas
clair/uni, le sujet est gardé tel quel sur son fond et juste recentré.
"""
from PIL import Image, ImageDraw
import io

S = 1000
INNER = int(S * 0.88)
SENTINEL = (255, 0, 255)  # magenta improbable dans une photo de téléphone


def _looks_white(rgb):
    r, g, b = rgb[:3]
    return r > 235 and g > 235 and b > 235


def _dist(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def corners_rgb(im):
    w, h = im.size
    pts = [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)]
    return [im.getpixel(p)[:3] for p in pts]


def uniform_bg(im, tol=40):
    """Renvoie la couleur de fond si les 4 coins sont ~uniformes, sinon None.

    Marche pour le blanc MAIS AUSSI un fond de couleur uni (vert, gris, beige…)
    -> permet de détourer les packshots à fond coloré, pas seulement blancs.
    """
    cs = corners_rgb(im)
    avg = tuple(sum(c[i] for c in cs) // len(cs) for i in range(3))
    if all(_dist(c, avg) <= tol for c in cs):
        return avg
    return None


def corner_is_white(im):
    return uniform_bg(im) is not None


def detour(im_rgb, bg, tolerance=32):
    """Rend transparent le fond UNI (couleur `bg`) connecté aux bords. RGBA."""
    im = im_rgb.convert("RGB")
    w, h = im.size
    flood = im.copy()
    for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if _dist(im.getpixel(corner)[:3], bg) <= tolerance:
            ImageDraw.floodfill(flood, corner, SENTINEL, thresh=tolerance)
    rgba = im.convert("RGBA")
    px_src = flood.load()
    px_dst = rgba.load()
    for y in range(h):
        for x in range(w):
            if px_src[x, y] == SENTINEL:
                px_dst[x, y] = (0, 0, 0, 0)
    return rgba


def to_canvas(im_rgba):
    """Trim transparent + resize 88% + centre sur canvas carré 1000x1000."""
    bbox = im_rgba.getbbox()
    if bbox:
        im_rgba = im_rgba.crop(bbox)
    im_rgba.thumbnail((INNER, INNER), Image.LANCZOS)
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    x = (S - im_rgba.width) // 2
    y = (S - im_rgba.height) // 2
    canvas.alpha_composite(im_rgba, (x, y))
    return canvas


def process_bytes(raw):
    """bytes -> (PNG bytes 1000x1000 RGBA, had_uniform_bg: bool).

    Détoure tout fond UNI (blanc ou couleur) puis recadre le sujet à ~88 % du
    canvas (corrige les téléphones "trop petits"). Fond non-uni (lifestyle) :
    gardé tel quel, juste recentré.
    """
    im = Image.open(io.BytesIO(raw))
    im = im.convert("RGB")
    if max(im.size) > 1600:
        im.thumbnail((1600, 1600), Image.LANCZOS)
    bg = uniform_bg(im)
    if bg is not None:
        rgba = detour(im, bg)
    else:
        rgba = im.convert("RGBA")
    out = to_canvas(rgba)
    buf = io.BytesIO()
    out.save(buf, "PNG", optimize=True)
    return buf.getvalue(), bg is not None
