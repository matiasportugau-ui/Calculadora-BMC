#!/usr/bin/env bash
# bmc-dev-session.sh — tmux 4-pane workspace for Calculadora BMC
#
# Layout:
#   Pane 1 (top-left):  API :3001 + Vite :5173  (npm run dev:full)
#   Pane 2 (top-right): log watcher / bmc-watch  (tail all logs en vivo)
#   Pane 3 (bot-left):  gate runner + auto-chain  (lint → test → trigger)
#   Pane 4 (bot-right): ad-hoc / smoke / deploy   (comandos libres)
#
# Usage:
#   bash scripts/bmc-dev-session.sh          # start / attach
#   bash scripts/bmc-dev-session.sh kill     # kill session

SESSION="bmc"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGS_DIR="/tmp/bmc-live"

if [[ "$1" == "kill" ]]; then
  tmux kill-session -t "$SESSION" 2>/dev/null && echo "Session '$SESSION' killed." || echo "No session to kill."
  exit 0
fi

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Attaching to existing session '$SESSION'..."
  exec tmux attach-session -t "$SESSION"
fi

mkdir -p "$LOGS_DIR"
echo '{"gate":"idle","dev":"idle","smoke":"idle","ts":""}' > "$LOGS_DIR/coord.json"

tmux new-session -d -s "$SESSION" -x 220 -y 50

tmux send-keys -t "$SESSION:0.0" "cd '$ROOT' && clear && echo '=== PANE 1 — API :3001 + Vite :5173 ===' && npm run dev:full 2>&1 | tee $LOGS_DIR/pane1-dev.log" Enter
tmux split-window -t "$SESSION:0.0" -h
tmux send-keys -t "$SESSION:0.1" "cd '$ROOT' && clear && echo '=== PANE 2 — LOG WATCHER ===' && bash scripts/bmc-watch.sh" Enter
tmux split-window -t "$SESSION:0.0" -v
tmux send-keys -t "$SESSION:0.2" "cd '$ROOT' && clear && echo '=== PANE 3 — GATE / TESTS ===' && bash scripts/bmc-gate-chain.sh" Enter
tmux split-window -t "$SESSION:0.1" -v
tmux send-keys -t "$SESSION:0.3" "cd '$ROOT' && clear && echo '=== PANE 4 — AD-HOC / SMOKE / DEPLOY ==='" Enter

tmux select-layout -t "$SESSION:0" tiled
tmux set-option -t "$SESSION" status on
tmux set-option -t "$SESSION" status-style "bg=colour235,fg=colour250"
tmux set-option -t "$SESSION" status-left "#[fg=colour46,bold] BMC #[fg=colour250]| "
tmux set-option -t "$SESSION" status-right "#[fg=colour250]%H:%M  #[fg=colour46]#{session_name}"
tmux set-option -t "$SESSION" status-interval 5
tmux select-pane -t "$SESSION:0.0"

echo "Para ver: tmux attach-session -t bmc"
echo "Para matar: bash scripts/bmc-dev-session.sh kill"

exec tmux attach-session -t "$SESSION"
