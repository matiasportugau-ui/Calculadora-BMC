#!/usr/bin/env bash
# Automated slice of VERIFY-workspace-envios-store-2026-08-05.md
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
API_PROD="${API_PROD:-https://calculadora-bmc.vercel.app}"
FAIL=0
pass() { echo "  ✅ $1"; }
fail() { echo "  ❌ $1"; FAIL=1; }
warn() { echo "  ⚠️  $1"; }

echo "== verify-workspace-envios-store =="
echo "root: $ROOT · $(git rev-parse --short HEAD 2>/dev/null)"

if [[ -f tests/stopStatusFsm.test.js ]] && node tests/stopStatusFsm.test.js; then pass "stopStatusFsm"
else fail "stopStatusFsm"; fi
if [[ -f tests/stopReorder.test.js ]] && node tests/stopReorder.test.js; then pass "stopReorder"
else fail "stopReorder"; fi
if node --test tests/cargoPacking.test.js tests/bridgePayload.test.js >/dev/null 2>&1; then pass "cargo+bridge"
else fail "cargo+bridge"; fi
if node tests/fleteEngine.test.js >/dev/null 2>&1; then pass "fleteEngine"
else fail "fleteEngine"; fi
if [[ -n "${DATABASE_URL:-}" ]] || [[ -f .env ]]; then
  if node --test tests/workspace-store.test.js tests/workspace-api-store.test.js >/dev/null 2>&1; then pass "workspace store"
  else fail "workspace store"; fi
else warn "skip workspace DB tests"; fi

if [[ "${PROD:-0}" == "1" ]]; then
  code=$(curl -sS -m 15 -o /tmp/vh.json -w "%{http_code}" "$API_PROD/api/workspace/health" || echo 000)
  [[ "$code" == "200" ]] && pass "health 200" || fail "health $code"
  for p in customers quotes files; do
    c=$(curl -sS -m 12 -o /dev/null -w "%{http_code}" "$API_PROD/api/workspace/$p" || echo 000)
    [[ "$c" == "401" ]] && pass "$p 401" || fail "$p $c"
  done
  c=$(curl -sS -m 12 -o /dev/null -w "%{http_code}" "https://calculadora-bmc.vercel.app/logistica" || echo 000)
  [[ "$c" == "200" ]] && pass "logistica 200" || fail "logistica $c"
fi

[[ "$FAIL" -eq 0 ]] && { echo "OK"; exit 0; } || { echo "FAIL"; exit 1; }
