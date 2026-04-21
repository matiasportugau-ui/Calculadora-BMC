#!/usr/bin/env bash
# Sube VITE_GOOGLE_CLIENT_ID al proyecto Vercel enlazado (requiere vercel CLI + login o VERCEL_TOKEN).
# Vite solo incrusta la variable en el próximo build: después ejecutá deploy o Redeploy en el dashboard.
#
# Uso:
#   npm run drive:vercel-env -- 'xxx.apps.googleusercontent.com'
#   VITE_GOOGLE_CLIENT_ID='xxx.apps.googleusercontent.com' npm run drive:vercel-env
#
# Solo production:
#   ONLY_PROD=1 npm run drive:vercel-env -- 'xxx.apps.googleusercontent.com'
#
set -e
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

if ! command -v vercel &>/dev/null; then
  echo "No se encontró vercel. Instalación: npm i -g vercel" >&2
  exit 1
fi

CLIENT="${1:-${VITE_GOOGLE_CLIENT_ID:-}}"
if [[ -z "$CLIENT" ]]; then
  echo "Uso: npm run drive:vercel-env -- '<client-id>.apps.googleusercontent.com'" >&2
  echo "  o: VITE_GOOGLE_CLIENT_ID='…' npm run drive:vercel-env" >&2
  exit 1
fi

if [[ ! "$CLIENT" =~ \.apps\.googleusercontent\.com$ ]]; then
  echo "El Client ID debe terminar en .apps.googleusercontent.com" >&2
  exit 1
fi

ENVS=(production preview)
if [[ "${ONLY_PROD:-}" == "1" ]]; then
  ENVS=(production)
fi

for e in "${ENVS[@]}"; do
  echo ""
  echo "=== Vercel env: VITE_GOOGLE_CLIENT_ID → $e ==="
  vercel env add VITE_GOOGLE_CLIENT_ID "$e" \
    --value "$CLIENT" \
    -y \
    --force \
    --cwd "$REPO" || {
    echo "Fallo vercel env add ($e). ¿Proyecto enlazado (.vercel)? ¿VERCEL_TOKEN o vercel login?" >&2
    exit 1
  }
done

echo ""
echo "[OK] Variable actualizada en Vercel para: ${ENVS[*]}"
echo "  Siguiente paso: redeploy (p. ej. ./scripts/deploy-vercel.sh --prod) para que el bundle incluya el Client ID."
