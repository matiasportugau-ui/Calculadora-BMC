#!/usr/bin/env bash
# BMC Dashboard — Validación de contrato API
# Hace curl a endpoints GET y verifica que la respuesta tenga estructura esperada (ok, data, etc.)
# Uso: bash scripts/validate-api-contract.sh [--base=URL]

BASE_URL="${BMC_API_BASE:-http://localhost:3001}"
pass=0
fail=0

for arg in "$@"; do
  case "$arg" in
    --base=*) BASE_URL="${arg#--base=}" ;;
  esac
done

check_json() {
  local name="$1"
  local url="$2"
  local required_key="${3:-ok}"
  local resp
  resp=$(curl -s --connect-timeout 3 "$url" 2>/dev/null)
  if echo "$resp" | jq -e ".$required_key" >/dev/null 2>&1; then
    ((pass++)) || true
    echo "PASS $name"
  else
    ((fail++)) || true
    echo "FAIL $name (no .$required_key o no JSON)"
  fi
}

echo "=== API Contract Validation ==="
echo "Base: $BASE_URL"
echo ""

check_json "health" "$BASE_URL/health" "ok"
check_json "kpi-financiero" "$BASE_URL/api/kpi-financiero" "ok"
check_json "proximas-entregas" "$BASE_URL/api/proximas-entregas" "ok"
check_json "pagos-pendientes" "$BASE_URL/api/pagos-pendientes" "ok"
check_json "metas-ventas" "$BASE_URL/api/metas-ventas" "ok"
check_json "audit" "$BASE_URL/api/audit" "ok"
check_json "kpi-report" "$BASE_URL/api/kpi-report" "ok"
check_json "ventas/tabs" "$BASE_URL/api/ventas/tabs" "ok"

echo ""
echo "Total: $pass PASS, $fail FAIL"
exit $((fail > 0 ? 1 : 0))
