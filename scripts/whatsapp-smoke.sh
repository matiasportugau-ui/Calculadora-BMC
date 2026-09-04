#!/usr/bin/env bash
# WhatsApp Cloud API smoke (curl only) — see README-whatsapp.md.
#
#   scripts/whatsapp-smoke.sh              # verify → 403 → signed 200 → real send via POST /whatsapp/send
#   scripts/whatsapp-smoke.sh --skip-send  # webhook checks only (CI / no Meta creds)
#   scripts/whatsapp-smoke.sh --only-send  # just the send
#   scripts/whatsapp-smoke.sh --direct     # send straight to graph.facebook.com (API not running)
#
# Env (read from .env when present; secrets are never printed):
#   BMC_API_BASE            default http://localhost:3001   (prod: https://panelin-calc-....run.app)
#   WA_WEBHOOK_PATH         default /whatsapp/webhook       (legacy alias: /webhooks/whatsapp)
#   WHATSAPP_VERIFY_TOKEN   hub.verify_token
#   META_APP_SECRET | WHATSAPP_APP_SECRET   HMAC for X-Hub-Signature-256
#   API_AUTH_TOKEN          Bearer for POST /whatsapp/send
#   WHATSAPP_TEST_RECIPIENT E.164 digits (default `to`)
#   WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_GRAPH_API_VERSION  (--direct only)
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1

SKIP_SEND=0; ONLY_SEND=0; DIRECT=0
for a in "$@"; do
  case "$a" in
    --skip-send) SKIP_SEND=1 ;;
    --only-send) ONLY_SEND=1 ;;
    --direct) DIRECT=1; ONLY_SEND=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown flag: $a" >&2; exit 2 ;;
  esac
done

# Load .env without clobbering exported vars; only simple KEY=value lines.
if [[ -f .env ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
    key="${line%%=*}"; val="${line#*=}"
    val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
    if [[ -z "${!key:-}" ]]; then export "$key=$val"; fi
  done < .env
fi

BASE="${BMC_API_BASE:-http://localhost:3001}"
BASE="${BASE%/}"
WEBHOOK_PATH="${WA_WEBHOOK_PATH:-/whatsapp/webhook}"
SECRET="${META_APP_SECRET:-${WHATSAPP_APP_SECRET:-}}"
CURL=(curl -sS --connect-timeout "${CURL_CONNECT_TIMEOUT:-10}" --max-time "${CURL_MAX_TIME:-40}")
PASS=0; FAIL=0
ok()   { echo "  PASS  $1"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL  $1"; FAIL=$((FAIL+1)); }
mask() { local v="$1"; [[ -z "$v" ]] && { echo "(unset)"; return; }; echo "${v:0:3}…(${#v} chars)"; }

# curl → prints body, returns status in $STATUS
STATUS=""; BODY=""
req() {
  local out
  out="$("${CURL[@]}" -w $'\n%{http_code}' "$@")" || { STATUS="000"; BODY="$out"; return 0; }
  STATUS="${out##*$'\n'}"; BODY="${out%$'\n'*}"
}

echo "WhatsApp Cloud API smoke"
echo "  base:        $BASE"
echo "  webhook:     $WEBHOOK_PATH"
echo "  verify tok:  $(mask "${WHATSAPP_VERIFY_TOKEN:-}")"
echo "  app secret:  $(mask "$SECRET")"
echo "  api token:   $(mask "${API_AUTH_TOKEN:-}")"
echo "  recipient:   ${WHATSAPP_TEST_RECIPIENT:-(unset)}"
echo

if [[ $ONLY_SEND -eq 0 ]]; then
  echo "[1/4] GET $WEBHOOK_PATH verification handshake"
  if [[ -z "${WHATSAPP_VERIFY_TOKEN:-}" ]]; then bad "WHATSAPP_VERIFY_TOKEN not set"; else
    req "$BASE$WEBHOOK_PATH?hub.mode=subscribe&hub.verify_token=${WHATSAPP_VERIFY_TOKEN}&hub.challenge=12345"
    echo "      → [$STATUS] $BODY"
    if [[ "$STATUS" == "200" && "$BODY" == "12345" ]]; then ok "challenge echoed"; else bad "expected 200 + '12345'"; fi
  fi

  PAYLOAD='{"object":"whatsapp_business_account","entry":[{"id":"smoke","changes":[{"field":"messages","value":{"messaging_product":"whatsapp","metadata":{"display_phone_number":"0","phone_number_id":"smoke"},"statuses":[{"id":"wamid.SMOKE","status":"delivered","timestamp":"0","recipient_id":"0"}]}}]}]}'

  echo "[2/4] POST $WEBHOOK_PATH with a bad X-Hub-Signature-256"
  req -X POST -H 'Content-Type: application/json' -H 'X-Hub-Signature-256: sha256=deadbeef' --data "$PAYLOAD" "$BASE$WEBHOOK_PATH"
  echo "      → [$STATUS] $BODY"
  if [[ "$STATUS" == "403" ]]; then ok "rejected with 403"; else bad "expected 403"; fi

  echo "[3/4] POST $WEBHOOK_PATH signed with the app secret"
  if [[ -z "$SECRET" ]]; then bad "META_APP_SECRET / WHATSAPP_APP_SECRET not set"; else
    SIG="$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $NF}')"
    req -X POST -H 'Content-Type: application/json' -H "X-Hub-Signature-256: sha256=$SIG" --data "$PAYLOAD" "$BASE$WEBHOOK_PATH"
    echo "      → [$STATUS] $BODY"
    if [[ "$STATUS" == "200" ]]; then ok "accepted with 200"; else bad "expected 200 (check the secret matches the server's)"; fi
  fi
fi

if [[ $SKIP_SEND -eq 0 ]]; then
  TO="${WHATSAPP_TEST_RECIPIENT:-}"
  TEXT="BMC smoke $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [[ $DIRECT -eq 1 ]]; then
    echo "[4/4] POST graph.facebook.com/{version}/{PHONE_NUMBER_ID}/messages (direct)"
    if [[ -z "${WHATSAPP_ACCESS_TOKEN:-}" || -z "${WHATSAPP_PHONE_NUMBER_ID:-}" || -z "$TO" ]]; then
      bad "WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_TEST_RECIPIENT required"
    else
      VERSION="${WHATSAPP_GRAPH_API_VERSION:-v24.0}"
      req -X POST -H "Authorization: Bearer ${WHATSAPP_ACCESS_TOKEN}" -H 'Content-Type: application/json' \
        --data "{\"messaging_product\":\"whatsapp\",\"recipient_type\":\"individual\",\"to\":\"$TO\",\"type\":\"text\",\"text\":{\"body\":\"$TEXT\"}}" \
        "https://graph.facebook.com/$VERSION/${WHATSAPP_PHONE_NUMBER_ID}/messages"
      echo "      → [$STATUS] $BODY"
      if [[ "$STATUS" == "200" && "$BODY" == *'"id":"wamid.'* ]]; then ok "Meta accepted: $(echo "$BODY" | grep -o 'wamid\.[A-Za-z0-9=_-]*' | head -1)"; else bad "no wamid in response"; fi
    fi
  else
    echo "[4/4] POST $BASE/whatsapp/send → $TO"
    if [[ -z "${API_AUTH_TOKEN:-}" ]]; then bad "API_AUTH_TOKEN not set"; else
      req -X POST -H "Authorization: Bearer ${API_AUTH_TOKEN}" -H 'Content-Type: application/json' \
        --data "{\"to\":\"$TO\",\"text\":\"$TEXT\"}" "$BASE/whatsapp/send"
      echo "      → [$STATUS] $BODY"
      if [[ "$STATUS" == "200" && "$BODY" == *'"message_id":"wamid.'* ]]; then
        ok "sent, message_id=$(echo "$BODY" | grep -o 'wamid\.[A-Za-z0-9=_-]*' | head -1)"
      else
        bad "send failed"
        case "$BODY" in
          *recipient_not_allowed*) echo "      hint: add $TO under Meta App Dashboard → WhatsApp → API Setup → 'To' (or set WHATSAPP_TEST_RECIPIENT / WHATSAPP_SEND_ALLOW_ANY=1 if the API rejected it locally)";;
          *outside_24h_window*)    echo "      hint: 24h window closed — set WHATSAPP_FALLBACK_TEMPLATE_NAME (approved template) or message the business number first";;
          *token_invalid*)         echo "      hint: WHATSAPP_ACCESS_TOKEN expired/invalid — generate a System User token and run scripts/wa-refresh-access-token.sh";;
          *whatsapp_not_configured*) echo "      hint: set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID on the API";;
          *Unauthorized*)          echo "      hint: API_AUTH_TOKEN does not match the server's";;
        esac
      fi
    fi
  fi
fi

echo
echo "summary: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]
