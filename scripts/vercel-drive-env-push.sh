#!/usr/bin/env bash
# Sube VITE_GOOGLE_CLIENT_ID al proyecto Vercel enlazado (requiere vercel CLI + login o VERCEL_TOKEN).
# Vite solo incrusta la variable en el próximo build: después ejecutá deploy o Redeploy en el dashboard.
#
# Uso:
#   npm run drive:vercel-env -- 'xxx.apps.googleusercontent.com'
#   VITE_GOOGLE_CLIENT_ID='xxx.apps.googleusercontent.com' npm run drive:vercel-env
#
# Solo production (default si no definís rama de preview):
#   ONLY_PROD=1 npm run drive:vercel-env -- 'xxx.apps.googleusercontent.com'
#
# Preview requiere una rama Git distinta de la Production Branch (p. ej. main en prod → no sirve para Preview).
# Si tu preview usa una rama concreta en Vercel:
#   VERCEL_PREVIEW_GIT_BRANCH=feat/mi-rama npm run drive:vercel-env -- 'xxx.apps.googleusercontent.com'
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

push_prod() {
  echo ""
  echo "=== Vercel env: VITE_GOOGLE_CLIENT_ID → production ==="
  vercel env add VITE_GOOGLE_CLIENT_ID production \
    --value "$CLIENT" \
    -y \
    --force \
    --non-interactive \
    --cwd "$REPO" || {
    echo "Fallo vercel env add (production). ¿Proyecto enlazado (.vercel)? ¿VERCEL_TOKEN o vercel login?" >&2
    exit 1
  }
}

push_preview_branch() {
  local branch="$1"
  echo ""
  echo "=== Vercel env: VITE_GOOGLE_CLIENT_ID → preview (rama: $branch) ==="
  vercel env add VITE_GOOGLE_CLIENT_ID preview "$branch" \
    --value "$CLIENT" \
    -y \
    --force \
    --non-interactive \
    --cwd "$REPO" || {
    echo "Fallo vercel env add (preview / $branch). ¿La rama existe en el remoto conectado a Vercel?" >&2
    exit 1
  }
}

push_prod

if [[ "${ONLY_PROD:-}" == "1" ]]; then
  echo ""
  echo "[OK] Solo production. Preview omitido (ONLY_PROD=1)."
elif [[ -n "${VERCEL_PREVIEW_GIT_BRANCH:-}" ]]; then
  push_preview_branch "$VERCEL_PREVIEW_GIT_BRANCH"
  echo ""
  echo "[OK] Variable actualizada en Vercel: production + preview ($VERCEL_PREVIEW_GIT_BRANCH)"
else
  echo ""
  echo "[INFO] Preview omitido: Vercel exige una rama Git para variables de Preview (no puede ser la Production Branch)."
  echo "       Para preview: VERCEL_PREVIEW_GIT_BRANCH=nombre-rama npm run drive:vercel-env -- '…'"
  echo "       O configurá Preview en el dashboard de Vercel."
  echo ""
  echo "[OK] Variable actualizada en Vercel: production"
fi

echo "  Siguiente paso: redeploy (p. ej. ./scripts/deploy-vercel.sh --prod) para que el bundle incluya el Client ID."
