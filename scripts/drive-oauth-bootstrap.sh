#!/usr/bin/env bash
# Habilita Drive API en GCP y muestra enlaces a Consentimiento / Credenciales.
# Requiere: gcloud instalado y proyecto configurado (o GOOGLE_CLOUD_PROJECT).
#
# Uso:
#   npm run drive:bootstrap
#   npm run drive:bootstrap -- --open    # macOS: abre Consola → Credenciales
#
set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

OPEN=0
for a in "$@"; do
  if [[ "$a" == "--open" || "$a" == "-o" ]]; then OPEN=1; fi
done

if ! command -v gcloud &>/dev/null; then
  echo "No se encontró gcloud. Instalación: https://cloud.google.com/sdk/docs/install" >&2
  exit 1
fi

PROJECT="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}"
PROJECT="${PROJECT//$'\r'/}"
if [[ -z "$PROJECT" || "$PROJECT" == "(unset)" ]]; then
  echo "Definí el proyecto: export GOOGLE_CLOUD_PROJECT=tu-proyecto-id" >&2
  echo "o: gcloud config set project tu-proyecto-id" >&2
  exit 1
fi

echo "Proyecto: $PROJECT"
echo "Habilitando drive.googleapis.com …"
gcloud services enable drive.googleapis.com --project="$PROJECT"

CRED="https://console.cloud.google.com/apis/credentials?project=${PROJECT}"
CONSENT="https://console.cloud.google.com/apis/credentials/consent?project=${PROJECT}"
LIB="https://console.cloud.google.com/apis/library/drive.googleapis.com?project=${PROJECT}"

echo ""
echo "Enlaces (abrí en el navegador):"
echo "  Credenciales (OAuth Client ID): $CRED"
echo "  Pantalla de consentimiento:      $CONSENT"
echo "  Biblioteca Drive API:            $LIB"
echo ""
echo "Orígenes JavaScript típicos para el cliente «Web application»:"
echo "  http://localhost:5173"
echo "  https://calculadora-bmc.vercel.app"
echo "  (y el origen https de Cloud Run si servís la SPA desde ahí)"
echo ""
echo "Luego: npm run drive:configure   (o ./run_drive_setup.sh '<client-id>')"
echo "      npm run verify:google-drive-oauth"
echo ""

if [[ "$OPEN" -eq 1 ]]; then
  if [[ "$(uname)" == "Darwin" ]]; then
    open "$CRED"
  elif command -v xdg-open &>/dev/null; then
    xdg-open "$CRED" || true
  else
    echo "No hay open/xdg-open; abrí manualmente la URL de Credenciales." >&2
  fi
fi

if [[ -f .env.local ]] || [[ -f .env ]]; then
  npm run verify:google-drive-oauth 2>/dev/null || true
fi
