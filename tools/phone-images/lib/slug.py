"""Slugification cohérente avec les images locales existantes.

Exemples cibles (déjà présents dans public/images/) :
  Apple / iPhone 13 / Blue          -> apple-iphone-13-blue
  Apple / iPhone 13 / Product Red   -> apple-iphone-13-product-red
  Apple / iPhone SE (2020) / Black  -> apple-iphone-se-2020-black
"""
import re
import unicodedata


def slugify(text: str) -> str:
    if not text:
        return ""
    # enleve les accents
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = text.replace("(", " ").replace(")", " ").replace("+", " ")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def image_name(brand: str, model: str, color: str) -> str:
    """Nom de fichier final (sans extension)."""
    parts = [slugify(brand), slugify(model)]
    c = slugify(color)
    if c and c not in ("sans-couleur", "default"):
        parts.append(c)
    return "-".join(p for p in parts if p)
