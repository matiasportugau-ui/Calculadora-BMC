#!/usr/bin/env bash
# Deploy Calculadora BMC to Vercel (calculadora-bmc.vercel.app)
# Requires: vercel CLI (npm i -g vercel)
# Set VITE_API_URL in Vercel project settings for "Cargar desde MATRIZ" to work.
# Drive (GIS): `npm run drive:vercel-env -- '<client-id>'` luego redeploy — ver docs/VERCEL-CALCULADORA-SETUP.md
#
# Usage: ./scripts/deploy-vercel.sh [--prod]

set -e
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

PROD=false
[[ "$1" == "--prod" ]] && PROD=true

# Canonical prod API (align with scripts/smoke-prod-api.mjs DEFAULT_BASE)
API_URL="${VITE_API_URL:-https://panelin-calc-q74zutv7dq-uc.a.run.app}"
echo ""
echo "=== Deploy Calculadora BMC to Vercel ==="
echo "  API URL (for Cargar desde MATRIZ): $API_URL"
echo ""

# Vite embeds VITE_* at build time; pass via env for this deploy
export VITE_API_URL="$API_URL"
export VITE_BASE="/"

if $PROD; then
  vercel --prod
else
  vercel
fi

echo ""
echo "  Production: https://calculadora-bmc.vercel.app"
echo "  (Set VITE_API_URL in Vercel dashboard for persistent config)"
echo ""
