#!/usr/bin/env bash
# meta-ads-bootstrap-auto.sh
# Automates: Graph smoke → Doppler bmc-backend/prd → GCP Secret Manager → Cloud Run mount.
# Mirrors ~/google-ads-bootstrap-auto.sh for Meta Marketing API (Live Report PR3).
#
# Usage (prefer env vars so values never land in shell history):
#
#   export META_ADS_ACCESS_TOKEN='…'     # system-user Marketing API token
#   export META_ADS_ACCOUNT_ID='act_…'  # or numeric; optional if only validating token
#   bash scripts/meta-ads-bootstrap-auto.sh
#
# Dry-run (smoke only, no Doppler/GSM/Cloud Run):
#   META_ADS_DRY_RUN=1 bash scripts/meta-ads-bootstrap-auto.sh
#
# List ad accounts accessible by the token (helps confirm META_ADS_ACCOUNT_ID):
#   META_ADS_LIST_ACCOUNTS=1 bash scripts/meta-ads-bootstrap-auto.sh
#
# Do NOT reuse FB_PAGE_TOKEN / WhatsApp tokens.

set -euo pipefail

DOPPLER_PROJECT="${DOPPLER_PROJECT:-bmc-backend}"
DOPPLER_CONFIG="${DOPPLER_CONFIG:-prd}"
GCP_PROJECT="${GCP_PROJECT:-chatbot-bmc-live}"
CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-panelin-calc}"
GRAPH_VERSION="${GRAPH_VERSION:-v21.0}"
COUNTDOWN_SECS="${COUNTDOWN_SECS:-5}"
DRY_RUN="${META_ADS_DRY_RUN:-0}"
LIST_ONLY="${META_ADS_LIST_ACCOUNTS:-0}"

REQUIRED_KEYS=(META_ADS_ACCESS_TOKEN)
OPTIONAL_KEYS=(META_ADS_ACCOUNT_ID)
ALL_KEYS=("${REQUIRED_KEYS[@]}" "${OPTIONAL_KEYS[@]}")

trap 'unset "${ALL_KEYS[@]}" GRAPH_ME ACCOUNTS_JSON INSIGHTS_JSON 2>/dev/null || true' EXIT
set +o history 2>/dev/null || true

say()  { printf "\033[1;36m▸ %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m⚠ %s\033[0m\n" "$*"; }
err()  { printf "\033[1;31m✗ %s\033[0m\n" "$*" >&2; }
pipe_value() { printf '%s' "$1" | "${@:2}"; }

require() {
  for bin in "$@"; do
    command -v "$bin" >/dev/null || { err "Missing '$bin'"; exit 1; }
  done
}

countdown() {
  local secs="$1" label="$2"
  printf "\033[1;33m⚠ %s in " "$label"
  for ((i=secs; i>0; i--)); do printf "%d… " "$i"; sleep 1; done
  printf "\033[0m\n"
}

normalize_act() {
  local id="$1"
  [ -z "$id" ] && { echo ""; return; }
  if [[ "$id" == act_* ]]; then echo "$id"; else echo "act_${id}"; fi
}

# ─── 1. Prereqs ─────────────────────────────────────────────────────────────
say "Checking prereqs…"
require curl jq
if [ "$DRY_RUN" != "1" ] && [ "$LIST_ONLY" != "1" ]; then
  require doppler gcloud
fi
ok "Prereqs OK"

# ─── 2. Load secrets ────────────────────────────────────────────────────────
echo
say "Loading secrets (env preferred; silent prompt only on TTY)…"
for KEY in "${ALL_KEYS[@]}"; do
  if [ -n "${!KEY:-}" ]; then
    ok "$KEY ← env"
  elif [ -t 0 ]; then
    is_optional=false
    for opt in "${OPTIONAL_KEYS[@]}"; do [ "$opt" = "$KEY" ] && is_optional=true; done
    if $is_optional; then
      read -r -s -p "  $KEY (optional — Enter skip): " value
    else
      read -r -s -p "  $KEY: " value
    fi
    echo
    printf -v "$KEY" '%s' "$value"
    [ -n "$value" ] && ok "$KEY ← stdin" || warn "$KEY empty"
  else
    warn "$KEY not in env (non-interactive)"
  fi
done
unset value

for KEY in "${REQUIRED_KEYS[@]}"; do
  if [ -z "${!KEY:-}" ] || [ "${#META_ADS_ACCESS_TOKEN}" -lt 10 ]; then
    err "$KEY missing/too short. Aborting — nothing written to Doppler/GSM/Cloud Run."
    err "Create a Marketing API system-user token in Meta BM, then:"
    err "  export META_ADS_ACCESS_TOKEN='…'"
    err "  META_ADS_LIST_ACCOUNTS=1 bash scripts/meta-ads-bootstrap-auto.sh"
    err "See docs/procedimientos/META-ADS-SETUP.md"
    exit 1
  fi
done

META_ADS_ACCOUNT_ID="$(normalize_act "${META_ADS_ACCOUNT_ID:-}")"

# ─── 3. Graph smoke ─────────────────────────────────────────────────────────
echo
say "Smoke: Graph ${GRAPH_VERSION}/me + adaccounts…"
GRAPH_ME=$(curl -sS "https://graph.facebook.com/${GRAPH_VERSION}/me?fields=id,name&access_token=${META_ADS_ACCESS_TOKEN}")
if ! echo "$GRAPH_ME" | jq -e '.id' >/dev/null 2>&1; then
  err "Token invalid or wrong product. Graph said:"
  echo "$GRAPH_ME" | jq . 2>/dev/null || echo "$GRAPH_ME"
  err "Use a Marketing API system-user token — NOT FB_PAGE_TOKEN / WhatsApp."
  exit 1
fi
ok "Token works as Graph user: $(echo "$GRAPH_ME" | jq -r '.name // .id')"

ACCOUNTS_JSON=$(curl -sS "https://graph.facebook.com/${GRAPH_VERSION}/me/adaccounts?fields=id,account_id,name,account_status,currency,timezone_name&limit=50&access_token=${META_ADS_ACCESS_TOKEN}")
if ! echo "$ACCOUNTS_JSON" | jq -e '.data' >/dev/null 2>&1; then
  err "Cannot list ad accounts (missing ads_read / no ad accounts assigned):"
  echo "$ACCOUNTS_JSON" | jq . 2>/dev/null || echo "$ACCOUNTS_JSON"
  exit 1
fi

COUNT=$(echo "$ACCOUNTS_JSON" | jq '.data | length')
ok "Ad accounts visible: $COUNT"
echo "$ACCOUNTS_JSON" | jq -r '.data[] | "    \(.id)  \(.name // "?")  currency=\(.currency // "?")  status=\(.account_status // "?")"' 

if [ "$LIST_ONLY" = "1" ]; then
  say "LIST ONLY — pick META_ADS_ACCOUNT_ID from above, then re-run without META_ADS_LIST_ACCOUNTS=1"
  exit 0
fi

if [ -n "${META_ADS_ACCOUNT_ID}" ]; then
  MATCH=$(echo "$ACCOUNTS_JSON" | jq -r --arg a "$META_ADS_ACCOUNT_ID" '.data[] | select(.id == $a) | .id' | head -1)
  if [ -z "$MATCH" ]; then
    # try numeric account_id field
    NUM="${META_ADS_ACCOUNT_ID#act_}"
    MATCH=$(echo "$ACCOUNTS_JSON" | jq -r --arg n "$NUM" '.data[] | select((.account_id|tostring) == $n or .id == ("act_"+$n)) | .id' | head -1)
  fi
  if [ -z "$MATCH" ]; then
    err "META_ADS_ACCOUNT_ID=$META_ADS_ACCOUNT_ID not in token's adaccounts list."
    err "Re-run with META_ADS_LIST_ACCOUNTS=1 and pick a valid act_ id."
    exit 1
  fi
  META_ADS_ACCOUNT_ID="$MATCH"
  ok "Account confirmed for this token: $META_ADS_ACCOUNT_ID"

  say "Smoke Insights (last 7 days, spend only)…"
  SINCE=$(date -u -v-6d +%Y-%m-%d 2>/dev/null || date -u -d '6 days ago' +%Y-%m-%d)
  UNTIL=$(date -u +%Y-%m-%d)
  TIME_RANGE=$(jq -nc --arg s "$SINCE" --arg u "$UNTIL" '{since:$s,until:$u}')
  INSIGHTS_JSON=$(curl -sS -G "https://graph.facebook.com/${GRAPH_VERSION}/${META_ADS_ACCOUNT_ID}/insights" \
    --data-urlencode "fields=spend,impressions,clicks" \
    --data-urlencode "time_range=${TIME_RANGE}" \
    --data-urlencode "access_token=${META_ADS_ACCESS_TOKEN}")
  if echo "$INSIGHTS_JSON" | jq -e '.error' >/dev/null 2>&1; then
    err "Insights failed:"
    echo "$INSIGHTS_JSON" | jq .
    exit 1
  fi
  ok "Insights OK (rows=$(echo "$INSIGHTS_JSON" | jq '.data|length'))"
else
  warn "META_ADS_ACCOUNT_ID empty — skipping Insights smoke. Set it from the list above for full smoke."
fi

if [ "$DRY_RUN" = "1" ]; then
  ok "DRY_RUN=1 — smoke only. No Doppler / GSM / Cloud Run writes."
  exit 0
fi

# ─── 4. Cloud Run region ────────────────────────────────────────────────────
echo
say "Detecting Cloud Run region for ${CLOUD_RUN_SERVICE}…"
CLOUD_RUN_REGION="${CLOUD_RUN_REGION:-$(gcloud run services list \
  --project="$GCP_PROJECT" \
  --filter="metadata.name=${CLOUD_RUN_SERVICE}" \
  --format="value(region)" 2>/dev/null | head -1)}"
if [ -z "${CLOUD_RUN_REGION}" ]; then
  err "Could not detect region. Set CLOUD_RUN_REGION=us-central1 (or your region)."
  exit 1
fi
ok "Region: $CLOUD_RUN_REGION"

# ─── 5. Countdown ───────────────────────────────────────────────────────────
echo
warn "Next: write Doppler ${DOPPLER_PROJECT}/${DOPPLER_CONFIG}"
warn "      write GCP Secret Manager ${GCP_PROJECT}"
warn "      update Cloud Run ${CLOUD_RUN_SERVICE}"
countdown "$COUNTDOWN_SECS" "Writing secrets"

# ─── 6. Doppler ─────────────────────────────────────────────────────────────
echo
say "Doppler ← ${DOPPLER_PROJECT}/${DOPPLER_CONFIG}"
for KEY in META_ADS_ACCESS_TOKEN META_ADS_ACCOUNT_ID; do
  val="${!KEY:-}"
  [ -z "$val" ] && { warn "  skip $KEY (empty)"; continue; }
  pipe_value "$val" doppler secrets set "$KEY" \
    --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" --no-interactive --silent >/dev/null
  ok "  $KEY"
done

# ─── 7. GSM ─────────────────────────────────────────────────────────────────
echo
say "GCP Secret Manager ← ${GCP_PROJECT}"
GCP_SECRETS=()
for KEY in META_ADS_ACCESS_TOKEN META_ADS_ACCOUNT_ID; do
  val="${!KEY:-}"
  [ -z "$val" ] && continue
  SECRET_NAME=$(echo "$KEY" | tr '[:upper:]_' '[:lower:]-')
  if ! gcloud secrets describe "$SECRET_NAME" --project="$GCP_PROJECT" >/dev/null 2>&1; then
    gcloud secrets create "$SECRET_NAME" --project="$GCP_PROJECT" \
      --replication-policy=automatic >/dev/null
    ok "  created $SECRET_NAME"
  fi
  pipe_value "$val" gcloud secrets versions add "$SECRET_NAME" \
    --project="$GCP_PROJECT" --data-file=- >/dev/null
  ok "  version $SECRET_NAME"
  GCP_SECRETS+=("${KEY}=${SECRET_NAME}:latest")
done

# ─── 8. Cloud Run mount ─────────────────────────────────────────────────────
echo
say "Cloud Run --update-secrets (additive)"
if [ "${#GCP_SECRETS[@]}" -eq 0 ]; then
  err "No secrets to mount"
  exit 1
fi
UPDATE_ARGS=$(IFS=,; echo "${GCP_SECRETS[*]}")
gcloud run services update "$CLOUD_RUN_SERVICE" \
  --project="$GCP_PROJECT" \
  --region="$CLOUD_RUN_REGION" \
  --update-secrets="${UPDATE_ARGS}" \
  --quiet
ok "Cloud Run secrets updated: ${UPDATE_ARGS}"

echo
ok "Done. Wait for revision to serve traffic, then:"
echo "  curl -sS -H \"Authorization: Bearer \$ADMIN_JWT\" \\"
echo "    \"\$API/api/marketing/ads/meta/health\" | jq ."
echo "  # expect token_configured=true, account_configured=true"
echo "  curl -sS -H \"Authorization: Bearer \$ADMIN_JWT\" \\"
echo "    \"\$API/api/marketing/ads/meta/report?range=7d&source=live\" | jq '.meta.freshness,.kpis.spend'"
echo "  # expect freshness=live"
echo
ok "UI: /hub/marketing → Ads · Meta → Fuente Live → Actualizar"
