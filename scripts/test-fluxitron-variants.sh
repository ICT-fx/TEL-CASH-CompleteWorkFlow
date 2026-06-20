#!/usr/bin/env bash
# Test du correctif multi-variantes du connecteur Fluxitron.
# Simule la séquence d'appels de Fluxitron sur un produit JETABLE (marqueur ZZTEST).
#
# Prérequis : le serveur de dev tourne  ->  npm run dev   (http://localhost:3000)
# Lancement  :  bash scripts/test-fluxitron-variants.sh
#
# Les lignes créées portent brand='ZZTEST' : Claude les vérifie puis les supprime.
set -euo pipefail

BASE="${BASE_URL:-http://localhost:3000}/api/v1"

# Récupère la clé API depuis .env.local (ou l'environnement).
KEY="${FLUXITRON_API_KEY:-$(grep -E '^FLUXITRON_API_KEY=' .env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'"'')}"
if [ -z "${KEY:-}" ]; then echo "❌ FLUXITRON_API_KEY introuvable (.env.local)"; exit 1; fi

H_AUTH=(-H "X-Api-Key: ${KEY}")
H_JSON=(-H "Content-Type: application/json")
# Affiche joliment si JSON, sinon le texte brut (pour voir les erreurs HTML/vides).
show() { python3 -c "import sys,json;b=sys.stdin.read();print(json.dumps(json.loads(b),indent=2,ensure_ascii=False)) if b.strip() and b.lstrip()[:1] in '{[' else print('CORPS BRUT >>>',repr(b))"; }
jqid() { python3 -c "import sys,json
try:
 d=json.load(sys.stdin);print(d.get('id') or '')
except Exception:
 print('')"; }
jqcount() { python3 -c "import sys,json
try:
 d=json.load(sys.stdin);print(len(d.get('variants',[])))
except Exception:
 print('-1')"; }

echo "=== Préflight : le serveur répond-il ? ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" "${H_AUTH[@]}" "$BASE/products?limit=1" || echo "000")
echo "→ HTTP $CODE sur $BASE/products"
if [ "$CODE" = "000" ]; then echo "❌ Serveur injoignable. Lance : npm run dev DANS CE projet (et garde-le ouvert)."; exit 1; fi
if [ "$CODE" = "401" ] || [ "$CODE" = "403" ]; then echo "❌ Auth refusée (clé API). Vérifie FLUXITRON_API_KEY dans .env.local."; exit 1; fi
if [ "$CODE" = "404" ]; then echo "❌ 404 : ce n'est PAS le bon serveur (route /api/v1 absente). Un AUTRE projet tourne sur ce port. Lance 'npm run dev' depuis CE dossier et relance avec BASE_URL=http://localhost:<port_affiché>."; exit 1; fi
if [ "$CODE" != "200" ]; then echo "⚠️ Réponse inattendue (HTTP $CODE) — on continue mais vérifie."; fi
echo "✅ Serveur OK (clé acceptée)"; echo

echo "=== 1) Créer un produit avec 1 variante (Grade A / Black) ==="
RESP=$(curl -s "${H_AUTH[@]}" "${H_JSON[@]}" -X POST "$BASE/products" -d '{
  "title": "ZZTEST Apple iPhoneTEST 128GB",
  "variants": [
    { "sku": "ZZTEST-001", "price": 100, "inventoryQuantity": 1, "options": { "Grade": "A", "Couleur": "Black" } }
  ]
}')
echo "$RESP" | show
PARENT=$(echo "$RESP" | jqid)
echo "→ parentId = $PARENT"
[ -n "$PARENT" ] || { echo "❌ pas de parent créé"; exit 1; }

echo; echo "=== 2) Ajouter une 2ᵉ variante (Grade B / Blue) — doit CRÉER une sœur, pas écraser ==="
RESP2=$(curl -s "${H_AUTH[@]}" "${H_JSON[@]}" -X POST "$BASE/products/$PARENT/variants" -d '{
  "sku": "ZZTEST-002", "price": 120, "inventoryQuantity": 2, "title": "Grade B",
  "options": { "Grade": "B", "Couleur": "Blue" }
}')
echo "$RESP2" | show
VAR2=$(echo "$RESP2" | jqid)
echo "→ variantId 2 = $VAR2"
if [ "$VAR2" = "$PARENT" ]; then echo "❌ ÉCHEC : la 2ᵉ variante a le MÊME id que le parent (overwrite)"; else echo "✅ id distinct du parent (sœur créée)"; fi

echo; echo "=== 3) GET du produit — doit montrer 2 variantes ==="
RESP3=$(curl -s "${H_AUTH[@]}" "$BASE/products/$PARENT")
echo "$RESP3" | show
N=$(echo "$RESP3" | jqcount)
echo "→ nb variantes = $N"; [ "$N" = "2" ] && echo "✅ 2 variantes" || echo "❌ attendu 2, obtenu $N"

echo; echo "=== 4) Idempotence : re-POST de ZZTEST-002 (prix 130) — doit METTRE À JOUR, pas dupliquer ==="
curl -s "${H_AUTH[@]}" "${H_JSON[@]}" -X POST "$BASE/products/$PARENT/variants" -d '{
  "sku": "ZZTEST-002", "price": 130, "inventoryQuantity": 5, "title": "Grade B",
  "options": { "Grade": "B", "Couleur": "Blue" }
}' >/dev/null
RESP4=$(curl -s "${H_AUTH[@]}" "$BASE/products/$PARENT")
N2=$(echo "$RESP4" | jqcount)
echo "→ nb variantes après re-POST = $N2"; [ "$N2" = "2" ] && echo "✅ toujours 2 (pas de doublon)" || echo "❌ doublon : $N2 variantes"

echo; echo "=== Terminé. parentId=$PARENT — donne ce parentId à Claude pour vérif DB + nettoyage. ==="
