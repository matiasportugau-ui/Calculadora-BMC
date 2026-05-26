#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# scripts/provision-tasks-full.sh
# ───────────────────────────────────────────────────────────────────────────
# Ejecutar en terminal local o Google Cloud Shell.
# Provisiona TODAS las credenciales del Tasks module + Cloud Run + Scheduler.
#
#   chmod +x scripts/provision-tasks-full.sh
#   ./scripts/provision-tasks-full.sh
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

GCP_PROJECT="642127786762"
SUPABASE_REF="htnwozvopveibwppyjhg"
CLOUD_RUN_SVC="panelin-calc"
CLOUD_RUN_REGION="us-central1"
ENV_FILE=".env"

c_green='\033[0;32m'; c_yellow='\033[0;33m'; c_red='\033[0;31m'; c_reset='\033[0m'
ok()   { echo -e "  ${c_green}✓${c_reset} $1"; }
warn() { echo -e "  ${c_yellow}⚠${c_reset} $1"; }
fail() { echo -e "  ${c_red}✗${c_reset} $1"; }

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Tasks Module — Full Credential Provisioning"
echo "══════════════════════════════════════════════════════"
echo ""

# ─────────────────────────────────────────────────────────
# 1. GCP project + Tasks API
# ─────────────────────────────────────────────────────────
echo "── 1/7  GCP project + Google Tasks API ──"
if command -v gcloud &>/dev/null; then
  gcloud config set project "$GCP_PROJECT" --quiet 2>/dev/null
  ok "Proyecto: $GCP_PROJECT"
  gcloud services enable tasks.googleapis.com --quiet 2>/dev/null && \
    ok "tasks.googleapis.com habilitada" || warn "Ya estaba habilitada"
else
  warn "gcloud no disponible — habilitá Tasks API manualmente:"
  echo "     https://console.cloud.google.com/apis/library/tasks.googleapis.com?project=$GCP_PROJECT"
fi
echo ""

# ─────────────────────────────────────────────────────────
# 2. OAuth 2.0 credentials (manual — GCP no soporta via CLI)
# ─────────────────────────────────────────────────────────
echo "── 2/7  Google Tasks OAuth credentials ──"
echo ""
echo "  Abrí este link:"
echo "  ${c_yellow}https://console.cloud.google.com/apis/credentials/oauthclient?project=$GCP_PROJECT${c_reset}"
echo ""
echo "  Configuración:"
echo "    Tipo: Web application"
echo "    Nombre: BMC Tasks Module"
echo "    Redirect URIs:"
echo "      http://localhost:3001/auth/tasks/callback"
echo "      https://panelin-calc-$GCP_PROJECT.$CLOUD_RUN_REGION.run.app/auth/tasks/callback"
echo ""
read -rp "  → Client ID: " TASKS_CID
read -rsp "  → Client Secret: " TASKS_CS; echo ""
[ -z "$TASKS_CID" ] || [ -z "$TASKS_CS" ] && { fail "Vacío — abortando."; exit 1; }
ok "OAuth credentials capturadas"
echo ""

# ─────────────────────────────────────────────────────────
# 3. DATABASE_URL (Supabase)
# ─────────────────────────────────────────────────────────
echo "── 3/7  Supabase DATABASE_URL ──"
echo ""
echo "  Abrí este link:"
echo "  ${c_yellow}https://supabase.com/dashboard/project/$SUPABASE_REF/settings/database${c_reset}"
echo ""
echo "  → Sección 'Connection string' → pestaña 'URI'"
echo "  → Copiá el string completo (postgresql://postgres...)"
echo ""
read -rsp "  → DATABASE_URL: " DB_URL; echo ""
if [ -z "$DB_URL" ]; then
  warn "Vacío — continuando sin DATABASE_URL (Tasks devolverá 503)"
  DB_URL=""
else
  ok "DATABASE_URL capturada"
fi
echo ""

# ─────────────────────────────────────────────────────────
# 4. Generar keys locales
# ─────────────────────────────────────────────────────────
echo "── 4/7  Generando ENCRYPTION_KEY + SYNC_HMAC_SECRET ──"
ENC_KEY=$(openssl rand -hex 32)
HMAC_SEC=$(openssl rand -base64 32)
ok "ENCRYPTION_KEY: ${ENC_KEY:0:8}…"
ok "SYNC_HMAC_SECRET: ${HMAC_SEC:0:8}…"
echo ""

# ─────────────────────────────────────────────────────────
# 5. Escribir en .env
# ─────────────────────────────────────────────────────────
echo "── 5/7  Escribiendo en $ENV_FILE ──"

# Función: setear o agregar variable en .env
set_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  elif grep -q "^# *${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^# *${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

set_env "GOOGLE_TASKS_CLIENT_ID" "$TASKS_CID"
set_env "GOOGLE_TASKS_CLIENT_SECRET" "$TASKS_CS"
set_env "ENCRYPTION_KEY" "$ENC_KEY"
set_env "SYNC_HMAC_SECRET" "$HMAC_SEC"
[ -n "$DB_URL" ] && set_env "DATABASE_URL" "$DB_URL"
set_env "VITE_SUPABASE_URL" "https://$SUPABASE_REF.supabase.co"
set_env "SUPABASE_URL" "https://$SUPABASE_REF.supabase.co"

ok "7 variables escritas en $ENV_FILE"
echo ""

# ─────────────────────────────────────────────────────────
# 6. Cloud Run (opcional)
# ─────────────────────────────────────────────────────────
echo "── 6/7  Cloud Run secrets ──"
if ! command -v gcloud &>/dev/null; then
  warn "gcloud no disponible — saltando Cloud Run"
else
  read -rp "  ¿Pushear secrets a Cloud Run ($CLOUD_RUN_SVC)? [y/N] " yn
  if [[ "$yn" =~ ^[Yy]$ ]]; then
    VARS="GOOGLE_TASKS_CLIENT_ID=$TASKS_CID"
    VARS+=",GOOGLE_TASKS_CLIENT_SECRET=$TASKS_CS"
    VARS+=",ENCRYPTION_KEY=$ENC_KEY"
    VARS+=",SYNC_HMAC_SECRET=$HMAC_SEC"
    [ -n "$DB_URL" ] && VARS+=",DATABASE_URL=$DB_URL"

    gcloud run services update "$CLOUD_RUN_SVC" \
      --region="$CLOUD_RUN_REGION" \
      --update-env-vars="$VARS" \
      --quiet && ok "Cloud Run actualizado" || fail "Error actualizando Cloud Run"
  else
    warn "Saltado"
  fi
fi
echo ""

# ─────────────────────────────────────────────────────────
# 7. Cloud Scheduler (opcional)
# ─────────────────────────────────────────────────────────
echo "── 7/7  Cloud Scheduler (sync cada 15 min) ──"
if ! command -v gcloud &>/dev/null; then
  warn "gcloud no disponible — saltando Scheduler"
else
  read -rp "  ¿Crear Cloud Scheduler job? [y/N] " yn
  if [[ "$yn" =~ ^[Yy]$ ]]; then
    CR_URL=$(gcloud run services describe "$CLOUD_RUN_SVC" \
      --region="$CLOUD_RUN_REGION" \
      --format='value(status.url)' 2>/dev/null)

    SA="tasks-sync-scheduler@$(gcloud config get-value project).iam.gserviceaccount.com"
    gcloud iam service-accounts create tasks-sync-scheduler \
      --display-name="Tasks Sync" 2>/dev/null || true
    gcloud run services add-iam-policy-binding "$CLOUD_RUN_SVC" \
      --region="$CLOUD_RUN_REGION" \
      --member="serviceAccount:$SA" \
      --role="roles/run.invoker" --quiet 2>/dev/null || true

    BODY='{"source":"cloud-scheduler"}'
    SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$HMAC_SEC" | awk '{print $2}')

    gcloud scheduler jobs create http tasks-sync-pull \
      --location="$CLOUD_RUN_REGION" \
      --schedule="*/15 * * * *" \
      --uri="$CR_URL/sync/google-tasks/pull" \
      --http-method=POST \
      --headers="Content-Type=application/json,X-Sync-Signature=$SIG" \
      --message-body="$BODY" \
      --oidc-service-account-email="$SA" \
      --oidc-token-audience="$CR_URL" \
      --time-zone="America/Montevideo" \
      --attempt-deadline=60s \
      --quiet 2>/dev/null && ok "Scheduler creado" || warn "Ya existe o error — verificar manualmente"
  else
    warn "Saltado"
  fi
fi

# ─────────────────────────────────────────────────────────
# Resumen
# ─────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
echo "  RESUMEN"
echo "══════════════════════════════════════════════════════"
echo ""
echo "  Verificación rápida:"
echo ""
echo "    node -e \""
echo "      import {config} from './server/config.js';"
echo "      console.log('DB:', config.databaseUrl ? '✅' : '❌');"
echo "      console.log('OAuth:', config.googleTasksClientId ? '✅' : '❌');"
echo "      console.log('Encrypt:', config.tasksEncryptionKey ? '✅' : '❌');"
echo "      console.log('HMAC:', config.syncHmacSecret ? '✅' : '❌');"
echo "    \""
echo ""
echo "  Probar:"
echo ""
echo "    npm run dev:full"
echo "    # Abrir http://localhost:5173/hub/tareas"
echo "    # Click 'Conectar Google Tasks'"
echo ""
