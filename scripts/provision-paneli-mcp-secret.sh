#!/usr/bin/env bash
# Provision PANELI_MCP_SECRET in Doppler + GCP and attach to Cloud Run panelin-calc.
# HITL: run manually (agent auto-mode blocks Doppler/GCP secret writes).
set -euo pipefail

PROJECT="${GCP_PROJECT:-chatbot-bmc-live}"
REGION="${GCP_REGION:-us-central1}"
SERVICE="${CLOUD_RUN_SERVICE:-panelin-calc}"
DOPPLER_PROJECT="${DOPPLER_PROJECT:-bmc-backend}"
DOPPLER_CONFIG="${DOPPLER_CONFIG:-prd}"

SECRET_FILE=$(mktemp)
chmod 600 "$SECRET_FILE"
trap 'rm -f "$SECRET_FILE"' EXIT

openssl rand -hex 32 | tr -d '\n' > "$SECRET_FILE"
echo "Generated 64-char hex secret (not printed)."

echo "==> Doppler ${DOPPLER_PROJECT}/${DOPPLER_CONFIG}"
doppler secrets set PANELI_MCP_SECRET --project="$DOPPLER_PROJECT" --config="$DOPPLER_CONFIG" < "$SECRET_FILE"

echo "==> GCP Secret Manager"
gcloud secrets create PANELI_MCP_SECRET \
  --replication-policy=automatic \
  --project="$PROJECT" 2>/dev/null || true
gcloud secrets versions add PANELI_MCP_SECRET \
  --data-file="$SECRET_FILE" \
  --project="$PROJECT"

RUNTIME_SA=$(gcloud run services describe "$SERVICE" \
  --region="$REGION" --project="$PROJECT" \
  --format='value(spec.template.spec.serviceAccountName)')
echo "Runtime SA: $RUNTIME_SA"

gcloud secrets add-iam-policy-binding PANELI_MCP_SECRET \
  --project="$PROJECT" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor" >/dev/null

echo "==> Attach to Cloud Run ${SERVICE}"
gcloud run services update "$SERVICE" \
  --region="$REGION" --project="$PROJECT" \
  --update-secrets=PANELI_MCP_SECRET=PANELI_MCP_SECRET:latest

echo "Done. Retrieve for ElevenLabs:"
echo "  doppler secrets get PANELI_MCP_SECRET --project=${DOPPLER_PROJECT} --config=${DOPPLER_CONFIG} --plain"
