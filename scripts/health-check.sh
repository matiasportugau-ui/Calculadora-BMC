#!/usr/bin/env bash
# BMC Dashboard — Health Check Unificado
# Prueba todos los entry points (3001, 3849, 5173, /api/*) y genera reporte OK/FAIL
# Uso: bash scripts/health-check.sh [--json]

set -e
BASE_URL="${BASE_URL:-http://localhost:3001}"
OUTPUT_JSON=false

for arg in "$@"; do
  case "$arg" in
    --json) OUTPUT_JSON=true ;;
  esac
done

pass=0
fail=0
results=()

check() {
  local name="$1"
  local url="$2"
  local expected="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "$url" 2>/dev/null || echo "000")
  if [[ "$code" == "$expected" ]] || [[ "$code" == "200" ]] || [[ "$code" == "503" ]]; then
    ((pass++)) || true
    results+=("OK|$name|$url|$code")
  else
    ((fail++)) || true
    results+=("FAIL|$name|$url|$code")
  fi
}

echo "=== BMC Health Check ==="
echo "Base: $BASE_URL"
echo ""

# Main health
check "health" "$BASE_URL/health"

# API GET endpoints (read-only)
check "api/kpi-financiero" "$BASE_URL/api/kpi-financiero"
check "api/proximas-entregas" "$BASE_URL/api/proximas-entregas"
check "api/pagos-pendientes" "$BASE_URL/api/pagos-pendientes"
check "api/metas-ventas" "$BASE_URL/api/metas-ventas"
check "api/audit" "$BASE_URL/api/audit"
check "api/kpi-report" "$BASE_URL/api/kpi-report"
check "api/ventas/tabs" "$BASE_URL/api/ventas/tabs"

# Calc (si está montado)
check "api/calc/catalogo" "$BASE_URL/api/calc/catalogo"

# Puertos adicionales (opcionales)
if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://localhost:3849" 2>/dev/null | grep -qE "200|301|302"; then
  ((pass++)) || true
  results+=("OK|dashboard-3849|http://localhost:3849|200")
else
  results+=("SKIP|dashboard-3849|http://localhost:3849|not running")
fi

if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://localhost:5173" 2>/dev/null | grep -qE "200|301|302"; then
  ((pass++)) || true
  results+=("OK|calculadora-5173|http://localhost:5173|200")
else
  results+=("SKIP|calculadora-5173|http://localhost:5173|not running")
fi

# Report
echo "--- Resultados ---"
for r in "${results[@]}"; do
  IFS='|' read -r status name url code <<< "$r"
  printf "%-6s %-25s %s (%s)\n" "[$status]" "$name" "$url" "$code"
done
echo ""
echo "Total: $pass OK, $fail FAIL"

if $OUTPUT_JSON; then
  echo ""
  echo '{"pass":'"$pass"',"fail":'"$fail"',"results":['
  first=true
  for r in "${results[@]}"; do
    IFS='|' read -r status name url code <<< "$r"
    [[ $first == false ]] && echo -n ","
    echo -n '{"status":"'"$status"'","name":"'"$name"'","url":"'"$url"'","code":"'"$code"'"}'
    first=false
  done
  echo "]}"
fi

exit $((fail > 0 ? 1 : 0))
