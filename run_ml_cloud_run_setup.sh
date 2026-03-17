#!/bin/zsh
# Sincroniza variables de MercadoLibre OAuth desde .env a Cloud Run.
# Requiere: gcloud CLI, proyecto configurado.
# Uso: ./run_ml_cloud_run_setup.sh [SERVICE_NAME]

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

# Cargar solo las vars ML/TOKEN (evitar rutas con espacios que rompen xargs)
for line in $(grep -E '^(ML_|TOKEN_|PUBLIC_BASE)' .env 2>/dev/null | grep -v '^#'); do
  key="${line%%=*}"; val="${line#*=}"; export "$key=$val"
done

if [[ -z "$ML_CLIENT_ID" || -z "$ML_CLIENT_SECRET" ]]; then
  echo "Error: .env debe tener ML_CLIENT_ID y ML_CLIENT_SECRET"
  exit 1
fi

echo "→ Actualizando Cloud Run: $SERVICE_NAME (proyecto: $PROJECT_ID)"
echo "→ PUBLIC_BASE_URL: $CLOUD_RUN_URL"
echo ""

# Obtener URL real del servicio (por si el formato difiere)
REAL_URL=$(gcloud run services describe "$SERVICE_NAME" --region=us-central1 --format='value(status.url)' 2>/dev/null || echo "$CLOUD_RUN_URL")
# Preferir URL de gcloud cuando sea válida (https + .run.app); si no, usar .env o fallback
if [[ "$REAL_URL" =~ ^https://.+\\.run\\.app$ ]]; then
  PUBLIC_URL="${PUBLIC_BASE_URL:-$REAL_URL}"
else
  PUBLIC_URL="${PUBLIC_BASE_URL:-$CLOUD_RUN_URL}"
fi

# Variables base
ENV_VARS="ML_CLIENT_ID=$ML_CLIENT_ID,ML_CLIENT_SECRET=$ML_CLIENT_SECRET,PUBLIC_BASE_URL=$PUBLIC_URL"

# Persistencia de tokens en GCS (opcional)
if [[ -n "$ML_TOKEN_GCS_BUCKET" ]]; then
  ENV_VARS="$ENV_VARS,ML_TOKEN_STORAGE=gcs,ML_TOKEN_GCS_BUCKET=$ML_TOKEN_GCS_BUCKET"
  [[ -n "$ML_TOKEN_GCS_OBJECT" ]] && ENV_VARS="$ENV_VARS,ML_TOKEN_GCS_OBJECT=$ML_TOKEN_GCS_OBJECT"
  [[ -n "$TOKEN_ENCRYPTION_KEY" ]] && ENV_VARS="$ENV_VARS,TOKEN_ENCRYPTION_KEY=$TOKEN_ENCRYPTION_KEY"
  echo "→ GCS token store: bucket=$ML_TOKEN_GCS_BUCKET"
fi

gcloud run services update "$SERVICE_NAME" \
  --region=us-central1 \
  --update-env-vars="$ENV_VARS" \
  --quiet

echo ""
echo "[OK] Variables ML sincronizadas. Callback URL para MercadoLibre:"
echo "     $PUBLIC_URL/auth/ml/callback"
echo ""
echo "Agregá esa URL en developers.mercadolibre.com.uy → tu app → Notificaciones."
