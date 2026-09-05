#!/usr/bin/env bash
# wa-send-template.sh — envía una plantilla aprobada (default hello_world) a un destinatario.
#
# Lee `.env` (source). NO imprime el access token. Dispara un WhatsApp REAL.
#
# Uso:
#   bash scripts/wa-send-template.sh +59899470813
#   bash scripts/wa-send-template.sh +59899470813 hello_world en_US
#
#   $1  destinatario en E.164 (con o sin '+'; se normaliza a dígitos)   [requerido]
#   $2  nombre de plantilla    (default: $TEMPLATE_NAME o hello_world)
#   $3  código de idioma       (default: $TEMPLATE_LANG o en_US)
#
# Env override: GRAPH_API_VERSION (default v21.0), CURL_MAX_TIME, WA_SEND_YES=1 (salta confirmación).
# Imprime el `wamid.*` devuelto por Graph.

set -euo pipefail
cd "$(dirname "$0")/.." || exit 1

GRAPH_API_VERSION="${GRAPH_API_VERSION:-v21.0}"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-10}"
CURL_MAX_TIME="${CURL_MAX_TIME:-30}"
GRAPH="https://graph.facebook.com/${GRAPH_API_VERSION}"

command -v jq >/dev/null 2>&1 || { echo "ERROR: falta 'jq' (instalá jq)." >&2; exit 1; }

RECIPIENT_RAW="${1:-}"
if [[ -z "$RECIPIENT_RAW" ]]; then
  echo "Uso: bash scripts/wa-send-template.sh <destinatario E.164> [plantilla] [idioma]" >&2
  exit 1
fi
# Normalizar a solo dígitos (Graph espera E.164 sin '+').
TO="$(printf '%s' "$RECIPIENT_RAW" | tr -cd '0-9')"
[[ -n "$TO" ]] || { echo "ERROR: destinatario inválido: '$RECIPIENT_RAW'" >&2; exit 1; }

if [[ ! -f .env ]]; then
  echo "ERROR: no existe .env." >&2; exit 1
fi
# Lee una variable de .env de forma segura (sin ejecutar el archivo). Precedencia:
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

TEMPLATE="${2:-${TEMPLATE_NAME:-hello_world}}"
LANG_CODE="${3:-${TEMPLATE_LANG:-en_US}}"

miss=()
[[ -n "${WHATSAPP_ACCESS_TOKEN:-}" ]] || miss+=("WHATSAPP_ACCESS_TOKEN")
[[ -n "${WHATSAPP_PHONE_NUMBER_ID:-}" ]] || miss+=("WHATSAPP_PHONE_NUMBER_ID")
if (( ${#miss[@]} )); then
  echo "ERROR: faltan variables en .env: ${miss[*]}" >&2
  exit 1
fi

# Confirmación (dispara un mensaje real). WA_SEND_YES=1 la salta (CI/no interactivo).
MASKED="${TO:0:5}****${TO: -2}"
if [[ "${WA_SEND_YES:-0}" != "1" ]]; then
  printf 'Enviar plantilla "%s" (%s) a %s vía phone_id %s? [y/N] ' "$TEMPLATE" "$LANG_CODE" "$MASKED" "$WHATSAPP_PHONE_NUMBER_ID"
  read -r ans
  [[ "$ans" =~ ^[yY]$ ]] || { echo "Cancelado."; exit 0; }
fi

BODY="$(jq -nc --arg to "$TO" --arg name "$TEMPLATE" --arg lang "$LANG_CODE" \
  '{messaging_product:"whatsapp", to:$to, type:"template", template:{name:$name, language:{code:$lang}}}')"

RESP="$(curl -sS --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time "$CURL_MAX_TIME" \
  -X POST "${GRAPH}/${WHATSAPP_PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer ${WHATSAPP_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$BODY")" || { echo "ERROR: red/timeout al enviar." >&2; exit 1; }

if echo "$RESP" | jq -e '.error' >/dev/null 2>&1; then
  echo "ERROR Graph: $(echo "$RESP" | jq -c '.error')" >&2
  exit 1
fi

WAMID="$(echo "$RESP" | jq -r '.messages[0].id // empty')"
if [[ -z "$WAMID" ]]; then
  echo "ERROR: respuesta sin wamid: $(echo "$RESP" | jq -c '.')" >&2
  exit 1
fi
echo "✓ Enviado. wamid: ${WAMID}"
echo "  (el estado 'delivered' llega por webhook messages.statuses, o consultá el cockpit /hub/wa)"
