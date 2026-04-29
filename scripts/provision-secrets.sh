#!/bin/zsh
# Provisiona secrets de alta sensibilidad en Google Secret Manager desde .env.
# Idempotente: si el secret ya existe, agrega una nueva versión solo si el valor cambió.
# Otorga roles/secretmanager.secretAccessor al runtime service account de Cloud Run.
#
# Uso: ./scripts/provision-secrets.sh [SERVICE_NAME]
#   SERVICE_NAME: por defecto panelin-calc

set -e
cd "$(dirname "$0")/.." || exit 1

SERVICE_NAME="${1:-panelin-calc}"
REGION="us-central1"
PROJECT_ID="$(gcloud config get-value project 2>/dev/null)"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Error: No hay proyecto activo. Configurá con 'gcloud config set project PROJECT_ID'."
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Error: No existe .env en el directorio raíz del repo."
  exit 1
fi

# Carga .env de forma laxa (ignora comentarios)
load_env_key() {
  local k="$1"
  local line val
  line=$(grep -E "^${k}=" .env 2>/dev/null | grep -v '^#' | head -1) || true
  [[ -z "$line" ]] && return 0
  val="${line#*=}"
  val="${val%\"}" ; val="${val#\"}"
  val="${val%\'}" ; val="${val#\'}"
  export "${k}=${val}"
}

# Lista de claves de alta sensibilidad a provisionar en GSM
HIGH_SENS_KEYS=(
  ML_CLIENT_SECRET
  TOKEN_ENCRYPTION_KEY
  WEBHOOK_VERIFY_TOKEN
  API_AUTH_TOKEN
  ANTHROPIC_API_KEY
  OPENAI_API_KEY
  GEMINI_API_KEY
  GROK_API_KEY
  WHATSAPP_VERIFY_TOKEN
  WHATSAPP_ACCESS_TOKEN
  WHATSAPP_APP_SECRET
  SHOPIFY_CLIENT_SECRET
  SHOPIFY_WEBHOOK_SECRET
)

for k in "${HIGH_SENS_KEYS[@]}"; do
  load_env_key "$k"
done

# Resuelve el service account efectivo del servicio (default si no hay custom)
echo "→ Detectando service account de Cloud Run para $SERVICE_NAME..."
SERVICE_SA=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)

if [[ -z "$SERVICE_SA" ]]; then
  PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
  SERVICE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
  echo "  (usando default compute SA: $SERVICE_SA)"
else
  echo "  service account: $SERVICE_SA"
fi
echo ""

# Crea o actualiza cada secret + grant accessor al service account
created=0
updated=0
unchanged=0
skipped=0

for k in "${HIGH_SENS_KEYS[@]}"; do
  val="${(P)k}"
  if [[ -z "$val" ]]; then
    echo "⏭   $k: vacío en .env, saltando"
    skipped=$((skipped + 1))
    continue
  fi

  if gcloud secrets describe "$k" --project="$PROJECT_ID" >/dev/null 2>&1; then
    # Existe — comparar valor con la última versión
    current=$(gcloud secrets versions access latest --secret="$k" --project="$PROJECT_ID" 2>/dev/null || echo "")
    if [[ "$current" == "$val" ]]; then
      echo "✓ $k: valor sin cambios"
      unchanged=$((unchanged + 1))
    else
      printf "%s" "$val" | gcloud secrets versions add "$k" --data-file=- --project="$PROJECT_ID" --quiet >/dev/null
      echo "↑ $k: nueva versión agregada"
      updated=$((updated + 1))
    fi
  else
    # Crear secret + primera versión
    gcloud secrets create "$k" --replication-policy=automatic --project="$PROJECT_ID" --quiet
    printf "%s" "$val" | gcloud secrets versions add "$k" --data-file=- --project="$PROJECT_ID" --quiet >/dev/null
    echo "+ $k: secret creado y poblado"
    created=$((created + 1))
  fi

  # Grant accessor (idempotente — gcloud no falla si ya existe)
  gcloud secrets add-iam-policy-binding "$k" \
    --member="serviceAccount:${SERVICE_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT_ID" \
    --quiet >/dev/null 2>&1 || true
done

echo ""
echo "════════════════════════════════════════════════════════════"
echo "Resumen: $created creados, $updated actualizados, $unchanged sin cambios, $skipped saltados"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Siguiente: corré ./run_ml_cloud_run_setup.sh para que el deploy"
echo "monte estos secrets vía --update-secrets en lugar de env vars."
