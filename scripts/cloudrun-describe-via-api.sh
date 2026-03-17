#!/usr/bin/env bash
# Bypass "gcloud run services describe" crash (TypeError: string indices must be integers, not 'str')
# by calling Cloud Run REST API v2 directly. Use in Cloud Shell or anywhere with gcloud auth.
#
# Usage: ./scripts/cloudrun-describe-via-api.sh [SERVICE] [REGION] [PROJECT]
# Defaults: SERVICE=panelin-calc REGION=us-central1 PROJECT=chatbot-bmc-live
#
# In Cloud Shell (gcloud available):
#   ./scripts/cloudrun-describe-via-api.sh
# With token only (e.g. from Cloud Shell: gcloud auth print-access-token):
#   CLOUDRUN_ACCESS_TOKEN="$(gcloud auth print-access-token)" ./scripts/cloudrun-describe-via-api.sh

set -e
SERVICE="${1:-panelin-calc}"
REGION="${2:-us-central1}"
PROJECT="${3:-chatbot-bmc-live}"
URL="https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/services/${SERVICE}"

if [ -n "${CLOUDRUN_ACCESS_TOKEN}" ]; then
  TOKEN="${CLOUDRUN_ACCESS_TOKEN}"
elif command -v gcloud >/dev/null 2>&1; then
  TOKEN="$(gcloud auth print-access-token)"
else
  echo "Error: need gcloud in PATH or CLOUDRUN_ACCESS_TOKEN set."
  exit 1
fi

echo "===== Cloud Run service (REST v2): ${SERVICE} @ ${REGION} ====="
echo ""

JSON="$(curl -sS -H "Authorization: Bearer ${TOKEN}" "${URL}")"

if echo "$JSON" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
  :
else
  echo "API error (not JSON):"
  echo "$JSON" | head -20
  exit 1
fi

echo "----- 1) Scaling (service-level) -----"
echo "$JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
s=d.get('scaling') or {}
print('minInstanceCount:', s.get('minInstanceCount'))
print('maxInstanceCount:', s.get('maxInstanceCount'))
"

echo ""
echo "----- 2) Template: scaling (revision) -----"
echo "$JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
t=d.get('template') or {}
s=t.get('scaling') or {}
print('minInstanceCount:', s.get('minInstanceCount'))
print('maxInstanceCount:', s.get('maxInstanceCount'))
"

echo ""
echo "----- 3) Template: timeout, serviceAccount, executionEnvironment -----"
echo "$JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
t=d.get('template') or {}
print('timeout:', t.get('timeout'))
print('serviceAccount:', t.get('serviceAccount'))
print('executionEnvironment:', t.get('executionEnvironment'))
print('maxInstanceRequestConcurrency:', t.get('maxInstanceRequestConcurrency'))
"

echo ""
echo "----- 4) Template: containers (cpu, memory, first container image) -----"
echo "$JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
t=d.get('template') or {}
for i,c in enumerate(t.get('containers') or []):
  r=c.get('resources') or {}
  print('container[%s]: image=%s' % (i, c.get('image','?')))
  print('  cpu=%s memory=%s' % (r.get('cpu'), r.get('memoryLimit')))
"

echo ""
echo "----- 5) Ingress -----"
echo "$JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('ingress:', d.get('ingress'))
"

echo ""
echo "----- 6) Traffic -----"
echo "$JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for x in (d.get('traffic') or []):
  print('  revision:', x.get('revision'), 'percent:', x.get('percent'))
"

echo ""
echo "----- 7) URI / URLs -----"
echo "$JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('uri:', d.get('uri'))
for u in (d.get('urls') or []):
  print('  url:', u)
"

echo ""
echo "----- 8) Conditions (ready) -----"
echo "$JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
tc=d.get('terminalCondition') or {}
print('terminalCondition.state:', tc.get('state'))
print('terminalCondition.message:', (tc.get('message') or '')[:200])
"

echo ""
echo "===== Done ====="
