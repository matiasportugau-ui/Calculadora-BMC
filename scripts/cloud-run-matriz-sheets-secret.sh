#!/usr/bin/env bash
# Mount panelin-service-account (Sheets + GCS ML JSON) on panelin-calc and set MATRIZ ID.
# Fixes: GET /api/actualizar-precios-calculadora returning MATRIZ/credentials errors.
#
# Prerequisites:
# - Secret Manager secret `panelin-service-account` (full bmc-dashboard-sheets JSON).
# - That SA email shared on MATRIZ + CRM workbooks (see docs/team/infrastructure/GCP-SERVICE-ACCOUNTS-SESSION-REFERENCE.md §14).
# - gcloud authenticated; project chatbot-bmc-live (override with GCLOUD_PROJECT).
#
# Usage:
#   ./scripts/cloud-run-matriz-sheets-secret.sh
#
# Uses --update-env-vars and --update-secrets (merges; does not replace all env vars).

set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

PROJECT="${GCLOUD_PROJECT:-chatbot-bmc-live}"
REGION="${GCLOUD_REGION:-us-central1}"
SERVICE="${GCLOUD_SERVICE:-panelin-calc}"
SECRET_NAME="${SECRET_NAME:-panelin-service-account}"
MOUNT_PATH="${MOUNT_PATH:-/run/secrets/service-account.json}"
MATRIZ_ID="${BMC_MATRIZ_SHEET_ID:-1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo}"
EXPECTED_RUNTIME_SA="panelin-runner@${PROJECT}.iam.gserviceaccount.com"

SA="$(gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT" --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
if [[ -z "$SA" ]]; then
  echo "Error: could not read runtime service account for $SERVICE"
  exit 1
fi
if [[ "$SA" != "$EXPECTED_RUNTIME_SA" && "${ALLOW_LEGACY_RUNTIME_SA:-}" != "1" ]]; then
  echo "Warning: runtime SA is $SA (expected $EXPECTED_RUNTIME_SA)."
  echo "  Set ALLOW_LEGACY_RUNTIME_SA=1 to continue anyway."
  exit 1
fi
MEMBER="serviceAccount:${SA}"

echo "=== Cloud Run MATRIZ credentials ==="
echo "  project=$PROJECT region=$REGION service=$SERVICE"
echo "  secret=$SECRET_NAME mount=$MOUNT_PATH matriz=$MATRIZ_ID"
echo "  runtime SA=$SA"
echo ""

echo "[1/2] Secret Manager: grant secretAccessor to runtime SA (idempotent)..."
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
echo "  Sheets SA email is inside the JSON (expect bmc-dashboard-sheets@${PROJECT}.iam.gserviceaccount.com)."
echo ""
