#!/usr/bin/env bash
# Un solo flujo: GCP bootstrap → .env.local → verify → Vercel env → build → verify dist.
#
# Uso (desde la raíz del repo):
#   CLIENT_ID='xxx.apps.googleusercontent.com' bash scripts/drive-oauth-one-shot.sh
#   bash scripts/drive-oauth-one-shot.sh 'xxx.apps.googleusercontent.com'
#   npm run drive:one-shot -- 'xxx.apps.googleusercontent.com'
#
# Opcional:
#   SKIP_VERCEL=1              — no ejecuta drive:vercel-env
#   OPEN_CONSOLE=1             — pasa --open a drive:bootstrap (solo macOS útil)
#
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

CLIENT_ID="${CLIENT_ID:-${1:-}}"
if [[ -z "$CLIENT_ID" ]]; then
  echo "Falta el Client ID de OAuth (tipo Web) de Google Cloud → Credenciales."
  echo ""
  echo "Ejemplos:"
  echo "  CLIENT_ID='123456-abc.apps.googleusercontent.com' npm run drive:one-shot"
  echo "  npm run drive:one-shot -- '123456-abc.apps.googleusercontent.com'"
  echo ""
  echo "Enlace: https://console.cloud.google.com/apis/credentials?project=chatbot-bmc-live"
  exit 1
fi

if [[ ! "$CLIENT_ID" =~ \.apps\.googleusercontent\.com$ ]]; then
  echo "El Client ID debe terminar en .apps.googleusercontent.com (no uses el ID del proyecto GCP)." >&2
  exit 1
fi

BOOT_ARGS=()
if [[ "${OPEN_CONSOLE:-}" == "1" ]]; then
  BOOT_ARGS+=(--open)
fi

echo "=== 1/6 drive:bootstrap (GCP Drive API + enlaces) ==="
if [[ ${#BOOT_ARGS[@]} -gt 0 ]]; then
  npm run drive:bootstrap -- "${BOOT_ARGS[@]}"
else
  npm run drive:bootstrap
fi

echo "=== 2/6 .env.local (VITE_GOOGLE_CLIENT_ID) ==="
node scripts/set-vite-google-client.mjs --set "$CLIENT_ID"

echo "=== 3/6 verify formato (env) ==="
npm run verify:google-drive-oauth

if [[ "${SKIP_VERCEL:-}" == "1" ]]; then
  echo "=== 4/6 Vercel (omitido: SKIP_VERCEL=1) ==="
else
  echo "=== 4/6 Vercel env (production + preview) ==="
  npm run drive:vercel-env -- "$CLIENT_ID" || {
    echo "[WARN] drive:vercel-env falló (¿vercel login / proyecto enlazado?). Corregí a mano en Vercel o reintentá." >&2
  }
fi

echo "=== 5/6 npm run build ==="
npm run build

echo "=== 6/6 verify Client ID en dist/ ==="
npm run verify:google-drive-dist

echo ""
echo "[OK] Flujo completo. Recordá: en Vercel hace falta Redeploy si el env cambió y el sitio sigue con bundle viejo."
echo "    Producción: https://calculadora-bmc.vercel.app"
