#!/usr/bin/env bash
# Stack local para OAuth ML: ngrok (HTTPS) + API :3001 en un solo proceso.
# Uso: npm run ml:local   |   npm run ml:local -- --api-only
set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

API_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --api-only) API_ONLY=true ;;
  esac
done

bash scripts/ensure-env.sh

if [[ "$API_ONLY" == "true" ]]; then
  echo ""
  echo "=== API solamente (puerto 3001) ==="
  echo "Si ML exige https://, necesitás ngrok u otro túnel aparte."
  echo ""
  exec npm run start:api
fi

NGROK_BIN=""
if command -v ngrok >/dev/null 2>&1; then
  NGROK_BIN="ngrok"
else
  NGROK_BIN="npx --yes ngrok"
fi

echo ""
echo "=== ML local: ngrok + API (3001) ==="
echo ""
echo "1. Cuando ngrok levante, abrí http://127.0.0.1:4040 y copiá la URL https."
echo "2. En .env: ML_REDIRECT_URI_DEV=https://TU_HOST/auth/ml/callback"
echo "3. Misma URL en Mercado Libre → URLs de redirección."
echo "4. Navegador: /auth/ml/start en esa base (ver docs/ML-OAUTH-SETUP.md)."
echo ""
echo "Ctrl+C detiene ambos procesos."
echo ""

exec npx --yes concurrently -n ngrok,api -c yellow,blue \
  "$NGROK_BIN http 3001" \
  "node server/index.js"
