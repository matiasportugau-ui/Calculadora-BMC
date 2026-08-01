#!/usr/bin/env bash
# Digital Marketing Agent — probe BMC marketing/ads health endpoints.
# Usage: health-probe.sh [API_BASE]
# Exit 0 always (prints JSON-ish lines); non-zero only on bad args.

set -u
API="${1:-${BMC_API_BASE:-http://127.0.0.1:3001}}"
API="${API%/}"
OUT_DIR="${DMA_RAW_DIR:-/tmp}"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="${OUT_DIR}/dma-health-${STAMP}.txt"

auth_args=()
if [[ -n "${BMC_API_TOKEN:-}" ]]; then
  auth_args=(-H "Authorization: Bearer ${BMC_API_TOKEN}")
elif [[ -n "${BMC_SERVICE_TOKEN:-}" ]]; then
  auth_args=(-H "Authorization: Bearer ${BMC_SERVICE_TOKEN}")
fi

probe() {
  local name="$1"
  local path="$2"
  local url="${API}${path}"
  local code body
  # Empty auth_args + set -u breaks "${arr[@]}" on bash; branch explicitly.
  if [[ ${#auth_args[@]} -gt 0 ]]; then
    body="$(curl -sS -m 15 -w '\n%{http_code}' "${auth_args[@]}" "$url" 2>&1)" || true
  else
    body="$(curl -sS -m 15 -w '\n%{http_code}' "$url" 2>&1)" || true
  fi
  code="$(printf '%s' "$body" | tail -n1)"
  body="$(printf '%s' "$body" | sed '$d')"
  printf '=== %s ===\nURL: %s\nHTTP: %s\n' "$name" "$url" "$code"
  printf '%s\n\n' "$(printf '%s' "$body" | head -c 4000)"
}

{
  echo "DMA health probe @ ${STAMP}"
  echo "API=${API}"
  echo
  probe "meta_health" "/api/marketing/ads/meta/health"
  probe "meta_report" "/api/marketing/ads/meta/report?range=7d"
  probe "dashboard_summary" "/api/marketing/dashboard/summary"
  probe "keywords" "/api/marketing/keywords"
  probe "ads_accounts" "/api/ads/accounts"
  probe "api_health" "/health"
} | tee "$LOG"

echo "Wrote ${LOG}" >&2
exit 0
