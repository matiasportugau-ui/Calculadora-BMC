#!/usr/bin/env bash
# Refresh WHATSAPP_ACCESS_TOKEN in Google Secret Manager and roll Cloud Run.
#
# Recommended (stdin — avoids shell history and argv exposure):
#   echo -n 'EAA...real-token...' | ./scripts/wa-refresh-access-token.sh
#
# CI / non-interactive only (token visible in argv / ps):
#   ./scripts/wa-refresh-access-token.sh 'EAA...real-token...'
#
# Prereqs: gcloud auth, project chatbot-bmc-live, roles secretmanager.secretVersionAdder + run.admin
#
# Caveat: deploy-calc-api.yml --set-secrets does not list WHATSAPP_ACCESS_TOKEN. After a full
# CI image deploy, re-run this script or ./run_ml_cloud_run_setup.sh so the GSM mount survives.

set -euo pipefail
cd "$(dirname "$0")/.." || exit 1

PROJECT_ID="${GCP_PROJECT:-${GCLOUD_PROJECT:-chatbot-bmc-live}}"
REGION="${GCP_REGION:-us-central1}"
SERVICE="${CLOUD_RUN_SERVICE:-panelin-calc}"
SECRET_NAME="WHATSAPP_ACCESS_TOKEN"
GRAPH_API_VERSION="${GRAPH_API_VERSION:-v21.0}"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-10}"
CURL_MAX_TIME="${CURL_MAX_TIME:-30}"

TOKEN="${1:-}"
if [[ -z "$TOKEN" ]]; then
  TOKEN="$(cat)"
fi
TOKEN="$(printf '%s' "$TOKEN" | tr -d '\n\r')"

if [[ ${#TOKEN} -lt 100 ]]; then
  echo "ERROR: token demasiado corto (${#TOKEN} chars). Un access token real de Meta suele tener 200+ caracteres (prefijo EAA...)." >&2
  exit 1
fi

if ! gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "ERROR: secret ${SECRET_NAME} no existe en GSM (proyecto ${PROJECT_ID})." >&2
  echo "  Provisioná primero: ./scripts/provision-secrets.sh" >&2
  exit 1
fi

echo "→ Validando token contra Graph API /me ..."
ME_JSON=""
if ! ME_JSON="$(curl -sS --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time "$CURL_MAX_TIME" \
  "https://graph.facebook.com/${GRAPH_API_VERSION}/me?fields=id" \
  -H "Authorization: Bearer ${TOKEN}")"; then
  echo "ERROR: Graph API /me no respondió (timeout o red)." >&2
  exit 1
fi
if echo "$ME_JSON" | grep -q '"error"'; then
  echo "ERROR: Graph API rechazó el token:" >&2
  echo "$ME_JSON" >&2
  exit 1
fi
echo "  Graph /me OK"

echo "→ Agregando versión en Secret Manager (${SECRET_NAME}) ..."
printf '%s' "$TOKEN" | gcloud secrets versions add "$SECRET_NAME" \
  --project="$PROJECT_ID" \
  --data-file=- >/dev/null

# Detect how WHATSAPP_ACCESS_TOKEN is currently wired on the service template.
SERVICE_JSON="$(gcloud run services describe "$SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --format=json)"
TOKEN_MOUNT_KIND="$(python3 -c "
import json, os, sys
data = json.loads(os.environ['SERVICE_JSON'])
env = data.get('spec', {}).get('template', {}).get('spec', {}).get('containers', [{}])[0].get('env', [])
name = os.environ['SECRET_NAME']
for item in env:
    if item.get('name') != name:
        continue
    if item.get('valueFrom', {}).get('secretKeyRef'):
        print('secret')
    else:
        print('plain')
    break
else:
    print('absent')
" SERVICE_JSON="$SERVICE_JSON" SECRET_NAME="$SECRET_NAME")"

echo "→ Desplegando revisión Cloud Run (mount actual: ${TOKEN_MOUNT_KIND}) ..."
case "$TOKEN_MOUNT_KIND" in
  plain)
    # Cloud Run rejects env-var → secret mount in one step without removing the plain var first.
    gcloud run services update "$SERVICE" \
      --project="$PROJECT_ID" \
      --region="$REGION" \
      --remove-env-vars="${SECRET_NAME}" \
      --update-secrets="${SECRET_NAME}=${SECRET_NAME}:latest" \
      --quiet >/dev/null
    ;;
  secret|absent)
    gcloud run services update "$SERVICE" \
      --project="$PROJECT_ID" \
      --region="$REGION" \
      --update-secrets="${SECRET_NAME}=${SECRET_NAME}:latest" \
      --quiet >/dev/null
    ;;
  *)
    echo "ERROR: no se pudo determinar el mount de ${SECRET_NAME}." >&2
    exit 1
    ;;
esac

REV="$(gcloud run services describe "$SERVICE" --project="$PROJECT_ID" --region="$REGION" \
  --format='value(status.latestReadyRevisionName)')"
PUBLIC_URL="$(gcloud run services describe "$SERVICE" --project="$PROJECT_ID" --region="$REGION" \
  --format='value(status.url)')"
PHONE_ID="$(python3 -c "
import json, os
data = json.loads(os.environ['SERVICE_JSON'])
env = data.get('spec', {}).get('template', {}).get('spec', {}).get('containers', [{}])[0].get('env', [])
for item in env:
    if item.get('name') == 'WHATSAPP_PHONE_NUMBER_ID':
        print(item.get('value', '') or '')
        break
" SERVICE_JSON="$SERVICE_JSON")"

echo "✓ Listo. Revisión activa: ${REV}"
echo "  Actualizá local .env: WHATSAPP_ACCESS_TOKEN=<mismo token> (wa:cloud-check lee .env, no GSM)"
if [[ -n "$PHONE_ID" ]]; then
  echo "  Verificá outbound prod (Graph API, mismo token recién montado):"
  echo "    curl -sS --connect-timeout ${CURL_CONNECT_TIMEOUT} --max-time ${CURL_MAX_TIME} \\"
  echo "      \"https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_ID}?fields=display_phone_number\" \\"
  echo "      -H \"Authorization: Bearer <token>\" | python3 -m json.tool"
else
  echo "  WHATSAPP_PHONE_NUMBER_ID no está en Cloud Run — configurá phone_id antes de probar outbound."
fi
echo "  Smoke (webhook verify, no access token): npm run smoke:prod  # BMC_API_BASE=${PUBLIC_URL}"