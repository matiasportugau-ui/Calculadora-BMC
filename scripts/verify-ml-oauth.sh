#!/usr/bin/env bash
# Verificación rápida del flujo Mercado Libre OAuth (API debe estar arriba).
# Uso: npm run start:api (otra terminal) → bash scripts/verify-ml-oauth.sh
# Requiere: ML_CLIENT_ID y ML_CLIENT_SECRET en .env para pasos 2–3.

set -euo pipefail
BASE="${BMC_API_BASE:-http://localhost:3001}"

echo "== ML OAuth verify (base: $BASE) =="

code=$(curl -s -o /tmp/ml-health.json -w "%{http_code}" "$BASE/health" || true)
if [[ "$code" != "200" ]]; then
  echo "FAIL: GET /health → HTTP $code (¿npm run start:api?)"
  exit 1
fi
echo "OK GET /health"
if command -v node >/dev/null 2>&1; then
  node -e "const j=require('fs').readFileSync('/tmp/ml-health.json','utf8');const o=JSON.parse(j);console.log('  missingConfig:', (o.missingConfig||[]).join(', ')||'(none)');console.log('  hasTokens:', o.hasTokens);"
else
  cat /tmp/ml-health.json
fi

code=$(curl -s -o /tmp/ml-start.json -w "%{http_code}" "$BASE/auth/ml/start?mode=json" || true)
if [[ "$code" != "200" ]]; then
  echo "WARN: GET /auth/ml/start?mode=json → HTTP $code (¿ML_CLIENT_ID/SECRET en .env?)"
  cat /tmp/ml-start.json 2>/dev/null || true
  exit 0
fi
echo "OK GET /auth/ml/start?mode=json"
if command -v node >/dev/null 2>&1; then
  node -e "const j=JSON.parse(require('fs').readFileSync('/tmp/ml-start.json','utf8'));const u=new URL(j.authUrl);console.log('  redirect_uri:', u.searchParams.get('redirect_uri'));"
fi

code=$(curl -s -o /tmp/ml-status.json -w "%{http_code}" "$BASE/auth/ml/status" || true)
if [[ "$code" == "200" ]]; then
  echo "OK GET /auth/ml/status → HTTP 200 (token guardado)"
else
  echo "GET /auth/ml/status → HTTP $code (404 = aún no completaste OAuth)"
fi

rm -f /tmp/ml-health.json /tmp/ml-start.json /tmp/ml-status.json 2>/dev/null || true
if [[ "$code" == "200" ]]; then
  echo "== Listo. OAuth conectado. Probar: curl -sS \"$BASE/ml/questions\" | head -c 400 =="
else
  echo "== Siguiente paso: abrí en el navegador $BASE/auth/ml/start (o tu URL https de ngrok + /auth/ml/start) =="
fi
