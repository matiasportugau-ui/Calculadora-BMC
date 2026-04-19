#!/usr/bin/env bash
# Ajusta el timeout de request de Cloud Run para rutas largas (p. ej. POST /api/crm/ingest-email: IA + Sheets).
# Requiere: gcloud autenticado, proyecto chatbot-bmc-live (o GCLOUD_PROJECT).
#
# Uso:
#   bash scripts/cloud-run-panelin-calc-request-timeout.sh
#   CLOUD_RUN_REQUEST_TIMEOUT_S=300 bash scripts/cloud-run-panelin-calc-request-timeout.sh
#
# Default: 300 s (5 min). Máximo Cloud Run (managed): 3600 s.

set -euo pipefail
SERVICE="${GCLOUD_SERVICE:-panelin-calc}"
REGION="${GCLOUD_REGION:-us-central1}"
PROJECT="${GCLOUD_PROJECT:-chatbot-bmc-live}"
SEC="${CLOUD_RUN_REQUEST_TIMEOUT_S:-300}"

echo "→ gcloud run services update $SERVICE --timeout=${SEC}s (project=$PROJECT region=$REGION)"
gcloud run services update "$SERVICE" \
  --region="$REGION" \
  --project="$PROJECT" \
  --timeout="${SEC}" \
  --quiet

echo "[OK] Timeout de request actualizado."
