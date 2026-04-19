#!/usr/bin/env bash
# bmc-watch.sh — Pane 2: live log watcher para todos los panes BMC
# Lee /tmp/bmc-live/*.log y muestra el stream unificado con prefijos de color.

LOGS_DIR="/tmp/bmc-live"
mkdir -p "$LOGS_DIR"

# Colores ANSI
C_DEV="\033[0;36m"    # cyan   → pane1-dev
C_GATE="\033[0;33m"   # yellow → pane3-gate
C_SMOKE="\033[0;35m"  # magenta → smoke
C_COORD="\033[0;32m"  # green  → coord/status
C_RESET="\033[0m"

echo -e "${C_COORD}[watch] Esperando logs en $LOGS_DIR ...${C_RESET}"
echo -e "${C_COORD}[watch] Archivos: pane1-dev.log | pane3-gate.log | smoke.log${C_RESET}"
echo ""

# Crear archivos si no existen para que tail no falle
touch "$LOGS_DIR/pane1-dev.log"
touch "$LOGS_DIR/pane3-gate.log"
touch "$LOGS_DIR/smoke.log"
touch "$LOGS_DIR/coord.log"

# Tail unificado con etiquetas
tail -f \
  "$LOGS_DIR/pane1-dev.log" \
  "$LOGS_DIR/pane3-gate.log" \
  "$LOGS_DIR/smoke.log" \
  "$LOGS_DIR/coord.log" | \
awk '
  /==> .*(pane1-dev)/ { prefix = "\033[0;36m[DEV]  \033[0m"; next }
  /==> .*(pane3-gate)/ { prefix = "\033[0;33m[GATE] \033[0m"; next }
  /==> .*(smoke)/      { prefix = "\033[0;35m[SMOKE]\033[0m"; next }
  /==> .*(coord)/      { prefix = "\033[0;32m[SYS]  \033[0m"; next }
  { print prefix $0 }
'
