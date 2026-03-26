#!/usr/bin/env bash
# Mount a Secret Manager JSON (service account) on panelin-calc and set MATRIZ ID.
# Fixes: GET /api/actualizar-precios-calculadora returning MATRIZ/credentials errors.
#
# Prerequisites:
# - Secret exists in Secret Manager; value = full service account JSON.
# - That SA has Viewer (or more) on the MATRIZ spreadsheet.
# - gcloud authenticated; project chatbot-bmc-live (override with GCLOUD_PROJECT).
#
# Usage:
#   ./scripts/cloud-run-matriz-sheets-secret.sh
#   SECRET_NAME=GOOGLE_SHEETS_CREDENTIALS ./scripts/cloud-run-matriz-sheets-secret.sh
#
# Uses --update-env-vars and --update-secrets (merges; does not replace all env vars).

set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

PROJECT="${GCLOUD_PROJECT:-chatbot-bmc-live}"
REGION="${GCLOUD_REGION:-us-central1}"
SERVICE="${GCLOUD_SERVICE:-panelin-calc}"
SECRET_NAME="${SECRET_NAME:-GOOGLE_APPLICATION_CREDENTIALS}"
MOUNT_PATH="${MOUNT_PATH:-/secrets/sa-key.json}"
MATRIZ_ID="${BMC_MATRIZ_SHEET_ID:-1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo}"

SA="$(gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT" --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
if [[ -z "$SA" ]]; then
  NUM="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
  SA="${NUM}-compute@developer.gserviceaccount.com"
fi
MEMBER="serviceAccount:${SA}"

echo "=== Cloud Run MATRIZ credentials ==="
echo "  project=$PROJECT region=$REGION service=$SERVICE"
echo "  secret=$SECRET_NAME mount=$MOUNT_PATH matriz=$MATRIZ_ID"
echo "  runtime SA=$SA"
echo ""

echo "[1/2] Secret Manager: grant secretAccessor to runtime SA (idempotent if already bound)..."
set +e
gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --project="$PROJECT" \
  --member="$MEMBER" \
  --role="roles/secretmanager.secretAccessor" 2>&1
set -e

echo ""
echo "[2/2] Cloud Run: mount secret + update env vars..."
gcloud run services update "$SERVICE" \
  --region="$REGION" \
  --project="$PROJECT" \
  --update-secrets="${MOUNT_PATH}=${SECRET_NAME}:latest" \
  --update-env-vars="GOOGLE_APPLICATION_CREDENTIALS=${MOUNT_PATH},BMC_MATRIZ_SHEET_ID=${MATRIZ_ID}"

BASE="$(gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT" --format='value(status.url)')"
echo ""
echo "=== Done ==="
echo "  URL: $BASE"
echo "  Test: curl -sS \"$BASE/api/actualizar-precios-calculadora\" | head -c 400"
echo ""
