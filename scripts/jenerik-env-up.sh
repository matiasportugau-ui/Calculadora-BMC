#!/usr/bin/env bash
# Boot the Jenerik / BC environment on dedicated ports (does not touch BMC :5173/:3001).
# Calc + PDF BC work without a user email. Grant later:
#   doppler run --project=bmc-backend --config=prd -- node scripts/jenerik-grant-owner.mjs EMAIL
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export BMC_DISK_PRECHECK_SKIP="${BMC_DISK_PRECHECK_SKIP:-1}"
API_PORT="${JENERIK_API_PORT:-3010}"
VITE_PORT="${JENERIK_VITE_PORT:-5180}"

echo "==> apply tenant BC migration"
doppler run --project=bmc-backend --config=prd -- \
  node scripts/jenerik-apply-migration.mjs

echo "==> API :${API_PORT} WHITELABEL=bc"
GID="$(doppler secrets get VITE_GOOGLE_CLIENT_ID --project=bmc-frontend --config=prd --plain 2>/dev/null || true)"
CORS_EXTRA="http://127.0.0.1:${VITE_PORT},http://localhost:${VITE_PORT},http://127.0.0.1:${API_PORT},http://localhost:${API_PORT},http://192.168.1.11:${VITE_PORT},http://100.66.185.105:${VITE_PORT}"
doppler run --project=bmc-backend --config=prd -- \
  env WHITELABEL=bc PORT="$API_PORT" FRONTEND_BASE_URL="http://127.0.0.1:${VITE_PORT}" \
  CORS_ORIGIN="https://calculadora-bmc.vercel.app,http://localhost:5173,http://127.0.0.1:5173,${CORS_EXTRA}" \
  ${GID:+GOOGLE_OAUTH_CLIENT_ID="$GID"} \
  node server/index.js \
  > /tmp/jenerik-api.log 2>&1 &
API_PID=$!
echo "$API_PID" > /tmp/jenerik-api.pid

echo "==> Vite :${VITE_PORT} VITE_WHITELABEL=bc"
env VITE_WHITELABEL=bc PORT="$VITE_PORT" BMC_API_PROXY="http://127.0.0.1:${API_PORT}" \
  BMC_DISK_PRECHECK_SKIP=1 \
  npx vite --host 0.0.0.0 --port "$VITE_PORT" --strictPort \
  > /tmp/jenerik-vite.log 2>&1 &
VITE_PID=$!
echo "$VITE_PID" > /tmp/jenerik-vite.pid

cleanup() {
  kill "$API_PID" "$VITE_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "waiting for http://127.0.0.1:${VITE_PORT} and API /health …"
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1 \
    && curl -sf "http://127.0.0.1:${VITE_PORT}/" >/dev/null 2>&1; then
    echo "OK  calc BC  http://127.0.0.1:${VITE_PORT}/"
    echo "    admin    http://127.0.0.1:${VITE_PORT}/hub/admin/tenant-bc"
    echo "    logs     /tmp/jenerik-api.log  /tmp/jenerik-vite.log"
    echo "    grant    doppler run --project=bmc-backend --config=prd -- node scripts/jenerik-grant-owner.mjs EMAIL"
    trap - EXIT
    wait
    exit 0
  fi
  sleep 1
done
echo "FAILED to boot. tail:"
tail -n 40 /tmp/jenerik-api.log /tmp/jenerik-vite.log || true
exit 1
