#!/usr/bin/env bash
# wolfboard-run.sh — cotiza pendientes, reinicia API si hace falta, abre la UI
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
LOG_FILE="/tmp/bmc-api.log"
API_PORT=3001
SHEET_URL="http://localhost:5173/hub/admin"

# ── 1. ANTHROPIC_API_KEY ──────────────────────────────────────────────────
# Prioridad: var de entorno inline > .env
KEY="${ANTHROPIC_API_KEY:-}"
if [[ -z "$KEY" ]]; then
  KEY=$(grep -E "^ANTHROPIC_API_KEY=.+" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
fi
if [[ -z "$KEY" ]]; then
  echo ""
  echo "❌  Falta ANTHROPIC_API_KEY."
  echo "    Obtenerla en: https://console.anthropic.com → API Keys"
  echo "    Uso: ANTHROPIC_API_KEY=sk-ant-... npm run wolfboard:run"
  echo ""
  exit 1
fi
# Guardar en .env si no estaba
if ! grep -qE "^ANTHROPIC_API_KEY=.+" "$ENV_FILE" 2>/dev/null; then
  if grep -q "^ANTHROPIC_API_KEY=" "$ENV_FILE" 2>/dev/null; then
    sed -i '' "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$KEY|" "$ENV_FILE"
  else
    echo "ANTHROPIC_API_KEY=$KEY" >> "$ENV_FILE"
  fi
  echo "✅  Key guardada en .env"
fi

# ── 2. Reiniciar API (con la key en env) ────────────────────────────────
OLD_PID=$(lsof -ti :$API_PORT 2>/dev/null || true)
if [[ -n "$OLD_PID" ]]; then
  kill "$OLD_PID" 2>/dev/null && sleep 1
fi

ANTHROPIC_API_KEY="$KEY" node "$ROOT/server/index.js" >> "$LOG_FILE" 2>&1 &
API_PID=$!

# Esperar hasta 8 s a que levante
for i in {1..16}; do
  sleep 0.5
  if curl -sf "http://localhost:$API_PORT/health" &>/dev/null; then break; fi
done

if ! curl -sf "http://localhost:$API_PORT/health" &>/dev/null; then
  echo "❌  API no levantó. Ver $LOG_FILE" && exit 1
fi
echo "🚀  API corriendo (PID $API_PID)"

# ── 3. Batch cotizaciones con fórmulas (sin AI key) ─────────────────────
echo ""
echo "📐  Cotizando filas con dimensiones conocidas…"
node "$ROOT/scripts/wolfboard-cotizar-batch.mjs"

# ── 4. Batch IA para el resto ────────────────────────────────────────────
echo ""
echo "🤖  Batch IA (Claude Haiku) para filas sin dimensiones…"
RESULT=$(curl -sf -X POST "http://localhost:$API_PORT/api/wolfboard/quote-batch" \
  -H "Content-Type: application/json" \
  -d '{"force":false}' 2>/dev/null || echo '{"ok":false,"error":"curl failed"}')

OK=$(echo "$RESULT" | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).ok" 2>/dev/null || echo "false")
if [[ "$OK" == "true" ]]; then
  SUC=$(echo "$RESULT" | node -pe "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); d.successful??0" 2>/dev/null || echo "?")
  SKIP=$(echo "$RESULT" | node -pe "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); d.skipped??0" 2>/dev/null || echo "?")
  FAIL=$(echo "$RESULT" | node -pe "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); d.failed??0" 2>/dev/null || echo "?")
  echo "   ✅  IA batch: $SUC generadas · $SKIP omitidas · $FAIL fallidas"
else
  ERR=$(echo "$RESULT" | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).error" 2>/dev/null || echo "unknown")
  echo "   ⚠️   IA batch falló: $ERR"
fi

# ── 5. Abrir UI ──────────────────────────────────────────────────────────
echo ""
echo "🌐  Abriendo $SHEET_URL …"
open "$SHEET_URL" 2>/dev/null || true

echo ""
echo "✔  Listo. Revisá y aprobá en /hub/admin."
echo ""
