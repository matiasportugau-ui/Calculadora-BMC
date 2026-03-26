#!/bin/zsh
# Sincroniza variables ML + Cloud Run (OAuth, tokens GCS, webhook, CRM) desde .env.
# Requiere: gcloud CLI, proyecto configurado.
# Uso: ./run_ml_cloud_run_setup.sh [SERVICE_NAME]
#
# Si un valor contiene comas, gcloud --update-env-vars puede fallar; usá Console o Secret Manager.

set -e
cd "$(dirname "$0")" || exit 1

SERVICE_NAME="${1:-panelin-calc}"
PROJECT_ID="${GCLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
CLOUD_RUN_URL="https://${SERVICE_NAME}-${PROJECT_ID}.us-central1.run.app"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Error: No hay proyecto gcloud. Ejecutá: gcloud config set project TU_PROJECT_ID"
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Error: No existe .env. Creá uno con ML_CLIENT_ID, ML_CLIENT_SECRET."
  exit 1
fi

# Carga una clave: primera línea que coincida en .env (sin #)
load_env_key() {
  local k="$1"
  local line val
  line=$(grep -E "^${k}=" .env 2>/dev/null | grep -v '^#' | head -1) || true
  [[ -z "$line" ]] && return 0
  val="${line#*=}"
  val="${val%\"}"
  val="${val#\"}"
  val="${val%\'}"
  val="${val#\'}"
  export "${k}=${val}"
}

# ML / token / público (mismo patrón que antes)
for line in $(grep -E '^(ML_|TOKEN_|PUBLIC_BASE)' .env 2>/dev/null | grep -v '^#'); do
  key="${line%%=*}"
  val="${line#*=}"
  export "$key=$val"
done

load_env_key WEBHOOK_VERIFY_TOKEN
load_env_key BMC_SHEET_ID
load_env_key API_AUTH_TOKEN
load_env_key API_KEY

if [[ -z "$ML_CLIENT_ID" || -z "$ML_CLIENT_SECRET" ]]; then
  echo "Error: .env debe tener ML_CLIENT_ID y ML_CLIENT_SECRET"
  exit 1
fi

echo "→ Actualizando Cloud Run: $SERVICE_NAME (proyecto: $PROJECT_ID)"
echo ""

REAL_URL=$(gcloud run services describe "$SERVICE_NAME" --region=us-central1 --format='value(status.url)' 2>/dev/null || echo "$CLOUD_RUN_URL")
if [[ "$REAL_URL" =~ ^https://.+\\.run\\.app$ ]]; then
  PUBLIC_URL="${PUBLIC_BASE_URL:-$REAL_URL}"
else
  PUBLIC_URL="${PUBLIC_BASE_URL:-$CLOUD_RUN_URL}"
fi

ENV_VARS="ML_CLIENT_ID=$ML_CLIENT_ID,ML_CLIENT_SECRET=$ML_CLIENT_SECRET,PUBLIC_BASE_URL=$PUBLIC_URL"

if [[ -n "$ML_TOKEN_GCS_BUCKET" ]]; then
  ENV_VARS="$ENV_VARS,ML_TOKEN_STORAGE=gcs,ML_TOKEN_GCS_BUCKET=$ML_TOKEN_GCS_BUCKET"
  [[ -n "$ML_TOKEN_GCS_OBJECT" ]] && ENV_VARS="$ENV_VARS,ML_TOKEN_GCS_OBJECT=$ML_TOKEN_GCS_OBJECT"
  [[ -n "$TOKEN_ENCRYPTION_KEY" ]] && ENV_VARS="$ENV_VARS,TOKEN_ENCRYPTION_KEY=$TOKEN_ENCRYPTION_KEY"
  echo "→ GCS token store: bucket=$ML_TOKEN_GCS_BUCKET"
fi

if [[ -n "$WEBHOOK_VERIFY_TOKEN" ]]; then
  ENV_VARS="$ENV_VARS,WEBHOOK_VERIFY_TOKEN=$WEBHOOK_VERIFY_TOKEN"
  echo "→ WEBHOOK_VERIFY_TOKEN: definido (POST /webhooks/ml)"
fi

if [[ -n "$BMC_SHEET_ID" ]]; then
  ENV_VARS="$ENV_VARS,BMC_SHEET_ID=$BMC_SHEET_ID"
  echo "→ BMC_SHEET_ID: sincronizado (ML→CRM en webhook)"
fi

if [[ -n "$API_AUTH_TOKEN" ]]; then
  ENV_VARS="$ENV_VARS,API_AUTH_TOKEN=$API_AUTH_TOKEN"
  echo "→ API_AUTH_TOKEN: sincronizado (cockpit / suggest-response)"
elif [[ -n "$API_KEY" ]]; then
  ENV_VARS="$ENV_VARS,API_KEY=$API_KEY"
  echo "→ API_KEY: sincronizado"
fi

gcloud run services update "$SERVICE_NAME" \
  --region=us-central1 \
  --update-env-vars="$ENV_VARS" \
  --quiet

echo ""
echo "[OK] Cloud Run actualizado."
echo ""
echo "OAuth callback (Mercado Libre Developers → URLs de redirección):"
echo "  $PUBLIC_URL/auth/ml/callback"
echo ""
echo "Webhook ML (Notificaciones; mismo verify que WEBHOOK_VERIFY_TOKEN en .env):"
echo "  $PUBLIC_URL/webhooks/ml"
echo ""
echo "Siguiente: abrí $PUBLIC_URL/auth/ml/start una vez, y probá una pregunta de prueba en ML."
