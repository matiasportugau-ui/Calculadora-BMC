#!/bin/zsh
# Sincroniza TODOS los secrets operativos desde .env → Cloud Run (panelin-calc).
# Requiere: gcloud CLI autenticado con proyecto configurado.
# Uso: ./run_ml_cloud_run_setup.sh [SERVICE_NAME]
#
# Nota: valores con comas deben ir a Secret Manager en lugar de --update-env-vars.

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
  echo "Error: No existe .env en el directorio actual."
  exit 1
fi

# Carga una clave desde .env (ignora comentarios, toma primera coincidencia)
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

# ── Cargar todos los grupos de keys desde .env ──────────────────────────────
# ML / token GCS / URL pública
for line in $(grep -E '^(ML_|TOKEN_|PUBLIC_BASE)' .env 2>/dev/null | grep -v '^#'); do
  key="${line%%=*}"
  val="${line#*=}"
  export "$key=$val"
done

# AI providers
load_env_key ANTHROPIC_API_KEY
load_env_key OPENAI_API_KEY
load_env_key OPENAI_CHAT_MODEL
load_env_key GEMINI_API_KEY
load_env_key GROK_API_KEY

# Auth / Webhooks
load_env_key WEBHOOK_VERIFY_TOKEN
load_env_key API_AUTH_TOKEN
load_env_key API_KEY

# WhatsApp
load_env_key WHATSAPP_VERIFY_TOKEN
load_env_key WHATSAPP_ACCESS_TOKEN
load_env_key WHATSAPP_PHONE_NUMBER_ID

# Google Sheets (todos los workbooks)
load_env_key BMC_SHEET_ID
load_env_key BMC_SHEET_SCHEMA
load_env_key BMC_PAGOS_SHEET_ID
load_env_key BMC_CALENDARIO_SHEET_ID
load_env_key BMC_VENTAS_SHEET_ID
load_env_key BMC_STOCK_SHEET_ID

# Drive
load_env_key DRIVE_QUOTE_FOLDER_ID

# Wolfboard
load_env_key WOLFB_ADMIN_SHEET_ID
load_env_key WOLFB_CRM_ENVIADOS_TAB
load_env_key WOLFB_CRM_MAIN_TAB

if [[ -z "$ML_CLIENT_ID" || -z "$ML_CLIENT_SECRET" ]]; then
  echo "Error: .env debe tener ML_CLIENT_ID y ML_CLIENT_SECRET"
  exit 1
fi

echo "→ Actualizando Cloud Run: $SERVICE_NAME (proyecto: $PROJECT_ID)"
echo ""

# Detectar URL real del servicio (para ML_USE_PROD_REDIRECT)
REAL_URL=$(gcloud run services describe "$SERVICE_NAME" --region=us-central1 --format='value(status.url)' 2>/dev/null || echo "$CLOUD_RUN_URL")
if [[ "$REAL_URL" =~ ^https://.+\.run\.app$ ]]; then
  PUBLIC_URL="${PUBLIC_BASE_URL:-$REAL_URL}"
else
  PUBLIC_URL="${PUBLIC_BASE_URL:-$CLOUD_RUN_URL}"
fi

# ── Construir lista de env vars y secret mounts ──────────────────────────────
#
# Las claves de alta sensibilidad migran a Google Secret Manager:
#   - Si el secret existe en GSM → se monta vía --update-secrets (no aparece en
#     env vars de Cloud Run, solo accesible vía secretmanager.secretAccessor).
#   - Si el secret no existe → fallback a env var con warning. Provisioná los
#     secrets una sola vez ejecutando ./scripts/provision-secrets.sh.

declare -a PAIRS         # KEY=VAL  para --update-env-vars
declare -a SECRET_PAIRS  # KEY=secret-name:latest  para --update-secrets

# Helper: si el secret existe en GSM lo agrega como mount; si no, fallback a env var.
add_sensitive() {
  local key="$1"
  local val="$2"
  [[ -z "$val" ]] && return 0
  if gcloud secrets describe "$key" --project="$PROJECT_ID" >/dev/null 2>&1; then
    SECRET_PAIRS+=("$key=$key:latest")
    echo "🔒 $key → Secret Manager"
  else
    PAIRS+=("$key=$val")
    echo "⚠️  $key → env var (no provisionado en GSM — corré ./scripts/provision-secrets.sh)"
  fi
}

# ── Configuración pública / IDs (siempre como env vars) ──────────────────────
PAIRS+=("ML_CLIENT_ID=$ML_CLIENT_ID")
PAIRS+=("PUBLIC_BASE_URL=$PUBLIC_URL")

# ML_USE_PROD_REDIRECT only on the canonical prod service; staging/dev services
# get the dev redirect so OAuth callbacks don't collide.
if [[ "$SERVICE_NAME" == "panelin-calc" ]]; then
  PAIRS+=("ML_USE_PROD_REDIRECT=true")
  echo "→ ML_USE_PROD_REDIRECT=true (service is prod)"
else
  PAIRS+=("ML_USE_PROD_REDIRECT=false")
  echo "→ ML_USE_PROD_REDIRECT=false (service ≠ panelin-calc)"
fi

# GCS token store (persistencia ML tokens en Cloud Run)
if [[ -n "$ML_TOKEN_GCS_BUCKET" ]]; then
  PAIRS+=("ML_TOKEN_STORAGE=gcs")
  PAIRS+=("ML_TOKEN_GCS_BUCKET=$ML_TOKEN_GCS_BUCKET")
  [[ -n "$ML_TOKEN_GCS_OBJECT" ]] && PAIRS+=("ML_TOKEN_GCS_OBJECT=$ML_TOKEN_GCS_OBJECT")
  echo "→ GCS token store: bucket=$ML_TOKEN_GCS_BUCKET"
fi

# ── Secrets de alta sensibilidad ─────────────────────────────────────────────
add_sensitive ML_CLIENT_SECRET "$ML_CLIENT_SECRET"
add_sensitive TOKEN_ENCRYPTION_KEY "$TOKEN_ENCRYPTION_KEY"
add_sensitive WEBHOOK_VERIFY_TOKEN "$WEBHOOK_VERIFY_TOKEN"

# Auth (preferimos API_AUTH_TOKEN sobre API_KEY)
if [[ -n "$API_AUTH_TOKEN" ]]; then
  add_sensitive API_AUTH_TOKEN "$API_AUTH_TOKEN"
elif [[ -n "$API_KEY" ]]; then
  add_sensitive API_KEY "$API_KEY"
fi

# AI providers (claves de proveedores LLM)
add_sensitive ANTHROPIC_API_KEY "$ANTHROPIC_API_KEY"
add_sensitive OPENAI_API_KEY "$OPENAI_API_KEY"
add_sensitive GEMINI_API_KEY "$GEMINI_API_KEY"
add_sensitive GROK_API_KEY "$GROK_API_KEY"
[[ -n "$OPENAI_CHAT_MODEL" ]] && PAIRS+=("OPENAI_CHAT_MODEL=$OPENAI_CHAT_MODEL")

# WhatsApp (token de acceso es alta sensibilidad; verify/phone_id son IDs)
if [[ -n "$WHATSAPP_VERIFY_TOKEN" ]]; then
  add_sensitive WHATSAPP_VERIFY_TOKEN "$WHATSAPP_VERIFY_TOKEN"
  add_sensitive WHATSAPP_ACCESS_TOKEN "$WHATSAPP_ACCESS_TOKEN"
  PAIRS+=("WHATSAPP_PHONE_NUMBER_ID=$WHATSAPP_PHONE_NUMBER_ID")
  echo "→ WhatsApp phone_id: env var"
fi

# Google Sheets
if [[ -n "$BMC_SHEET_ID" ]]; then
  PAIRS+=("BMC_SHEET_ID=$BMC_SHEET_ID")
  [[ -n "$BMC_SHEET_SCHEMA" ]]       && PAIRS+=("BMC_SHEET_SCHEMA=$BMC_SHEET_SCHEMA")
  [[ -n "$BMC_PAGOS_SHEET_ID" ]]     && PAIRS+=("BMC_PAGOS_SHEET_ID=$BMC_PAGOS_SHEET_ID")
  [[ -n "$BMC_CALENDARIO_SHEET_ID" ]] && PAIRS+=("BMC_CALENDARIO_SHEET_ID=$BMC_CALENDARIO_SHEET_ID")
  [[ -n "$BMC_VENTAS_SHEET_ID" ]]    && PAIRS+=("BMC_VENTAS_SHEET_ID=$BMC_VENTAS_SHEET_ID")
  [[ -n "$BMC_STOCK_SHEET_ID" ]]     && PAIRS+=("BMC_STOCK_SHEET_ID=$BMC_STOCK_SHEET_ID")
  echo "→ Google Sheets (5 workbooks): sincronizado"
fi

# Drive
[[ -n "$DRIVE_QUOTE_FOLDER_ID" ]] && { PAIRS+=("DRIVE_QUOTE_FOLDER_ID=$DRIVE_QUOTE_FOLDER_ID"); echo "→ DRIVE_QUOTE_FOLDER_ID: sincronizado"; }

# Wolfboard
[[ -n "$WOLFB_ADMIN_SHEET_ID" ]]   && PAIRS+=("WOLFB_ADMIN_SHEET_ID=$WOLFB_ADMIN_SHEET_ID")
[[ -n "$WOLFB_CRM_ENVIADOS_TAB" ]] && PAIRS+=("WOLFB_CRM_ENVIADOS_TAB=$WOLFB_CRM_ENVIADOS_TAB")
[[ -n "$WOLFB_CRM_MAIN_TAB" ]]     && PAIRS+=("WOLFB_CRM_MAIN_TAB=$WOLFB_CRM_MAIN_TAB")
echo "→ Wolfboard CRM tabs: sincronizado"

# ── Ejecutar update ──────────────────────────────────────────────────────────
# Unir arrays con comas (gcloud requiere KEY=VAL,KEY=VAL)
ENV_VARS=$(IFS=,; echo "${PAIRS[*]}")
SECRETS=$(IFS=,; echo "${SECRET_PAIRS[*]}")

declare -a UPDATE_ARGS
UPDATE_ARGS+=(--region=us-central1)
[[ -n "$ENV_VARS" ]] && UPDATE_ARGS+=(--update-env-vars="$ENV_VARS")
[[ -n "$SECRETS" ]]  && UPDATE_ARGS+=(--update-secrets="$SECRETS")
UPDATE_ARGS+=(--quiet)

gcloud run services update "$SERVICE_NAME" "${UPDATE_ARGS[@]}"

echo ""
echo "[OK] Cloud Run actualizado — nueva revisión desplegando."
echo ""
echo "OAuth callback (agregar en Mercado Libre Developers → URLs de redirección):"
echo "  $PUBLIC_URL/auth/ml/callback"
echo ""
echo "Webhook ML (Notificaciones):"
echo "  $PUBLIC_URL/webhooks/ml"
echo ""
echo "Webhook WhatsApp (Meta → WhatsApp → Configuration → Webhook URL):"
echo "  $PUBLIC_URL/webhooks/whatsapp"
echo ""
echo "⚠  WHATSAPP_APP_SECRET no se sincroniza aquí (va en Secret Manager)."
echo "   Ver: docs/procedimientos/WHATSAPP-HMAC-GAP.md"
echo ""
echo "Siguiente: abrí $PUBLIC_URL/auth/ml/start y verificá $PUBLIC_URL/health"
