#!/usr/bin/env bash
# bmc-gate-chain.sh — Pane 3: gate runner con auto-chain
#
# Modos:
#   watch   → corre gate:local cada vez que hay cambios en src/ server/
#   once    → corre gate:local una vez y sale
#   chain   → gate:local → si pasa → git commit → smoke:prod (requiere CHAIN=1)
#
# Variables de entorno:
#   CHAIN=1        → encadena commit + smoke tras gate verde
#   COMMIT_MSG=""  → mensaje del commit automático
#   AUTO_WATCH=1   → modo watch por defecto (sin argumento)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGS_DIR="/tmp/bmc-live"
COORD="$LOGS_DIR/coord.json"
GATE_LOG="$LOGS_DIR/pane3-gate.log"
COORD_LOG="$LOGS_DIR/coord.log"

mkdir -p "$LOGS_DIR"
touch "$GATE_LOG" "$COORD_LOG"

MODE="${1:-watch}"
CHAIN="${CHAIN:-0}"

log_coord() {
  echo "[$(date '+%H:%M:%S')] $1" | tee -a "$COORD_LOG"
}

run_gate() {
  echo "" | tee -a "$GATE_LOG"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$GATE_LOG"
  echo "[$(date '+%H:%M:%S')] GATE:LOCAL iniciando..." | tee -a "$GATE_LOG"

  cd "$ROOT" && npm run gate:local 2>&1 | tee -a "$GATE_LOG"
  EXIT_CODE=${PIPESTATUS[0]}

  if [[ $EXIT_CODE -eq 0 ]]; then
    echo "[$(date '+%H:%M:%S')] ✅ GATE PASS" | tee -a "$GATE_LOG"
    log_coord "GATE PASS → chain=$CHAIN"

    # Auto-chain: commit + smoke
    if [[ "$CHAIN" == "1" && -n "$COMMIT_MSG" ]]; then
      log_coord "AUTO-COMMIT: $COMMIT_MSG"
      cd "$ROOT" && git add -A && git commit -m "$COMMIT_MSG" 2>&1 | tee -a "$COORD_LOG"
      log_coord "Corriendo smoke:prod..."
      npm run smoke:prod 2>&1 | tee -a "$LOGS_DIR/smoke.log"
      SMOKE_EXIT=${PIPESTATUS[0]}
      if [[ $SMOKE_EXIT -eq 0 ]]; then
        log_coord "✅ SMOKE PASS — todo verde"
      else
        log_coord "❌ SMOKE FAIL — revisar pane2"
      fi
    fi
    return 0
  else
    echo "[$(date '+%H:%M:%S')] ❌ GATE FAIL (exit $EXIT_CODE)" | tee -a "$GATE_LOG"
    log_coord "GATE FAIL"
    return 1
  fi
}

case "$MODE" in
  once)
    run_gate
    ;;
  chain)
    CHAIN=1 run_gate
    ;;
  watch)
    echo "Modo WATCH activo — monitoreando src/ server/ tests/"
    echo "Presioná Ctrl+C para salir. CHAIN=$CHAIN"
    echo ""

    # Requiere fswatch o fallback con polling
    if command -v fswatch &>/dev/null; then
      fswatch -o "$ROOT/src" "$ROOT/server" "$ROOT/tests" | while read -r event; do
        echo "[$(date '+%H:%M:%S')] Cambio detectado — corriendo gate..."
        run_gate
        echo "Esperando próximo cambio..."
      done
    else
      echo "⚠️  fswatch no instalado — modo polling (5s)"
      echo "   Instalar: brew install fswatch"
      LAST_HASH=""
      while true; do
        HASH=$(find "$ROOT/src" "$ROOT/server" "$ROOT/tests" -name "*.js" -o -name "*.jsx" -o -name "*.mjs" 2>/dev/null | sort | xargs md5 2>/dev/null | md5)
        if [[ "$HASH" != "$LAST_HASH" && -n "$LAST_HASH" ]]; then
          echo "[$(date '+%H:%M:%S')] Cambio detectado — corriendo gate..."
          run_gate
        fi
        LAST_HASH="$HASH"
        sleep 5
      done
    fi
    ;;
  *)
    echo "Uso: bash bmc-gate-chain.sh [once|watch|chain]"
    echo "  once   → gate una vez"
    echo "  watch  → gate en cada cambio de archivo (default)"
    echo "  chain  → gate + commit + smoke (requiere COMMIT_MSG=)"
    ;;
esac
