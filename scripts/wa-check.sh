#!/usr/bin/env bash
# wa-check.sh — read-only health check de la conexión WhatsApp Cloud API.
#
# Lee `.env` del repo (source). NO imprime el access token ni el app secret.
# Comprueba, contra Graph API:
#   1. GET /debug_token           → validez + scopes del WHATSAPP_ACCESS_TOKEN
#                                    (requiere META_APP_ID + WHATSAPP_APP_SECRET para el app token).
#   2. GET /{WABA_ID}             → id, name, account_review_status.
#   3. GET /{PHONE_NUMBER_ID}     → display_phone_number, verified_name, quality_rating,
#                                    code_verification_status.
#
# Uso:  bash scripts/wa-check.sh
# Env override: GRAPH_API_VERSION (default v21.0), CURL_MAX_TIME.
#
# Salida ≠ 0 si falta una variable, el token es inválido, o faltan los scopes de WhatsApp.

set -euo pipefail
cd "$(dirname "$0")/.." || exit 1

GRAPH_API_VERSION="${GRAPH_API_VERSION:-v21.0}"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-10}"
CURL_MAX_TIME="${CURL_MAX_TIME:-30}"
GRAPH="https://graph.facebook.com/${GRAPH_API_VERSION}"
REQUIRED_SCOPES=(whatsapp_business_messaging whatsapp_business_management)

command -v jq >/dev/null 2>&1 || { echo "ERROR: falta 'jq' (instalá jq)." >&2; exit 1; }

# --- cargar .env sin volcar secretos al entorno global del shell del usuario ---
if [[ ! -f .env ]]; then
  echo "ERROR: no existe .env (copiá .env.example y completá los valores)." >&2
  exit 1
fi
# Lee una variable de .env de forma segura (sin ejecutar el archivo — .env puede
# tener valores con espacios/JSON/paréntesis que romperían `source`). Precedencia:
# variable ya exportada en el entorno > .env.
readenv() {
  local key="$1" val
  if [[ -n "${!key:-}" ]]; then printf '%s' "${!key}"; return 0; fi
  val="$(grep -E "^[[:space:]]*${key}=" .env | tail -n1 || true)"
  [[ -z "$val" ]] && return 0
  val="${val#*=}"; val="${val%$'\r'}"
  case "$val" in
    \"*\") val="${val#\"}"; val="${val%\"}" ;;
    \'*\') val="${val#\'}"; val="${val%\'}" ;;
  esac
  printf '%s' "$val"
}

WHATSAPP_ACCESS_TOKEN="$(readenv WHATSAPP_ACCESS_TOKEN)"
WHATSAPP_PHONE_NUMBER_ID="$(readenv WHATSAPP_PHONE_NUMBER_ID)"
META_APP_ID="$(readenv META_APP_ID)"
WHATSAPP_APP_SECRET="$(readenv WHATSAPP_APP_SECRET)"
WABA_ID="$(readenv WABA_ID)"
[[ -n "$WABA_ID" ]] || WABA_ID="$(readenv WHATSAPP_WABA_ID)"

miss=()
[[ -n "${WHATSAPP_ACCESS_TOKEN:-}" ]] || miss+=("WHATSAPP_ACCESS_TOKEN")
[[ -n "${WHATSAPP_PHONE_NUMBER_ID:-}" ]] || miss+=("WHATSAPP_PHONE_NUMBER_ID")
[[ -n "${WABA_ID:-}" ]] || miss+=("WABA_ID")
[[ -n "${META_APP_ID:-}" ]] || miss+=("META_APP_ID")
[[ -n "${WHATSAPP_APP_SECRET:-}" ]] || miss+=("WHATSAPP_APP_SECRET")
if (( ${#miss[@]} )); then
  echo "ERROR: faltan variables en .env: ${miss[*]}" >&2
  echo "  Plantilla: .env.example — runbook: docs/team/runbooks/wa-connect-numero-coexistencia.md" >&2
  exit 1
fi

echo "WhatsApp Cloud API — health check (${GRAPH_API_VERSION})"
echo "  META_APP_ID              ${META_APP_ID}"
echo "  WABA_ID                  ${WABA_ID}"
echo "  WHATSAPP_PHONE_NUMBER_ID ${WHATSAPP_PHONE_NUMBER_ID}"
echo "  WHATSAPP_ACCESS_TOKEN    (definido, ${#WHATSAPP_ACCESS_TOKEN} chars — no se imprime)"
echo

_get() { # $1 = url  → cuerpo en stdout; error de red = exit 1
  curl -sS --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time "$CURL_MAX_TIME" "$@"
}

fail=0

# 1) debug_token — app access token = "{app-id}|{app-secret}" (nunca se imprime).
echo "── 1. Token (GET /debug_token) ──"
APP_TOKEN="${META_APP_ID}|${WHATSAPP_APP_SECRET}"
DBG="$(_get "${GRAPH}/debug_token?input_token=${WHATSAPP_ACCESS_TOKEN}&access_token=${APP_TOKEN}")" || {
  echo "  ERROR: red/timeout al llamar /debug_token" >&2; exit 1; }
if echo "$DBG" | jq -e '.error' >/dev/null 2>&1; then
  echo "  ERROR Graph: $(echo "$DBG" | jq -c '.error')" >&2
  fail=1
else
  IS_VALID="$(echo "$DBG" | jq -r '.data.is_valid // false')"
  EXPIRES="$(echo "$DBG" | jq -r '.data.expires_at // 0')"
  SCOPES="$(echo "$DBG" | jq -r '.data.scopes // [] | join(",")')"
  if [[ "$EXPIRES" == "0" ]]; then EXP_H="nunca (permanente)"; else EXP_H="$(date -u -d "@${EXPIRES}" 2>/dev/null || echo "@${EXPIRES}")"; fi
  echo "  is_valid:   ${IS_VALID}"
  echo "  expira:     ${EXP_H}"
  echo "  scopes:     ${SCOPES:-(ninguno)}"
  [[ "$IS_VALID" == "true" ]] || { echo "  ✗ token inválido" >&2; fail=1; }
  for s in "${REQUIRED_SCOPES[@]}"; do
    if echo "$DBG" | jq -e --arg s "$s" '.data.scopes // [] | index($s)' >/dev/null 2>&1; then
      echo "  ✓ scope ${s}"
    else
      echo "  ✗ FALTA scope ${s}" >&2; fail=1
    fi
  done
fi
echo

# 2) WABA
echo "── 2. WABA (GET /${WABA_ID}) ──"
WABA_JSON="$(_get "${GRAPH}/${WABA_ID}?fields=id,name,account_review_status" -H "Authorization: Bearer ${WHATSAPP_ACCESS_TOKEN}")" || {
  echo "  ERROR: red/timeout" >&2; exit 1; }
if echo "$WABA_JSON" | jq -e '.error' >/dev/null 2>&1; then
  echo "  ERROR Graph: $(echo "$WABA_JSON" | jq -c '.error')" >&2; fail=1
else
  echo "$WABA_JSON" | jq '{id, name, account_review_status}'
fi
echo

# 3) Número
echo "── 3. Número (GET /${WHATSAPP_PHONE_NUMBER_ID}) ──"
NUM_JSON="$(_get "${GRAPH}/${WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,quality_rating,code_verification_status" -H "Authorization: Bearer ${WHATSAPP_ACCESS_TOKEN}")" || {
  echo "  ERROR: red/timeout" >&2; exit 1; }
if echo "$NUM_JSON" | jq -e '.error' >/dev/null 2>&1; then
  echo "  ERROR Graph: $(echo "$NUM_JSON" | jq -c '.error')" >&2; fail=1
else
  echo "$NUM_JSON" | jq '{display_phone_number, verified_name, quality_rating, code_verification_status}'
  CVS="$(echo "$NUM_JSON" | jq -r '.code_verification_status // ""')"
  [[ "$CVS" == "VERIFIED" ]] && echo "  ✓ code_verification_status VERIFIED" || echo "  ⚠ code_verification_status = ${CVS:-desconocido}"
fi
echo

if (( fail )); then
  echo "RESULTADO: FALLÓ — revisá los ✗ de arriba." >&2
  exit 1
fi
echo "RESULTADO: OK — token válido con ambos scopes, WABA y número accesibles."
