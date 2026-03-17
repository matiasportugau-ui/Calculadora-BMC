#!/usr/bin/env bash
# BMC Dashboard — One-Click Setup
# Validates .env, credentials, installs deps, starts API + optional ngrok, runs checks.
# Usage: ./run_dashboard_setup.sh [--no-ngrok] [--check-only]

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

ENV_FILE="$REPO_ROOT/.env"
SA_JSON="$REPO_ROOT/docs/bmc-dashboard-modernization/service-account.json"
BMC_SHEET_ID_DEFAULT="1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0"

CHECK_ONLY=false
USE_NGROK=true
for arg in "$@"; do
  case "$arg" in
    --check-only) CHECK_ONLY=true ;;
    --no-ngrok)   USE_NGROK=false ;;
  esac
done

status() { echo "[$(date +%H:%M:%S)] $*"; }
ok()    { echo "  ✓ $*"; }
fail()  { echo "  ✗ $*"; return 1; }

# --- Step 1: .env ---
ensure_env() {
  status "Step 1: .env"
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "  Creating .env from template..."
    {
      echo "VITE_GOOGLE_CLIENT_ID=642127786762-a5vph6mfgf16qqv3c125cuin4dge6d6b.apps.googleusercontent.com"
      echo "VITE_API_URL=http://localhost:3001"
      echo "BMC_SHEET_ID=$BMC_SHEET_ID_DEFAULT"
      echo "GOOGLE_APPLICATION_CREDENTIALS=\"$REPO_ROOT/docs/bmc-dashboard-modernization/service-account.json\""
    } > "$ENV_FILE"
    ok "Created .env"
  else
    ok ".env exists"
  fi

  if ! grep -q "BMC_SHEET_ID=" "$ENV_FILE" || ! grep -q "GOOGLE_APPLICATION_CREDENTIALS=" "$ENV_FILE"; then
    fail "BMC_SHEET_ID or GOOGLE_APPLICATION_CREDENTIALS missing in .env"
  fi
  ok "BMC_SHEET_ID and GOOGLE_APPLICATION_CREDENTIALS set"
}

# --- Step 2: Service account JSON ---
ensure_service_account() {
  status "Step 2: Service account JSON"
  if [[ ! -f "$SA_JSON" ]]; then
    fail "Service account JSON not found at $SA_JSON. Download from Google Cloud Console (Sheets API) and save there."
  fi
  if ! python3 -c "import json; json.load(open('$SA_JSON'))" 2>/dev/null; then
    fail "Invalid JSON in service account file"
  fi
  ok "Service account JSON valid"
}

# --- Step 3: npm install ---
ensure_deps() {
  status "Step 3: Dependencies"
  if [[ ! -d "$REPO_ROOT/node_modules" ]]; then
    npm install
    ok "npm install completed"
  else
    ok "node_modules present"
  fi
}

# --- Step 4: Health check (API must be running) ---
check_api() {
  status "Step 4: API health"
  if curl -sf "http://localhost:3001/health" >/dev/null 2>&1; then
    ok "API responding at http://localhost:3001"
  else
    fail "API not responding. Start with: npm run start:api (or npm run dev:full)"
  fi
}

# --- Step 5: Dashboard / cotizaciones ---
check_dashboard_api() {
  status "Step 5: Dashboard API (cotizaciones)"
  if curl -sf "http://localhost:3001/api/cotizaciones" 2>/dev/null | grep -q '"ok"'; then
    ok "GET /api/cotizaciones OK"
  else
    echo "  ⚠ /api/cotizaciones may fail if BMC_SHEET_ID or credentials are wrong. Check .env and sheet sharing."
  fi
}

# --- Step 6: Run checks only (no start) ---
run_checks() {
  ensure_env
  ensure_service_account
  ensure_deps
  if ! $CHECK_ONLY; then
    check_api
    check_dashboard_api
  fi
}

# --- Start API in background ---
start_api() {
  if curl -sf "http://localhost:3001/health" >/dev/null 2>&1; then
    ok "API already running"
    return 0
  fi
  status "Starting API..."
  npm run start:api &
  sleep 3
  if curl -sf "http://localhost:3001/health" >/dev/null 2>&1; then
    ok "API started on port 3001"
  else
    fail "API failed to start"
  fi
}

# --- Start ngrok ---
start_ngrok() {
  if ! command -v ngrok &>/dev/null; then
    echo "  ⚠ ngrok not installed. Skip with --no-ngrok. Install: brew install ngrok"
    return 0
  fi
  if curl -sf "http://127.0.0.1:4040/api/tunnels" 2>/dev/null | grep -q "public_url"; then
    ok "ngrok already running"
    return 0
  fi
  pkill ngrok 2>/dev/null || true
  sleep 2
  ngrok http 3001 &
  sleep 4
  if curl -sf "http://127.0.0.1:4040/api/tunnels" 2>/dev/null | grep -q "public_url"; then
    ok "ngrok tunnel started (inspector: http://127.0.0.1:4040)"
  else
    echo "  ⚠ ngrok may have failed. Run manually: ngrok http 3001"
  fi
}

# --- Main ---
main() {
  echo ""
  echo "=== BMC Dashboard One-Click Setup ==="
  echo ""

  ensure_env
  ensure_service_account
  ensure_deps

  if $CHECK_ONLY; then
    echo ""
    ok "Check-only complete. Start API manually: npm run start:api"
    exit 0
  fi

  start_api
  check_dashboard_api

  if $USE_NGROK; then
    status "Step 6: ngrok (optional)"
    start_ngrok
  fi

  echo ""
  echo "=== Setup complete ==="
  echo ""
  echo "  API:        http://localhost:3001"
  echo "  Health:     http://localhost:3001/health"
  echo "  Finanzas:   http://localhost:5173 (npm run dev) → tab Finanzas"
  echo "  Dashboard:  npm run bmc-dashboard → http://localhost:3849"
  echo ""
  if $USE_NGROK && command -v ngrok &>/dev/null; then
    echo "  ngrok:      http://127.0.0.1:4040 (inspector)"
    echo ""
  fi
}

main "$@"
