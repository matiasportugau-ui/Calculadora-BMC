#!/usr/bin/env bash
# LaunchAgent entry: start API :3001 + Vite :5173 if not already healthy.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

RUNTIME_DIR="$REPO_ROOT/.runtime"
mkdir -p "$RUNTIME_DIR"
LOG="$RUNTIME_DIR/local-stack-launchd.log"
API_URL="http://localhost:3001/health"
WEB_URL="http://localhost:5173"

ts() { date "+%Y-%m-%dT%H:%M:%S%z"; }

up() {
  curl -sS --max-time 1 "$1" >/dev/null 2>&1
}

if up "$API_URL" && up "$WEB_URL"; then
  echo "$(ts) local stack already healthy; nothing to do." >>"$LOG"
  exit 0
fi

# Evita un segundo `dev:full` si la API quedó arriba (p. ej. Vite murió por disk:precheck).
if up "$API_URL" && ! up "$WEB_URL"; then
  echo "$(ts) API up, Vite down — starting npm run dev only…" >>"$LOG"
  exec npm run dev >>"$RUNTIME_DIR/local-stack-launchd-vite-only.log" 2>&1
fi

echo "$(ts) starting npm run dev:full (LaunchAgent)…" >>"$LOG"
exec npm run dev:full >>"$RUNTIME_DIR/local-stack-launchd-dev-full.log" 2>&1
