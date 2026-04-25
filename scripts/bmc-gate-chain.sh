#!/usr/bin/env bash
# bmc-gate-chain.sh — Pane 3: gate runner with optional auto-chain
# Modes: once | watch (default) | chain
# Env: CHAIN=1 COMMIT_MSG="msg" → auto-commit + smoke after green gate

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGS_DIR="/tmp/bmc-live"
GATE_LOG="$LOGS_DIR/pane3-gate.log"
COORD_LOG="$LOGS_DIR/coord.log"
mkdir -p "$LOGS_DIR"
touch "$GATE_LOG" "$COORD_LOG"

MODE="${1:-watch}"
CHAIN="${CHAIN:-0}"

log_coord() { echo "[$(date '+%H:%M:%S')] $1" | tee -a "$COORD_LOG"; }

run_gate() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$GATE_LOG"
  echo "[$(date '+%H:%M:%S')] GATE:LOCAL..." | tee -a "$GATE_LOG"
  cd "$ROOT" && npm run gate:local 2>&1 | tee -a "$GATE_LOG"
  EXIT_CODE=${PIPESTATUS[0]}
  if [[ $EXIT_CODE -eq 0 ]]; then
    echo "[$(date '+%H:%M:%S')] ✅ GATE PASS" | tee -a "$GATE_LOG"
    log_coord "GATE PASS"
    if [[ "$CHAIN" == "1" && -n "$COMMIT_MSG" ]]; then
      log_coord "AUTO-COMMIT: $COMMIT_MSG"
      cd "$ROOT" && git add -A && git commit -m "$COMMIT_MSG" 2>&1 | tee -a "$COORD_LOG"
      log_coord "SMOKE:PROD..."
      npm run smoke:prod 2>&1 | tee -a "$LOGS_DIR/smoke.log"
      [[ ${PIPESTATUS[0]} -eq 0 ]] && log_coord "✅ SMOKE PASS" || log_coord "❌ SMOKE FAIL"
    fi
    return 0
  else
    echo "[$(date '+%H:%M:%S')] ❌ GATE FAIL (exit $EXIT_CODE)" | tee -a "$GATE_LOG"
    log_coord "GATE FAIL"
    return 1
  fi
}

case "$MODE" in
  once)  run_gate ;;
  chain) CHAIN=1 run_gate ;;
  watch)
    echo "WATCH activo — monitoreando src/ server/ tests/ (polling 5s)"
    LAST_HASH=""
    while true; do
      HASH=$(find "$ROOT/src" "$ROOT/server" "$ROOT/tests" \( -name "*.js" -o -name "*.jsx" -o -name "*.mjs" \) 2>/dev/null | sort | xargs md5 2>/dev/null | md5 2>/dev/null || echo "x")
      if [[ "$HASH" != "$LAST_HASH" && -n "$LAST_HASH" ]]; then
        echo "[$(date '+%H:%M:%S')] Cambio detectado → gate..."
        run_gate
      fi
      LAST_HASH="$HASH"
      sleep 5
    done
    ;;
  *) echo "Uso: bash bmc-gate-chain.sh [once|watch|chain]" ;;
esac
