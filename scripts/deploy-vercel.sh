#!/usr/bin/env bash
# Deploy Calculadora BMC to Vercel (calculadora-bmc.vercel.app)
# Requires: vercel CLI (npm i -g vercel)
# Set VITE_API_URL in Vercel project settings for "Cargar desde MATRIZ" to work.
#
# Usage: ./scripts/deploy-vercel.sh [--prod]

set -e
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

PROD=false
[[ "$1" == "--prod" ]] && PROD=true

API_URL="${VITE_API_URL:-https://panelin-calc-642127786762.us-central1.run.app}"
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
