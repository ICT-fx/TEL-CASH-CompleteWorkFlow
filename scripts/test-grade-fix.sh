#!/usr/bin/env bash
# Vérifie que le grade d'une variante vient de LA VARIANTE, pas du parent.
# Piège : métafield parent appearance=A+ et tag grade-a+ ; une variante n'a PAS
# de grade propre → elle ne doit PAS hériter A+ (doit rester sans grade).
# Prérequis : npm run dev. Lancement : BASE_URL=http://localhost:3001 bash scripts/test-grade-fix.sh
set -euo pipefail
BASE="${BASE_URL:-http://localhost:3000}/api/v1"
KEY="${FLUXITRON_API_KEY:-$(grep -E '^FLUXITRON_API_KEY=' .env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'"'')}"
[ -n "${KEY:-}" ] || { echo "❌ FLUXITRON_API_KEY introuvable"; exit 1; }

echo "=== POST produit multi-variante : 1 variante Grade A + 1 variante SANS grade (piège appearance=A+) ==="
curl -s -H "X-Api-Key: $KEY" -H "Content-Type: application/json" -X POST "$BASE/products" -d '{
  "title": "ZZGRADE Apple iPhone14TEST 128GB",
  "tags": ["grade-a+", "refurbished"],
  "metafields": [{"key":"appearance","value":"A+","namespace":"custom","type":"single_line_text_field"}],
  "variants": [
    {"sku":"ZZGRADE-A","price":300,"inventoryQuantity":1,"options":{"Grade":"A","Couleur":"Black"}},
    {"sku":"ZZGRADE-NONE","price":61,"inventoryQuantity":1,"options":{"Couleur":"White"}}
  ]
}' | python3 -c "import sys,json;d=json.load(sys.stdin);print('parentId =',d.get('id'));[print(' -',v['sku'],'-> Grade =',v['options'].get('Grade','(aucun)')) for v in d.get('variants',[])]"

echo; echo "→ Attendu : ZZGRADE-A = A  |  ZZGRADE-NONE = (aucun grade)  → Claude vérifie is_active en base."
