#!/usr/bin/env bash
# test-ml-auto-mode.sh — smoke-tests for /api/ml/auto-mode endpoints
# Usage:
#   npm run test:ml-auto           # local :3001 (starts server if needed)
#   npm run test:ml-auto:prod      # production Cloud Run

API="${1:-http://localhost:3001}"
TOKEN="$(grep -E '^API_AUTH_TOKEN=' .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')"
PASS=0; FAIL=0; OWNED_PID=""

G="\033[0;32m"; R="\033[0;31m"; B="\033[0;34m"; N="\033[0m"
ok()   { echo -e "  ${G}✅  $*${N}"; ((PASS++)) || true; }
fail() { echo -e "  ${R}❌  $*${N}"; ((FAIL++)) || true; }
info() { echo -e "  ${B}ℹ   $*${N}"; }

# curl wrapper — always times out, suppresses errors
bmc_curl() { curl -s --max-time 5 "$@" 2>/dev/null; }

# assert substring in response
assert_contains() {
  local label="$1"; shift
  local resp; resp=$(bmc_curl "$@") || { fail "$label — curl error"; return; }
  local needle="${*: -1}"; set -- "${@:1:$(($#-1))}"  # last arg is needle
  if echo "$resp" | grep -qF "$needle" 2>/dev/null; then
    ok "$label"
  else
    fail "$label — expected «$needle» in: $resp"
  fi
}

# assert JSON field equals value (python3)
assert_eq() {
  local label="$1" needle="$2" expected="$3" resp="$4"
  local got
  got=$(printf '%s' "$resp" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d$needle)
except Exception as e:
    print('__ERR__', e)
" 2>/dev/null) || got="__ERR__"
  if [ "$got" = "$expected" ]; then
    ok "$label  (got: $got)"
  else
    fail "$label  (expected: $expected, got: $got)  — resp: $resp"
  fi
}

# ── start local server if needed ────────────────────────────────────────────
if [[ "$API" == "http://localhost:3001" ]]; then
  if ! bmc_curl "${API}/health" | grep -q '"ok":true' 2>/dev/null; then
    info "Starting local API on :3001..."
    node server/index.js > /tmp/bmc-api-test.log 2>&1 &
    OWNED_PID=$!
    for i in $(seq 1 15); do
      sleep 1
      bmc_curl "${API}/health" | grep -q '"ok":true' && break
      [ "$i" -eq 15 ] && { echo -e "${R}API did not start${N}"; exit 1; }
    done
    info "API ready (pid ${OWNED_PID})"
  else
    info "Local API already running — reusing"
  fi
fi
cleanup() { [ -n "${OWNED_PID:-}" ] && kill "$OWNED_PID" 2>/dev/null && info "API stopped"; }
trap cleanup EXIT

echo ""
echo -e "${B}═══ ML auto-mode smoke tests → ${API} ═══${N}"
echo ""

# ── 1. GET public endpoint ────────────────────────────────────────────────
R1=$(bmc_curl "${API}/api/ml/auto-mode")
assert_eq "GET /api/ml/auto-mode → ok:true"            "['ok']"           "True" "$R1"
assert_eq "GET /api/ml/auto-mode → autoMode key exists" "['autoMode'] is not None" "True" "$R1"

# ── 2. POST without auth → 401 ───────────────────────────────────────────
R2=$(bmc_curl -X POST "${API}/api/ml/auto-mode" \
  -H "Content-Type: application/json" -d '{"enabled":true}')
assert_eq "POST without auth → ok:false" "['ok']" "False" "$R2"

if [ -n "$TOKEN" ]; then
  # ── 3. POST bad body → 400 ────────────────────────────────────────────
  R3=$(bmc_curl -X POST "${API}/api/ml/auto-mode" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"enabled":"yes"}')
  assert_eq "POST bad body → ok:false" "['ok']" "False" "$R3"

  # ── 4. POST enable ────────────────────────────────────────────────────
  R4=$(bmc_curl -X POST "${API}/api/ml/auto-mode" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"enabled":true}')
  assert_eq "POST enable → fullAuto:true"  "['autoMode']['fullAuto']" "True" "$R4"

  # ── 5. GET reflects enable ────────────────────────────────────────────
  R5=$(bmc_curl "${API}/api/ml/auto-mode")
  assert_eq "GET after enable → fullAuto:true" "['autoMode']['fullAuto']" "True" "$R5"

  # ── 6. POST disable ───────────────────────────────────────────────────
  R6=$(bmc_curl -X POST "${API}/api/ml/auto-mode" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"enabled":false}')
  assert_eq "POST disable → fullAuto:false" "['autoMode']['fullAuto']" "False" "$R6"

  # ── 7. GET reflects disable ───────────────────────────────────────────
  R7=$(bmc_curl "${API}/api/ml/auto-mode")
  assert_eq "GET after disable → fullAuto:false" "['autoMode']['fullAuto']" "False" "$R7"
else
  info "API_AUTH_TOKEN not in .env — skipping auth tests 3–7"
fi

# ── 8. Webhook events still alive ─────────────────────────────────────────
R8=$(bmc_curl "${API}/webhooks/ml/events")
assert_eq "GET /webhooks/ml/events → ok:true" "['ok']" "True" "$R8"

# ── 9. Simulate questions webhook (fire-and-forget → 200) ─────────────────
R9=$(bmc_curl -X POST "${API}/webhooks/ml" \
  -H "Content-Type: application/json" \
  -d '{"topic":"questions","resource":"/questions/999999999"}')
assert_eq "POST /webhooks/ml questions → ok:true" "['ok']" "True" "$R9"

# ── results ───────────────────────────────────────────────────────────────
echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "  ${G}${PASS} passed${N}  ${R}${FAIL} failed${N}  $((PASS+FAIL)) total"
echo -e "${B}════════════════════════════════════════${N}"
echo ""
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
