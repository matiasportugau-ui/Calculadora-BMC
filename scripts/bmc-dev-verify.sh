#!/usr/bin/env bash
# One-shot local verification for Panelin / Calculadora BMC (agent context, CI-style).
# Usage:
#   bash scripts/bmc-dev-verify.sh
#   bash scripts/bmc-dev-verify.sh --no-install
#   bash scripts/bmc-dev-verify.sh --full
#   bash scripts/bmc-dev-verify.sh --with-contracts
#   bash scripts/bmc-dev-verify.sh --smoke-prod
#   bash scripts/bmc-dev-verify.sh --all
# Env:
#   BMC_API_BASE  (default http://localhost:3001) for contract validation
#   VERIFY_SKIP_EPHEMERAL_API=1  — with --all/--with-contracts, do not auto-start API (fail if down)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DO_INSTALL=1
DO_FULL=0
DO_CONTRACTS=0
DO_SMOKE_PROD=0

EPHEMERAL_API_PID=""

api_base() {
  echo "${BMC_API_BASE:-http://localhost:3001}"
}

cleanup() {
  if [[ -n "$EPHEMERAL_API_PID" ]]; then
    echo "==> Stopping ephemeral API (pid $EPHEMERAL_API_PID)"
    kill "$EPHEMERAL_API_PID" 2>/dev/null || true
    wait "$EPHEMERAL_API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

usage() {
  sed -n '2,14p' "$0" | tr -d '#'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage 0 ;;
    --no-install) DO_INSTALL=0 ;;
    --full) DO_FULL=1 ;;
    --with-contracts) DO_CONTRACTS=1 ;;
    --smoke-prod) DO_SMOKE_PROD=1 ;;
    --all)
      DO_FULL=1
      DO_CONTRACTS=1
      DO_SMOKE_PROD=1
      ;;
    *) echo "Unknown arg: $1" >&2; usage 1 ;;
  esac
  shift
done

api_reachable() {
  local base
  base="$(api_base)"
  curl -sf --max-time 2 "${base}/capabilities" >/dev/null 2>&1
}

ensure_api_for_contracts() {
  [[ "$DO_CONTRACTS" -eq 1 ]] || return 0
  local base
  base="$(api_base)"
  echo "==> test:contracts (API ${base})"
  if api_reachable; then
    npm run test:contracts
    return 0
  fi
  if [[ "$base" != "http://localhost:3001" && "$base" != "http://127.0.0.1:3001" ]]; then
    echo "    API not reachable at ${base}. Set BMC_API_BASE or start your API." >&2
    exit 1
  fi
  if [[ "${VERIFY_SKIP_EPHEMERAL_API:-}" == "1" ]]; then
    echo "    API not reachable and VERIFY_SKIP_EPHEMERAL_API=1 — start: npm run start:api" >&2
    exit 1
  fi
  echo "    Starting ephemeral API (node server/index.js) …"
  node server/index.js &
  EPHEMERAL_API_PID=$!
  local i
  for i in $(seq 1 45); do
    if api_reachable; then
      npm run test:contracts
      return 0
    fi
    sleep 1
  done
  echo "    API did not become ready in time (GET /capabilities)." >&2
  exit 1
}

echo "==> Repo: $ROOT"

if [[ "$DO_INSTALL" -eq 1 ]]; then
  echo "==> npm ci"
  npm ci
else
  echo "==> Skip npm ci (--no-install)"
fi

if [[ "$DO_FULL" -eq 1 ]]; then
  echo "==> gate:local:full (lint + test + build)"
  npm run gate:local:full
else
  echo "==> gate:local (lint + test)"
  npm run gate:local
fi

ensure_api_for_contracts

if [[ "$DO_SMOKE_PROD" -eq 1 ]]; then
  echo "==> smoke:prod"
  npm run smoke:prod
fi

echo "==> Done."
