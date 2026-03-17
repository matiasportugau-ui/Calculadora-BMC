#!/usr/bin/env bash
# Super Agente BMC Dashboard — Full Audit Script
# Runs all 9 steps in exact order and produces REPORTE SUPER AGENTE BMC — ESTADO COMPLETO
# Usage: bash .cursor/skills/super-agente-bmc-dashboard/scripts/run_audit.sh [--output FILE]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../" && pwd)"
cd "$REPO_ROOT"

OUTPUT_FILE=""
for arg in "$@"; do
  case "$arg" in
    --output=*) OUTPUT_FILE="${arg#--output=}" ;;
  esac
done

if [[ -z "$OUTPUT_FILE" ]]; then
  OUTPUT_FILE="/tmp/reporte-super-agente-bmc-$(date +%Y%m%d-%H%M%S).md"
fi

report() { echo "$@" >> "$OUTPUT_FILE"; }
section() { echo "" >> "$OUTPUT_FILE"; echo "## $1" >> "$OUTPUT_FILE"; echo "" >> "$OUTPUT_FILE"; }

# --- Start report ---
{
  echo "# REPORTE SUPER AGENTE BMC — ESTADO COMPLETO"
  echo ""
  echo "Generado: $(date '+%Y-%m-%dT%H:%M:%S%z')"
  echo "Repo: $REPO_ROOT"
  echo ""
} > "$OUTPUT_FILE"

# --- 1. Log Anomaly Analysis ---
section "LOG 5 DÍAS / Análisis Anomalías Logs"
LOG_FILES=$(find . -type f \( -name "*.log" -o -path "*/.codebuddy/logs/*" -o -path "*/logs/*.log" \) -not -path "./node_modules/*" -not -path "./.git/*" 2>/dev/null | head -30)
if [[ -n "$LOG_FILES" ]]; then
  report "Archivos de log encontrados:"
  echo "$LOG_FILES" >> "$OUTPUT_FILE"
  report ""
  for f in $LOG_FILES; do
    if [[ -f "$f" ]]; then
      report "=== $f (últimas 200 líneas) ==="
      tail -n 200 "$f" 2>/dev/null >> "$OUTPUT_FILE" || report "(no legible)"
      report ""
    fi
  done
else
  report "No se encontraron archivos .log. Pino escribe a stdout por defecto."
  report "Sugerencia: LOG_LEVEL=debug y redirección para futuras ejecuciones."
fi

# --- 2. System State ---
section "Estado del Sistema"
report "Health:"
curl -sf "http://localhost:3001/health" 2>/dev/null | jq . 2>/dev/null >> "$OUTPUT_FILE" || report "API no responde"
report ""
report "Procesos node:"
pgrep -fl "node.*server" 2>/dev/null >> "$OUTPUT_FILE" || report "Ninguno"
report ""
report "Puertos:"
for p in 3001 3849 5173 4040; do
  lsof -i :$p 2>/dev/null | head -2 >> "$OUTPUT_FILE" || true
done

# --- 3. Git History ---
section "Git History"
report "Últimos 20 commits:"
git log --oneline -20 2>/dev/null >> "$OUTPUT_FILE"
report ""
report "Status:"
git status -s 2>/dev/null >> "$OUTPUT_FILE"
report ""
report "Branches:"
git branch -a 2>/dev/null >> "$OUTPUT_FILE"

# --- 4. Config ---
section "Config (.env + service-account)"
if [[ -f .env ]]; then
  report ".env existe. Vars (valores ocultos):"
  grep -E "BMC_SHEET_ID|GOOGLE_APPLICATION_CREDENTIALS|ML_CLIENT|VITE_" .env 2>/dev/null | sed 's/=.*/=***/' >> "$OUTPUT_FILE"
else
  report ".env NO existe"
fi
report ""
if [[ -f docs/bmc-dashboard-modernization/service-account.json ]]; then
  if python3 -c "import json; json.load(open('docs/bmc-dashboard-modernization/service-account.json'))" 2>/dev/null; then
    report "service-account.json: OK (JSON válido)"
  else
    report "service-account.json: JSON inválido"
  fi
else
  report "service-account.json: NO encontrado"
fi

# --- 5. Dependencies ---
section "Dependencias"
report "npm ls --depth=0:"
npm ls --depth=0 2>&1 >> "$OUTPUT_FILE"
report ""
report "npm audit:"
npm audit --audit-level=moderate 2>&1 >> "$OUTPUT_FILE" || npm audit 2>&1 >> "$OUTPUT_FILE" || report "npm audit no disponible"
report ""
[[ -f package-lock.json ]] && report "package-lock.json: OK" || report "package-lock.json: FALTA"

# --- 6. Endpoints ---
section "Endpoints"
report "GET /health:"
curl -sf "http://localhost:3001/health" 2>/dev/null | jq . >> "$OUTPUT_FILE" || report "No responde"
report ""
report "GET /api/cotizaciones:"
curl -sf "http://localhost:3001/api/cotizaciones" 2>/dev/null | jq '.ok, (.data | length)' >> "$OUTPUT_FILE" || report "No responde"

# --- 7. Security ---
section "Seguridad"
report ".gitignore:"
grep -E "\.env|service-account" .gitignore 2>/dev/null >> "$OUTPUT_FILE" || report ".env/service-account no en .gitignore"
report ""
report "Archivos sensibles en repo:"
git ls-files | grep -E "\.env$|service-account\.json" 2>/dev/null >> "$OUTPUT_FILE" || report "Ninguno (OK)"

# --- 8. Sheets + Scopes ---
section "Sheets + Scopes"
report "BMC_SHEET_ID: $(grep BMC_SHEET_ID .env 2>/dev/null | sed 's/.*=//' | tr -d '"' || echo 'no configurado')"
report ""
report "GET /api/cotizaciones:"
curl -sf "http://localhost:3001/api/cotizaciones" 2>/dev/null | jq '.ok, .error' >> "$OUTPUT_FILE" || report "No responde"

# --- 9. Viewer + ngrok ---
section "Viewer + ngrok"
report "ngrok tunnels:"
curl -sf "http://127.0.0.1:4040/api/tunnels" 2>/dev/null | jq '.tunnels[]?.public_url' >> "$OUTPUT_FILE" || report "ngrok no corriendo"
report ""
report "URLs:"
report "- Dashboard (Vite): http://localhost:5173"
report "- Dashboard standalone: http://localhost:3849"
report "- Finanzas: http://localhost:5173 → tab Finanzas"
report "- ngrok inspector: http://127.0.0.1:4040"

# --- Estado Actual + Fixes ---
section "Estado Actual + Fixes"
report "Resumen: revisar secciones anteriores. Recomendaciones:"
report "- Si API no responde: npm run start:api"
report "- Si .env falta: copiar de .env.example"
report "- Si service-account falta: descargar de GCP, guardar en docs/bmc-dashboard-modernization/"
report "- Si cotizaciones falla: verificar BMC_SHEET_ID y compartir sheet con service account"
report "- Para logs persistentes: node server/index.js 2>&1 | tee server.log"

echo ""
echo "Reporte generado: $OUTPUT_FILE"
echo ""
cat "$OUTPUT_FILE"
