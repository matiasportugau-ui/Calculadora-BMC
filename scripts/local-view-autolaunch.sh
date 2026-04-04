#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

OPEN_BROWSER=false
for arg in "$@"; do
  case "$arg" in
    --open) OPEN_BROWSER=true ;;
  esac
done

API_URL="http://localhost:3001/health"
WEB_URL="http://localhost:5173"
RUNTIME_DIR="$REPO_ROOT/.runtime"
mkdir -p "$RUNTIME_DIR"

api_up() {
  curl -sS --max-time 1 "$API_URL" >/dev/null 2>&1
}

web_up() {
  curl -sS --max-time 1 "$WEB_URL" >/dev/null 2>&1
}

start_bg() {
  local cmd="$1"
  local log_file="$2"
  nohup bash -lc "cd \"$REPO_ROOT\" && $cmd" >"$log_file" 2>&1 &
  echo "$!"
}

wait_until_up() {
  local tries=45
  while (( tries > 0 )); do
    if api_up && web_up; then
      return 0
    fi
    sleep 1
    tries=$((tries - 1))
  done
  return 1
}

API_OK=false
WEB_OK=false
if api_up; then API_OK=true; fi
if web_up; then WEB_OK=true; fi

if [[ "$API_OK" == true && "$WEB_OK" == true ]]; then
  echo "Local stack already running."
else
  if [[ "$API_OK" == false && "$WEB_OK" == false ]]; then
    PID="$(start_bg "npm run dev:full" "$RUNTIME_DIR/local-view-dev-full.log")"
    echo "Started full stack (pid $PID) -> npm run dev:full"
  elif [[ "$API_OK" == false ]]; then
    PID="$(start_bg "npm run start:api" "$RUNTIME_DIR/local-view-api.log")"
    echo "Started API only (pid $PID) -> npm run start:api"
  elif [[ "$WEB_OK" == false ]]; then
    PID="$(start_bg "npm run dev" "$RUNTIME_DIR/local-view-vite.log")"
    echo "Started Vite only (pid $PID) -> npm run dev"
  fi
fi

if wait_until_up; then
  echo ""
  echo "Local stack ready:"
  echo "  - Frontend: http://localhost:5173"
  echo "  - API:      http://localhost:3001"
  echo "  - Health:   http://localhost:3001/health"
  if [[ "$OPEN_BROWSER" == true ]]; then
    if command -v open >/dev/null 2>&1; then
      open "$WEB_URL" || true
    fi
  fi
  exit 0
fi

echo "Local stack did not become ready in time."
echo "Check logs in: $RUNTIME_DIR"
exit 1

