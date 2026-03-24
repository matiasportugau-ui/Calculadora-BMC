#!/usr/bin/env bash
# Prepara y verifica el entorno para PANELSIM: credenciales Google + IDs de planillas (incl. MATRIZ de precios).
# No modifica secretos; solo crea .env desde .env.example si falta, comprueba rutas y (opcional) la API local.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SA_EMAIL="${BMC_SHEETS_SERVICE_ACCOUNT_EMAIL:-bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com}"
DEFAULT_MATRIZ_ID="1VBbVay7pwPgC40CWCIr35VbKVuxPsKBZ"
API_BASE="${BMC_API_BASE:-http://localhost:3001}"

echo "=== PANELSIM — entorno planillas (Sheets API) ==="
echo ""

bash "$REPO_ROOT/scripts/ensure-env.sh"

if [[ ! -f .env ]]; then
  echo "No hay .env — ejecutá de nuevo tras crear .env manualmente."
  exit 1
fi

# Cargar .env (valores simples KEY=VAL)
set -a
# shellcheck disable=SC1091
source .env
set +a

CREDS_RAW="${GOOGLE_APPLICATION_CREDENTIALS:-}"
MATRIZ_ID="${BMC_MATRIZ_SHEET_ID:-$DEFAULT_MATRIZ_ID}"

echo "Service account (compartir cada workbook en Drive como Lector o superior):"
echo "  $SA_EMAIL"
echo ""

if [[ -z "$CREDS_RAW" ]]; then
  echo "✗ GOOGLE_APPLICATION_CREDENTIALS no está definido en .env"
  echo "  Añadí la ruta al JSON de la service account (ver .env.example)."
  CREDS_OK=0
else
  CREDS_PATH="$CREDS_RAW"
  if [[ "$CREDS_PATH" != /* ]]; then
    CREDS_PATH="$REPO_ROOT/$CREDS_PATH"
  fi
  if [[ -f "$CREDS_PATH" ]]; then
    echo "✓ GOOGLE_APPLICATION_CREDENTIALS → archivo legible: $CREDS_PATH"
    CREDS_OK=1
  else
    echo "✗ Archivo de credenciales no encontrado: $CREDS_PATH"
    CREDS_OK=0
  fi
fi

echo ""
echo "IDs de planilla (vacío = no configurado; MATRIZ tiene default en server/config.js si omitís la var):"

check_id() {
  local name="$1"
  local val="${2:-}"
  local url_hint="${3:-}"
  if [[ -n "$val" ]]; then
    echo "  ✓ $name=$val"
  else
    echo "  ○ $name (vacío) $url_hint"
  fi
}

check_id "BMC_SHEET_ID" "${BMC_SHEET_ID:-}" "(Admin / CRM según uso)"
check_id "BMC_MATRIZ_SHEET_ID" "${BMC_MATRIZ_SHEET_ID:-}" "→ default código: $DEFAULT_MATRIZ_ID"
check_id "BMC_PAGOS_SHEET_ID" "${BMC_PAGOS_SHEET_ID:-}" ""
check_id "BMC_CALENDARIO_SHEET_ID" "${BMC_CALENDARIO_SHEET_ID:-}" ""
check_id "BMC_VENTAS_SHEET_ID" "${BMC_VENTAS_SHEET_ID:-}" ""
check_id "BMC_STOCK_SHEET_ID" "${BMC_STOCK_SHEET_ID:-}" ""

echo ""
echo "MATRIZ efectiva para GET /api/actualizar-precios-calculadora: $MATRIZ_ID"
echo "  Doc: .cursor/skills/actualizar-precios-calculadora/SKILL.md"
echo ""

if [[ "${CREDS_OK:-0}" -ne 1 ]]; then
  echo "Siguiente paso: definí GOOGLE_APPLICATION_CREDENTIALS y el JSON válido."
  exit 1
fi

echo "--- Prueba opcional de API (si no corre el servidor, ignorá los errores) ---"
if command -v curl >/dev/null 2>&1; then
  CODE_HEALTH="$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/health" 2>/dev/null || echo "000")"
  if [[ "$CODE_HEALTH" == "200" ]]; then
    echo "✓ $API_BASE/health → 200"
    CODE_MATRIZ="$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/actualizar-precios-calculadora" 2>/dev/null || echo "000")"
    if [[ "$CODE_MATRIZ" == "200" ]]; then
      echo "✓ GET /api/actualizar-precios-calculadora → 200 (MATRIZ legible vía API)"
    else
      echo "○ GET /api/actualizar-precios-calculadora → HTTP $CODE_MATRIZ (revisá permiso Drive para MATRIZ o mapping)"
    fi
  else
    echo "○ API no responde en $API_BASE (arrancá: npm run start:api)"
  fi
else
  echo "○ curl no disponible — omitiendo prueba HTTP"
fi

echo ""
echo "Listo. PANELSIM debe usar: npm run start:api y luego GET /api/* o /api/actualizar-precios-calculadora para precios."
echo "Mapa de accesos: docs/google-sheets-module/SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md"
exit 0
