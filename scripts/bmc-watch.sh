#!/usr/bin/env bash
# bmc-watch.sh — Pane 2: live unified log watcher for all BMC panes

LOGS_DIR="/tmp/bmc-live"
mkdir -p "$LOGS_DIR"
touch "$LOGS_DIR/pane1-dev.log" "$LOGS_DIR/pane3-gate.log" "$LOGS_DIR/smoke.log" "$LOGS_DIR/coord.log"

echo "=== BMC LOG WATCHER — $(date '+%H:%M:%S') ==="
echo "Monitoreando: pane1-dev | pane3-gate | smoke | coord"
echo ""

tail -f \
  "$LOGS_DIR/pane1-dev.log" \
  "$LOGS_DIR/pane3-gate.log" \
  "$LOGS_DIR/smoke.log" \
  "$LOGS_DIR/coord.log" | \
awk '
  /==> .*pane1-dev/  { prefix = "\033[0;36m[DEV]  \033[0m"; next }
  /==> .*pane3-gate/ { prefix = "\033[0;33m[GATE] \033[0m"; next }
  /==> .*smoke/      { prefix = "\033[0;35m[SMOKE]\033[0m"; next }
  /==> .*coord/      { prefix = "\033[0;32m[SYS]  \033[0m"; next }
  { print prefix $0 }
'
