#!/usr/bin/env bash
# Full Cloud Run diagnostic: service state (REST), logging errors, HTTP status counts,
# bucket tokens, and a short anomaly-oriented report. Run in Cloud Shell.
#
# Usage: ./scripts/cloudrun-full-diagnostic.sh [SERVICE] [REGION] [PROJECT]
# Defaults: SERVICE=panelin-calc REGION=us-central1 PROJECT=chatbot-bmc-live

set -e
SERVICE="${1:-panelin-calc}"
REGION="${2:-us-central1}"
PROJECT="${3:-chatbot-bmc-live}"
BUCKET="${4:-panelin-calc-ml-tokens}"
URL="https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/services/${SERVICE}"
REPORT_DATE="$(date -u +%Y-%m-%d)"

if [ -n "${CLOUDRUN_ACCESS_TOKEN}" ]; then
  TOKEN="${CLOUDRUN_ACCESS_TOKEN}"
elif command -v gcloud >/dev/null 2>&1; then
  TOKEN="$(gcloud auth print-access-token)"
else
  echo "Error: need gcloud in PATH or CLOUDRUN_ACCESS_TOKEN set. Run this script in Cloud Shell."
  exit 1
fi

echo ""
echo "# Reporte Diagnóstico Cloud Run — ${SERVICE}"
echo "**Proyecto:** ${PROJECT} | **Región:** ${REGION} | **Fecha:** ${REPORT_DATE}"
echo ""

# ---- 1) Service state via REST ----
echo "## 1. Estado del servicio (REST v2)"
JSON="$(curl -sS -H "Authorization: Bearer ${TOKEN}" "${URL}")"
if ! echo "$JSON" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
  echo "Error: API no devolvió JSON válido."
  echo "$JSON" | head -5
  exit 1
fi

echo "$JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
t=d.get('template') or {}
s=d.get('scaling') or {}
tc=d.get('terminalCondition') or {}
print('URI:', d.get('uri'))
print('Revisión (latestReady):', d.get('latestReadyRevision'))
print('Condición:', tc.get('state'), '-', (tc.get('message') or '')[:80])
print('Scaling: min=%s max=%s' % (s.get('minInstanceCount'), s.get('maxInstanceCount'))
print('Timeout:', t.get('timeout'), '| ServiceAccount:', (t.get('serviceAccount') or '')[:50])
for i,c in enumerate(t.get('containers') or []):
  r=c.get('resources') or {}
  print('Contenedor:', c.get('image'))
  print('  CPU:', r.get('cpu'), '| Memoria:', r.get('memoryLimit'))
print('Tráfico:', [(x.get('revision'), x.get('percent')) for x in (d.get('traffic') or [])])
"

echo ""

# ---- 2) Logging: recent errors ----
echo "## 2. Errores recientes (severity >= ERROR, 7d)"
if command -v gcloud >/dev/null 2>&1; then
  ERR_LOG="$(gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="'"${SERVICE}"'" AND severity>=ERROR' \
    --project="${PROJECT}" --limit=20 --format="value(timestamp,jsonPayload.message)" --freshness=7d 2>/dev/null)" || true
  if [ -n "$ERR_LOG" ]; then
    echo "$ERR_LOG"
  else
    echo "(ninguno o sin permisos)"
  fi
else
  echo "(gcloud no disponible — ejecutar en Cloud Shell)"
fi

echo ""

# ---- 3) HTTP status counts ----
echo "## 3. Resumen HTTP 4xx/5xx (últimas 24h)"
if command -v gcloud >/dev/null 2>&1; then
  STATUS_LOG="$(gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="'"${SERVICE}"'" AND httpRequest.status>=400' \
    --project="${PROJECT}" --freshness=1d --limit=500 --format="value(httpRequest.status,httpRequest.requestUrl)" 2>/dev/null)" || true
  if [ -n "$STATUS_LOG" ]; then
    echo "$STATUS_LOG" | awk '{print $1}' | sort | uniq -c | sort -rn
    echo ""
    echo "Rutas más afectadas (primer path):"
    echo "$STATUS_LOG" | awk '{print $2}' | sed 's/.*\/\/[^/]*//;s/?.*//' | sort | uniq -c | sort -rn | head -10
  else
    echo "(ninguno o sin permisos)"
  fi
else
  echo "(gcloud no disponible)"
fi

echo ""

# ---- 4) Bucket tokens ----
echo "## 4. Bucket tokens ML (gs://${BUCKET}/)"
if command -v gsutil >/dev/null 2>&1; then
  gsutil ls -la "gs://${BUCKET}/" 2>/dev/null || echo "(vacío o sin acceso)"
else
  echo "(gsutil no disponible)"
fi

echo ""

# ---- 5) Anomalías persistentes (heurísticas) ----
echo "## 5. Posibles anomalías persistentes"
echo "Revisar manualmente si aparecen de forma repetida:"
echo "- OAuth not initialized / Complete /auth/ml/start"
echo "- Missing ML_CLIENT_SECRET"
echo "- 500 en /auth/ml/start | 401 en /ml/questions"
echo "- 404 en /auth/ml/callback, /favicon.ico, /"
echo ""
echo "Comando para buscar mensajes repetidos (ejecutar en Cloud Shell):"
echo "  gcloud logging read 'resource.labels.service_name=\"${SERVICE}\" AND severity>=ERROR' --project=${PROJECT} --freshness=7d --limit=200 --format=json | python3 -c \"import json,sys; from collections import Counter; logs=json.load(sys.stdin); msgs=[l.get('jsonPayload',{}).get('message','') for l in logs]; print(Counter(msgs).most_common(10))\""
echo ""
echo "===== Fin del reporte ====="
