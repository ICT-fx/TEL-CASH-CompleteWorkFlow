# RAPPORT PHOTOS — TEL & CASH

Source : mapping front (`src/lib/modelImages.ts`) + blocklist (`src/lib/imageBlocklist.ts`) + fichiers `public/images/`. Généré par `scripts/make-photos-report.mjs`.

**Bilan : 362 couples modèle×couleur mappés** — ✅ 342 vraie photo · ⚠️ 20 placeholder neutre · ❌ 0 fichier manquant.

Règles appliquées (mode strict) :
- Photo affichée seulement si packshot officiel **transparent** de CE modèle et CETTE couleur (exact ou alias sûr). Sinon silhouette neutre.
- Au moindre doute sur le modèle/la couleur → **placeholder**, jamais la photo d’un autre modèle/couleur.
- Listing et fiche utilisent EXACTEMENT la même résolution d’image.

## 🔴 Incohérences détectées et corrigées — audit du 2026-06-24

Photos importées le 15/06 (commits `d9ec500` / `922ceb6` / `c0d6245`) montrant un **mauvais modèle ou une mauvaise couleur** — vérifiées visuellement une à une, désormais forcées en placeholder (aucune version correcte dans l’historique git). À remplacer par un vrai packshot.

| Modèle × couleur | Fichier | Ce qui était affiché à tort |
|---|---|---|
| Apple Iphone 8 · Product Red | `apple-iphone-8-product-red.png` | composite incluant un iPhone **8 Plus** (double caméra) |
| Google Pixel 7a 5g · White | `google-pixel-7a-5g-white.png` | montre un Pixel **7 Pro** (module pleine largeur), pas un 7a |
| Google Pixel 9 Pro Xl 5g · Grey | `google-pixel-9-pro-xl-5g-grey.png` | montre un Pixel 9 Pro **Fold** (pliable), pas un Pro XL |
| Samsung Galaxy A56 5g · Black | `samsung-galaxy-a56-5g-black.png` | montre un Galaxy **A55** (objectifs séparés), pas l’A56 |
| Samsung Galaxy S22 5g · Grey | `samsung-galaxy-s22-5g-grey.png` | montre un Galaxy **S21**, pas le S22 |
| Samsung Galaxy S25 Edge 5g · Ice Blue | `samsung-galaxy-s25-edge-5g-ice-blue.png` | S25 **classique** (triple objectif), pas l’Edge (double) |
| Samsung Galaxy S25 Ultra 5g · Green | `samsung-galaxy-s25-ultra-5g-green.png` | appareil **noir**, pas vert |
| Samsung Galaxy S26 Plus 5g · Silver | `samsung-galaxy-s26-plus-5g-silver.png` | châssis **quad-objectif type Ultra**, pas un S26+ |
| Samsung Galaxy Z Flip4 5g · Rose Gold | `samsung-galaxy-z-flip4-5g-rose-gold.png` | montre un **Flip6 argent**, pas un Flip4 rose gold |
| Samsung Galaxy Z Fold7 5g · Green | `samsung-galaxy-z-fold7-5g-green.png` | render **Fold3** (watermark OnLeaks), pas un Fold7 |
| Xiaomi 14 Pro 5g · Black | `xiaomi-14-pro-5g-black.png` | montre un **Redmi**, pas le Xiaomi 14 Pro Leica |
| Google Pixel 9 Pro Fold 5g · Black | `google-pixel-9-pro-fold-5g-black.png` | montre un Pixel **classique** (barre photo), pas un Fold |
| Xiaomi 17 Ultra 5g · Black | `xiaomi-17-ultra-5g-black.png` | Xiaomi **17 standard**, pas le 17 Ultra (module Leica) |

## Catalogue complet (couples mappés)

### Apple

| Modèle | Couleur | État |
|---|---|---|
| Iphone 11 | Black | ✅ |
| Iphone 11 | Green | ✅ |
| Iphone 11 | Product Red | ✅ |
| Iphone 11 | Purple | ✅ |
| Iphone 11 | White | ✅ |
| Iphone 11 | Yellow | ✅ |
| Iphone 11 Pro | Gold | ✅ |
| Iphone 11 Pro | Midnight Green | ✅ |
| Iphone 11 Pro | Silver | ✅ |
| Iphone 11 Pro Max | Gold | ✅ |
| Iphone 11 Pro Max | Midnight Green | ✅ |
| Iphone 11 Pro Max | Silver | ✅ |
| Iphone 12 | Black | ✅ |
| Iphone 12 | Blue | ✅ |
| Iphone 12 | Green | ✅ |
| Iphone 12 | Product Red | ✅ |
| Iphone 12 | Purple | ⚠️ |
| Iphone 12 | White | ✅ |
| Iphone 12 Mini | Black | ✅ |
| Iphone 12 Mini | Blue | ✅ |
| Iphone 12 Mini | Green | ✅ |
| Iphone 12 Mini | Product Red | ✅ |
| Iphone 12 Mini | Purple | ⚠️ |
| Iphone 12 Mini | White | ✅ |
| Iphone 12 Pro | Blue | ✅ |
| Iphone 12 Pro | Gold | ✅ |
| Iphone 12 Pro | Graphite | ✅ |
| Iphone 12 Pro Max | Blue | ✅ |
| Iphone 12 Pro Max | Gold | ✅ |
| Iphone 12 Pro Max | Graphite | ✅ |
| Iphone 12 Pro Max | Silver | ✅ |
| Iphone 13 | Blue | ✅ |
| Iphone 13 | Green | ⚠️ |
| Iphone 13 | Midnight | ✅ |
| Iphone 13 | Pink | ✅ |
| Iphone 13 | Product Red | ✅ |
| Iphone 13 | Starlight | ✅ |
| Iphone 13 Mini | Blue | ✅ |
| Iphone 13 Mini | Green | ⚠️ |
| Iphone 13 Mini | Midnight | ✅ |
| Iphone 13 Mini | Pink | ✅ |
| Iphone 13 Mini | Product Red | ✅ |
| Iphone 13 Mini | Starlight | ✅ |
| Iphone 13 Pro | Alpine Green | ⚠️ |
| Iphone 13 Pro | Gold | ✅ |
| Iphone 13 Pro | Graphite | ✅ |
| Iphone 13 Pro | Sierra Blue | ✅ |
| Iphone 13 Pro | Silver | ✅ |
| Iphone 13 Pro Max | Alpine Green | ⚠️ |
| Iphone 13 Pro Max | Gold | ✅ |
| Iphone 13 Pro Max | Graphite | ✅ |
| Iphone 13 Pro Max | Sierra Blue | ✅ |
| Iphone 13 Pro Max | Silver | ✅ |
| Iphone 14 | Blue | ✅ |
| Iphone 14 | Midnight | ✅ |
| Iphone 14 | Product Red | ✅ |
| Iphone 14 | Purple | ✅ |
| Iphone 14 | Starlight | ✅ |
| Iphone 14 | Yellow | ✅ |
| Iphone 14 Plus | Blue | ✅ |
| Iphone 14 Plus | Midnight | ✅ |
| Iphone 14 Plus | Product Red | ✅ |
| Iphone 14 Plus | Purple | ✅ |
| Iphone 14 Plus | Starlight | ✅ |
| Iphone 14 Plus | Yellow | ✅ |
| Iphone 14 Pro | Deep Purple | ✅ |
| Iphone 14 Pro | Gold | ✅ |
| Iphone 14 Pro | Silver | ✅ |
| Iphone 14 Pro | Space Black | ✅ |
| Iphone 14 Pro Max | Deep Purple | ✅ |
| Iphone 14 Pro Max | Gold | ✅ |
| Iphone 14 Pro Max | Silver | ✅ |
| Iphone 14 Pro Max | Space Black | ✅ |
| Iphone 15 | Black | ✅ |
| Iphone 15 | Blue | ✅ |
| Iphone 15 | Green | ✅ |
| Iphone 15 | Pink | ✅ |
| Iphone 15 | Yellow | ✅ |
| Iphone 15 Plus | Black | ✅ |
| Iphone 15 Plus | Blue | ✅ |
| Iphone 15 Plus | Green | ✅ |
| Iphone 15 Plus | Pink | ✅ |
| Iphone 15 Plus | Yellow | ✅ |
| Iphone 15 Pro | Black Titanium | ✅ |
| Iphone 15 Pro | Blue Titanium | ✅ |
| Iphone 15 Pro | Natural Titanium | ✅ |
| Iphone 15 Pro | White Titanium | ✅ |
| Iphone 15 Pro Max | Black Titanium | ✅ |
| Iphone 15 Pro Max | Blue Titanium | ✅ |
| Iphone 15 Pro Max | Natural Titanium | ✅ |
| Iphone 15 Pro Max | White Titanium | ✅ |
| Iphone 16 | Black | ✅ |
| Iphone 16 | Pink | ✅ |
| Iphone 16 | Teal | ✅ |
| Iphone 16 | Ultramarine | ✅ |
| Iphone 16 | White | ✅ |
| Iphone 16 Plus | Black | ✅ |
| Iphone 16 Plus | Pink | ✅ |
| Iphone 16 Plus | Teal | ✅ |
| Iphone 16 Plus | Ultramarine | ✅ |
| Iphone 16 Plus | White | ✅ |
| Iphone 16 Pro | Black Titanium | ✅ |
| Iphone 16 Pro | Desert Titanium | ✅ |
| Iphone 16 Pro | Natural Titanium | ✅ |
| Iphone 16 Pro | White Titanium | ✅ |
| Iphone 16 Pro Max | Black Titanium | ✅ |
| Iphone 16 Pro Max | Desert Titanium | ✅ |
| Iphone 16 Pro Max | Natural Titanium | ✅ |
| Iphone 16 Pro Max | White Titanium | ✅ |
| Iphone 16e | Black | ✅ |
| Iphone 17 | Black | ✅ |
| Iphone 17 | Blue | ✅ |
| Iphone 17 | Green | ✅ |
| Iphone 17 | Purple | ✅ |
| Iphone 17 | White | ✅ |
| Iphone 17 Pro | Blue | ✅ |
| Iphone 17 Pro | Orange | ✅ |
| Iphone 17 Pro | Silver | ✅ |
| Iphone 17 Pro Max | Blue | ✅ |
| Iphone 17 Pro Max | Orange | ✅ |
| Iphone 17e | Black | ✅ |
| Iphone 17e | White | ✅ |
| Iphone 7 | Black | ✅ |
| Iphone 7 | Gold | ✅ |
| Iphone 7 | Jet Black | ✅ |
| Iphone 7 | Rose Gold | ✅ |
| Iphone 7 | Silver | ✅ |
| Iphone 8 | Gold | ✅ |
| Iphone 8 | Product Red | ⚠️ |
| Iphone 8 | Silver | ✅ |
| Iphone Air | Black | ✅ |
| Iphone Air | Blue | ✅ |
| Iphone Air | Gold | ✅ |
| Iphone Air | White | ✅ |
| Iphone Se (2022) | Red | ✅ |
| Iphone Se (2022) | White | ✅ |
| Iphone Se (2nd Generation) | Black | ✅ |
| Iphone Se (2nd Generation) | Product Red | ✅ |
| Iphone Se (2nd Generation) | White | ✅ |
| Iphone Se (3rd Generation) | Midnight | ⚠️ |
| Iphone Se (3rd Generation) | Product Red | ✅ |
| Iphone Se (3rd Generation) | Starlight | ✅ |
| Iphone X | Silver | ✅ |
| Iphone Xr | Black | ✅ |
| Iphone Xr | Blue | ✅ |
| Iphone Xr | Coral | ✅ |
| Iphone Xr | Product Red | ✅ |
| Iphone Xr | White | ✅ |
| Iphone Xr | Yellow | ✅ |
| Iphone Xs | Gold | ✅ |
| Iphone Xs | Silver | ✅ |
| Iphone Xs Max | Gold | ✅ |
| Iphone Xs Max | Silver | ✅ |

### Google

| Modèle | Couleur | État |
|---|---|---|
| Pixel 10 5g | Black | ✅ |
| Pixel 10 5g | Blue | ✅ |
| Pixel 10 Pro 5g | Black | ✅ |
| Pixel 10 Pro 5g | Blue | ✅ |
| Pixel 10 Pro 5g | White | ✅ |
| Pixel 10 Pro Xl 5g | Blue | ✅ |
| Pixel 10a 5g | Black | ✅ |
| Pixel 7 5g | Black | ✅ |
| Pixel 7 Pro 5g | White | ✅ |
| Pixel 7a 5g | Blue | ✅ |
| Pixel 7a 5g | White | ⚠️ |
| Pixel 8 5g | Pink | ✅ |
| Pixel 8 Pro 5g | Black | ✅ |
| Pixel 8 Pro 5g | Blue | ✅ |
| Pixel 8 Pro 5g | White | ✅ |
| Pixel 8a 5g | Beige | ✅ |
| Pixel 8a 5g | Blue | ✅ |
| Pixel 9 5g | Black | ✅ |
| Pixel 9 Pro 5g | Pink | ✅ |
| Pixel 9 Pro Fold 5g | Black | ⚠️ |
| Pixel 9 Pro Xl 5g | Grey | ⚠️ |
| Pixel 9a 5g | Purple | ✅ |

### OnePlus

| Modèle | Couleur | État |
|---|---|---|
| 13 5g | Black | ✅ |
| 13 5g | Blue | ✅ |
| 13r 5g | Silver | ✅ |
| 15 5g | Black | ✅ |
| Nord 5 5g | Grey | ✅ |
| Nord 5 5g | Ice Blue | ✅ |
| Nord Ce 5 5g | Black | ✅ |
| Nord Ce 5 5g | White | ✅ |

### Samsung

| Modèle | Couleur | État |
|---|---|---|
| Galaxy A54 | Blanc | ✅ |
| Galaxy A54 5g | Black | ✅ |
| Galaxy A54 5g | Green | ✅ |
| Galaxy A54 5g | White | ✅ |
| Galaxy A55 5g | Ice Blue | ✅ |
| Galaxy A55 5g | Purple | ✅ |
| Galaxy A55 5g | Yellow | ✅ |
| Galaxy A56 5g | Black | ⚠️ |
| Galaxy A56 5g | Green | ✅ |
| Galaxy A56 5g | Pink | ✅ |
| Galaxy A73 5g | Grey | ✅ |
| Galaxy S21 Fe 5g | Black | ✅ |
| Galaxy S21 Fe 5g | Graphite | ✅ |
| Galaxy S21 Fe 5g | Green | ✅ |
| Galaxy S21 Fe 5g | Purple | ✅ |
| Galaxy S21 Fe 5g | White | ✅ |
| Galaxy S21 Plus | Black | ✅ |
| Galaxy S21 Plus | Gold | ✅ |
| Galaxy S21 Plus | Purple | ✅ |
| Galaxy S21 Plus | Red | ✅ |
| Galaxy S21 Plus | Silver | ✅ |
| Galaxy S21 Ultra 5g | Black | ✅ |
| Galaxy S21 Ultra 5g | Grey | ✅ |
| Galaxy S21 Ultra 5g | Silver | ✅ |
| Galaxy S22 5g | Grey | ⚠️ |
| Galaxy S22 5g | Pink | ✅ |
| Galaxy S22 5g | Purple | ✅ |
| Galaxy S22 5g | White | ✅ |
| Galaxy S22 Plus 5g | Black | ✅ |
| Galaxy S22 Plus 5g | Blue | ✅ |
| Galaxy S22 Plus 5g | Grey | ✅ |
| Galaxy S22 Plus 5g | Pink | ✅ |
| Galaxy S22 Plus 5g | White | ✅ |
| Galaxy S22 Ultra 5g | Black | ✅ |
| Galaxy S22 Ultra 5g | Graphite | ✅ |
| Galaxy S22 Ultra 5g | White | ✅ |
| Galaxy S23 | Vert | ✅ |
| Galaxy S23 5g | Black | ✅ |
| Galaxy S23 5g | Green | ✅ |
| Galaxy S23 5g | Lime | ✅ |
| Galaxy S23 5g | Purple | ✅ |
| Galaxy S23 Fe 5g | Beige | ✅ |
| Galaxy S23 Fe 5g | Graphite | ✅ |
| Galaxy S23 Fe 5g | Green | ✅ |
| Galaxy S23 Fe 5g | Purple | ✅ |
| Galaxy S23 Plus 5g | Beige | ✅ |
| Galaxy S23 Ultra 5g | Beige | ✅ |
| Galaxy S23 Ultra 5g | Blue | ✅ |
| Galaxy S23 Ultra 5g | Green | ✅ |
| Galaxy S23 Ultra 5g | Lime | ✅ |
| Galaxy S23 Ultra 5g | Purple | ✅ |
| Galaxy S23 Ultra 5g | Red | ✅ |
| Galaxy S24 5g | Yellow | ✅ |
| Galaxy S24 Fe 5g | Mint | ✅ |
| Galaxy S24 Plus 5g | Black | ✅ |
| Galaxy S24 Plus 5g | Blue | ✅ |
| Galaxy S24 Plus 5g | Green | ✅ |
| Galaxy S24 Plus 5g | Yellow | ✅ |
| Galaxy S24 Ultra | Noir | ✅ |
| Galaxy S24 Ultra 5g | Black | ✅ |
| Galaxy S24 Ultra 5g | Blue | ✅ |
| Galaxy S24 Ultra 5g | Purple | ✅ |
| Galaxy S24 Ultra 5g | Yellow | ✅ |
| Galaxy S25 5g | Black | ✅ |
| Galaxy S25 5g | Blue | ✅ |
| Galaxy S25 5g | Ice Blue | ✅ |
| Galaxy S25 5g | Mint | ✅ |
| Galaxy S25 5g | Pink | ✅ |
| Galaxy S25 5g | Silver | ✅ |
| Galaxy S25 Edge 5g | Ice Blue | ⚠️ |
| Galaxy S25 Edge 5g | Jet Black | ✅ |
| Galaxy S25 Edge 5g | Silver | ✅ |
| Galaxy S25 Fe 5g | Black | ✅ |
| Galaxy S25 Fe 5g | Blue | ✅ |
| Galaxy S25 Fe 5g | Ice Blue | ✅ |
| Galaxy S25 Plus 5g | Mint | ✅ |
| Galaxy S25 Plus 5g | Pink | ✅ |
| Galaxy S25 Ultra 5g | Blue | ✅ |
| Galaxy S25 Ultra 5g | Green | ⚠️ |
| Galaxy S25 Ultra 5g | Grey | ✅ |
| Galaxy S25 Ultra 5g | Jet Black | ✅ |
| Galaxy S25 Ultra 5g | Pink | ✅ |
| Galaxy S25 Ultra 5g | Silver | ✅ |
| Galaxy S26 5g | Black | ✅ |
| Galaxy S26 5g | Purple | ✅ |
| Galaxy S26 5g | Silver | ✅ |
| Galaxy S26 5g | White | ✅ |
| Galaxy S26 Plus 5g | Purple | ✅ |
| Galaxy S26 Plus 5g | Silver | ⚠️ |
| Galaxy S26 Plus 5g | White | ✅ |
| Galaxy S26 Ultra 5g | Black | ✅ |
| Galaxy S26 Ultra 5g | Blue | ✅ |
| Galaxy S26 Ultra 5g | Pink | ✅ |
| Galaxy S26 Ultra 5g | Purple | ✅ |
| Galaxy S26 Ultra 5g | Silver | ✅ |
| Galaxy S26 Ultra 5g | White | ✅ |
| Galaxy Z Flip3 5g | Beige | ✅ |
| Galaxy Z Flip3 5g | Black | ✅ |
| Galaxy Z Flip3 5g | Green | ✅ |
| Galaxy Z Flip3 5g | Purple | ✅ |
| Galaxy Z Flip4 5g | Graphite | ✅ |
| Galaxy Z Flip4 5g | Grey | ✅ |
| Galaxy Z Flip4 5g | Purple | ✅ |
| Galaxy Z Flip4 5g | Rose Gold | ⚠️ |
| Galaxy Z Flip5 5g | Graphite | ✅ |
| Galaxy Z Flip5 5g | Grey | ✅ |
| Galaxy Z Flip5 5g | Mint | ✅ |
| Galaxy Z Flip5 5g | Purple | ✅ |
| Galaxy Z Flip6 5g | Blue | ✅ |
| Galaxy Z Flip6 5g | Green | ✅ |
| Galaxy Z Flip6 5g | Silver | ✅ |
| Galaxy Z Flip6 5g | Yellow | ✅ |
| Galaxy Z Flip7 5g | Blue | ✅ |
| Galaxy Z Flip7 5g | Jet Black | ✅ |
| Galaxy Z Flip7 5g | Mint | ✅ |
| Galaxy Z Flip7 5g | Red | ✅ |
| Galaxy Z Flip7 Fe 5g | Black | ✅ |
| Galaxy Z Flip7 Fe 5g | White | ✅ |
| Galaxy Z Fold3 5g | Black | ✅ |
| Galaxy Z Fold3 5g | Green | ✅ |
| Galaxy Z Fold3 5g | Silver | ✅ |
| Galaxy Z Fold4 5g | Beige | ✅ |
| Galaxy Z Fold4 5g | Black | ✅ |
| Galaxy Z Fold4 5g | Grey | ✅ |
| Galaxy Z Fold6 5g | Black | ✅ |
| Galaxy Z Fold6 5g | Blue | ✅ |
| Galaxy Z Fold6 5g | Silver | ✅ |
| Galaxy Z Fold7 5g | Blue | ✅ |
| Galaxy Z Fold7 5g | Green | ⚠️ |
| S24 | Noir | ✅ |

### Xiaomi

| Modèle | Couleur | État |
|---|---|---|
| 13 5g | Green | ✅ |
| 13 Lite 5g | Black | ✅ |
| 13 Lite 5g | Blue | ✅ |
| 13 Ultra 5g | Black | ✅ |
| 13 Ultra 5g | White | ✅ |
| 13t 5g | Black | ✅ |
| 13t Pro 5g | Black | ✅ |
| 13t Pro 5g | Blue | ✅ |
| 14 Pro 5g | Black | ⚠️ |
| 14 Ultra 5g | White | ✅ |
| 14t 5g | Black | ✅ |
| 14t 5g | Blue | ✅ |
| 14t 5g | Green | ✅ |
| 14t 5g | Grey | ✅ |
| 14t Pro 5g | Black | ✅ |
| 14t Pro 5g | Grey | ✅ |
| 15 5g | Black | ✅ |
| 15 5g | Green | ✅ |
| 15 5g | Silver | ✅ |
| 15 5g | White | ✅ |
| 15 Ultra 5g | Black | ✅ |
| 15 Ultra 5g | Silver | ✅ |
| 15t 5g | Black | ✅ |
| 15t Pro 5g | Black | ✅ |
| 17 Ultra 5g | Black | ⚠️ |
| 17 Ultra 5g | White | ✅ |
| Poco C65 | Black | ✅ |
| Poco M4 Pro 5g | Blue | ✅ |
| Poco M4 Pro 5g | Yellow | ✅ |
| Poco X5 Pro 5g | Yellow | ✅ |
| Redmi 12 5g | Black | ✅ |
| Redmi 14c | Blue | ✅ |
| Redmi 15 | Black | ✅ |
| Redmi 15c 4g | Black | ✅ |
| Redmi A5 | Black | ✅ |
| Redmi A5 | Gold | ✅ |
| Redmi Note 12 Pro 4g | Grey | ✅ |
| Redmi Note 12 Pro 5g | Black | ✅ |
| Redmi Note 12 Pro 5g | Blue | ✅ |
| Redmi Note 13 5g | Black | ✅ |
| Redmi Note 13 Pro 5g | Black | ✅ |
| Redmi Note 13 Pro 5g | Teal | ✅ |
| Redmi Note 14 5g | Black | ✅ |
| Redmi Note 14 5g | Blue | ✅ |
| Redmi Note 14 Pro 5g | Black | ✅ |
| Xiaomi 12 5g | Grey | ✅ |
| Xiaomi 12 5g | Purple | ✅ |
| Xiaomi 12 Pro 5g | Grey | ✅ |
| Xiaomi 12t 5g | Black | ✅ |

---

_Légende : ✅ vraie photo (modèle+couleur vérifiés) · ⚠️ placeholder neutre (photo absente, « pas pro », ou mauvais modèle/couleur retiré) · ❌ fichier mappé mais manquant._

> Les couples modèle×couleur présents en base mais **absents de ce mapping** s’affichent aussi en placeholder neutre (non listés ici : ce rapport couvre le mapping front).
