"""Sources d'images gratuites : DuckDuckGo Images (primaire) + Wikimedia (fallback)."""
import time
import requests
from ddgs import DDGS

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"


def ddg_images(query, max_results=25, pause=1.5):
    """Retourne une liste de candidates {url,width,height,source,title}."""
    out = []
    try:
        with DDGS() as d:
            for r in d.images(query, max_results=max_results, safesearch="off"):
                out.append({
                    "url": r.get("image"),
                    "width": int(r.get("width") or 0),
                    "height": int(r.get("height") or 0),
                    "source": (r.get("source") or r.get("url") or ""),
                    "title": r.get("title") or "",
                })
    except Exception as e:
        print(f"    [ddg] erreur: {type(e).__name__}: {e}")
    time.sleep(pause)
    return out


def wikimedia_images(query, max_results=8):
    """Fallback : recherche d'images sur Wikimedia Commons (licences libres)."""
    out = []
    try:
        api = "https://commons.wikimedia.org/w/api.php"
        params = {
            "action": "query", "format": "json", "generator": "search",
            "gsrsearch": f"{query} filetype:bitmap", "gsrnamespace": 6,
            "gsrlimit": max_results, "prop": "imageinfo",
            "iiprop": "url|size", "iiurlwidth": 1200,
        }
        r = requests.get(api, params=params, headers={"User-Agent": UA}, timeout=20)
        data = r.json().get("query", {}).get("pages", {})
        for p in data.values():
            ii = (p.get("imageinfo") or [{}])[0]
            if ii.get("url"):
                out.append({
                    "url": ii["url"], "width": int(ii.get("width") or 0),
                    "height": int(ii.get("height") or 0),
                    "source": "commons.wikimedia.org", "title": p.get("title", ""),
                })
    except Exception as e:
        print(f"    [wikimedia] erreur: {type(e).__name__}: {e}")
    return out


def download(url, timeout=20, max_bytes=20_000_000):
    """Télécharge l'image. Retourne bytes ou None."""
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=timeout, stream=True)
        if r.status_code != 200:
            return None
        ct = r.headers.get("content-type", "")
        if "image" not in ct and not url.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            return None
        data = b""
        for chunk in r.iter_content(65536):
            data += chunk
            if len(data) > max_bytes:
                return None
        return data
    except Exception:
        return None
