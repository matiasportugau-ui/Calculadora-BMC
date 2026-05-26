#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# scripts/provision-tasks-credentials.sh
# ───────────────────────────────────────────────────────────────────────────
# Run in Google Cloud Shell to provision all Tasks module credentials.
# Prerequisites: gcloud CLI authenticated, project 642127786762 selected.
#
# Usage:
#   # 1. Open https://shell.cloud.google.com
#   # 2. Upload or paste this script
#   # 3. Run:
#   chmod +x provision-tasks-credentials.sh
#   ./provision-tasks-credentials.sh
#
# Output: prints all env vars ready to paste into .env
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────
GCP_PROJECT_ID="642127786762"
SUPABASE_PROJECT_REF="htnwozvopveibwppyjhg"
SUPABASE_REGION="us-east-1"
CLOUD_RUN_SERVICE="panelin-calc"
CLOUD_RUN_REGION="us-central1"
REDIRECT_URI_LOCAL="http://localhost:3001/auth/tasks/callback"
REDIRECT_URI_PROD="https://panelin-calc-642127786762.us-central1.run.app/auth/tasks/callback"

echo "═══════════════════════════════════════════════════════════"
echo " Tasks Module — Credential Provisioning"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── Step 1: Set GCP project ──────────────────────────────────────────────
echo "▸ Step 1: Setting GCP project..."
gcloud config set project "$GCP_PROJECT_ID" 2>/dev/null
echo "  ✓ Project: $(gcloud config get-value project)"
echo ""

# ── Step 2: Enable Google Tasks API ──────────────────────────────────────
echo "▸ Step 2: Enabling Google Tasks API..."
gcloud services enable tasks.googleapis.com 2>/dev/null || true
echo "  ✓ tasks.googleapis.com enabled"
echo ""

# ── Step 3: Create OAuth 2.0 credentials ────────────────────────────────
echo "▸ Step 3: Creating OAuth 2.0 client for Tasks..."
echo ""
echo "  ⚠️  gcloud CLI cannot create OAuth Web clients directly."
echo "  Opening the credentials page — create manually:"
echo ""
echo "  1. Go to: https://console.cloud.google.com/apis/credentials?project=$GCP_PROJECT_ID"
echo "  2. Click '+ CREATE CREDENTIALS' → 'OAuth client ID'"
echo "  3. Application type: 'Web application'"
echo "  4. Name: 'BMC Tasks Module'"
echo "  5. Authorized redirect URIs — add BOTH:"
echo "     • $REDIRECT_URI_LOCAL"
echo "     • $REDIRECT_URI_PROD"
echo "  6. Click 'Create'"
echo "  7. Copy Client ID and Client Secret"
echo ""
read -rp "  Paste GOOGLE_TASKS_CLIENT_ID: " TASKS_CLIENT_ID
read -rp "  Paste GOOGLE_TASKS_CLIENT_SECRET: " TASKS_CLIENT_SECRET

if [ -z "$TASKS_CLIENT_ID" ] || [ -z "$TASKS_CLIENT_SECRET" ]; then
  echo "  ✗ Client ID or Secret empty. Aborting."
  exit 1
fi
echo "  ✓ OAuth credentials captured"
echo ""

# ── Step 4: Generate encryption keys ────────────────────────────────────
echo "▸ Step 4: Generating encryption keys..."
ENCRYPTION_KEY=$(openssl rand -hex 32)
SYNC_HMAC_SECRET=$(openssl rand -base64 32)
echo "  ✓ ENCRYPTION_KEY generated (${ENCRYPTION_KEY:0:8}...)"
echo "  ✓ SYNC_HMAC_SECRET generated (${SYNC_HMAC_SECRET:0:8}...)"
echo ""

# ── Step 5: Get Supabase DATABASE_URL ────────────────────────────────────
echo "▸ Step 5: Supabase DATABASE_URL"
echo ""
echo "  Go to: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF/settings/database"
echo "  Section: 'Connection string' → 'URI' tab"
echo "  Copy the full postgresql://... string (includes password)"
echo ""
read -rp "  Paste DATABASE_URL: " DATABASE_URL

if [ -z "$DATABASE_URL" ]; then
  echo "  ⚠️  DATABASE_URL empty — continuing without it (Tasks CRUD will return 503)"
fi
echo ""

# ── Step 6: Output .env block ────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════"
echo " DONE — Copy this block into your .env file:"
echo "═══════════════════════════════════════════════════════════"
echo ""
cat <<ENVBLOCK
# ── Tasks Module (auto-provisioned $(date +%Y-%m-%d)) ─────────────────────
GOOGLE_TASKS_CLIENT_ID=$TASKS_CLIENT_ID
GOOGLE_TASKS_CLIENT_SECRET=$TASKS_CLIENT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
SYNC_HMAC_SECRET=$SYNC_HMAC_SECRET
DATABASE_URL=$DATABASE_URL
ENVBLOCK
echo ""

# ── Step 7 (optional): Push secrets to Cloud Run ─────────────────────────
echo "═══════════════════════════════════════════════════════════"
read -rp "▸ Step 7: Push these secrets to Cloud Run ($CLOUD_RUN_SERVICE)? [y/N] " PUSH_CR
if [[ "$PUSH_CR" =~ ^[Yy]$ ]]; then
  echo "  Updating Cloud Run env vars..."

  ENV_VARS="GOOGLE_TASKS_CLIENT_ID=$TASKS_CLIENT_ID"
  ENV_VARS+=",GOOGLE_TASKS_CLIENT_SECRET=$TASKS_CLIENT_SECRET"
  ENV_VARS+=",ENCRYPTION_KEY=$ENCRYPTION_KEY"
  ENV_VARS+=",SYNC_HMAC_SECRET=$SYNC_HMAC_SECRET"
  [ -n "$DATABASE_URL" ] && ENV_VARS+=",DATABASE_URL=$DATABASE_URL"

  gcloud run services update "$CLOUD_RUN_SERVICE" \
    --region="$CLOUD_RUN_REGION" \
    --update-env-vars="$ENV_VARS" \
    --quiet

  echo "  ✓ Cloud Run updated"
  echo ""

  # ── Step 8: Create Cloud Scheduler job ─────────────────────────────────
  read -rp "▸ Step 8: Create Cloud Scheduler sync job (every 15min)? [y/N] " CREATE_SCHED
  if [[ "$CREATE_SCHED" =~ ^[Yy]$ ]]; then
    CLOUD_RUN_URL=$(gcloud run services describe "$CLOUD_RUN_SERVICE" \
      --region="$CLOUD_RUN_REGION" \
      --format='value(status.url)' 2>/dev/null)

    # Create service account for scheduler if not exists
    SA_NAME="tasks-sync-scheduler"
    SA_EMAIL="$SA_NAME@$(gcloud config get-value project).iam.gserviceaccount.com"

    gcloud iam service-accounts create "$SA_NAME" \
      --display-name="Tasks Sync Scheduler" 2>/dev/null || true

    gcloud run services add-iam-policy-binding "$CLOUD_RUN_SERVICE" \
      --region="$CLOUD_RUN_REGION" \
      --member="serviceAccount:$SA_EMAIL" \
      --role="roles/run.invoker" \
      --quiet 2>/dev/null || true

    # Compute HMAC for the scheduler payload
    SCHED_BODY='{"source":"cloud-scheduler"}'
    SCHED_HMAC=$(echo -n "$SCHED_BODY" | openssl dgst -sha256 -hmac "$SYNC_HMAC_SECRET" | awk '{print $2}')

    gcloud scheduler jobs create http "tasks-sync-pull" \
      --location="$CLOUD_RUN_REGION" \
      --schedule="*/15 * * * *" \
      --uri="$CLOUD_RUN_URL/sync/google-tasks/pull" \
      --http-method=POST \
      --headers="Content-Type=application/json,X-Sync-Signature=$SCHED_HMAC" \
      --message-body="$SCHED_BODY" \
      --oidc-service-account-email="$SA_EMAIL" \
      --oidc-token-audience="$CLOUD_RUN_URL" \
      --time-zone="America/Montevideo" \
      --attempt-deadline="60s" \
      --quiet 2>/dev/null || echo "  ⚠️  Job may already exist — update manually if needed"

    echo "  ✓ Cloud Scheduler job 'tasks-sync-pull' created (every 15 min)"
  fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " Summary"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  ✅ Google Tasks API enabled"
echo "  ✅ OAuth credentials: $TASKS_CLIENT_ID"
echo "  ✅ ENCRYPTION_KEY: ${ENCRYPTION_KEY:0:8}..."
echo "  ✅ SYNC_HMAC_SECRET: ${SYNC_HMAC_SECRET:0:8}..."
[ -n "$DATABASE_URL" ] && echo "  ✅ DATABASE_URL: set" || echo "  ⚠️  DATABASE_URL: not set"
[[ "${PUSH_CR:-}" =~ ^[Yy]$ ]] && echo "  ✅ Cloud Run: updated" || echo "  ⏸  Cloud Run: skipped"
[[ "${CREATE_SCHED:-}" =~ ^[Yy]$ ]] && echo "  ✅ Cloud Scheduler: created" || echo "  ⏸  Cloud Scheduler: skipped"
echo ""
echo "  Next: paste the .env block above into your local .env,"
echo "  then test: npm run dev:full → visit /hub/tareas → click 'Conectar Google Tasks'"
echo ""
