#!/usr/bin/env bash
# Smoke: POST /api/internal/presup/run (local or Cloud Run)
# Usage:
#   ./scripts/smoke-presup-orchestrator.sh
#   BMC_API_BASE=https://panelin-calc-q74zutv7dq-uc.a.run.app ./scripts/smoke-presup-orchestrator.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${BMC_API_BASE:-http://localhost:3001}"
OUT="${ROOT}/.runtime/presup-orchestrator-smoke.json"
CONSULTA="${SMOKE_CONSULTA:-URGENTE: iSODEC eps 150MM + iSOPANEL 100MM / 350 M2 DE CADA UNO. Montevideo}"

mkdir -p "${ROOT}/.runtime"

echo "→ Smoke presup orchestrator @ ${BASE}"

health_code="$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/health" || echo 000)"
if [[ "${health_code}" != "200" ]]; then
  echo "FAIL: /health returned ${health_code}"
  exit 1
fi

payload=$(cat <<EOF
{"channel":"sheet-admin-cotizar","consulta":"${CONSULTA}","mode":"ligero"}
EOF
)

http_code=$(curl -s -w '%{http_code}' -o "${OUT}" -X POST "${BASE}/api/internal/presup/run" \
  -H "Content-Type: application/json" \
  -d "${payload}")

echo "HTTP ${http_code} → ${OUT}"

if [[ "${http_code}" != "200" ]]; then
  cat "${OUT}"
  exit 1
fi

status=$(python3 -c "import json; d=json.load(open('${OUT}')); print(d.get('status','?'))" 2>/dev/null || echo "?")
echo "status=${status}"

if [[ "${status}" == "error" ]]; then
  echo "WARN: orchestrator returned status=error (often AI keys). Route wiring OK."
  python3 -c "import json; d=json.load(open('${OUT}')); print(d.get('trace',[])[-1].get('message','')[:200])" 2>/dev/null || true
  exit 0
fi

echo "OK: flow reached status=${status}"
