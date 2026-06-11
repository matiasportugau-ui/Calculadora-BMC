#!/bin/bash
# Automates a shared tmux monitoring dashboard for Codex, Claude, and Gemini terminals.
# Run this, then in one terminal: tmux attach -t ai-monitors

set -e

LOG_DIR=".runtime/ai-terminals"
mkdir -p "$LOG_DIR"

CODEX_LOG="$HOME/.codex/log/codex-tui.log"
CLAUDE_LOG="$HOME/.claude/daemon.log"
CLAUDE_HISTORY="$HOME/.claude/history.jsonl"
GEMINI_LOG="/tmp/gemini.log"

echo "Setting up AI terminals shared monitor..."

# Create a detached tmux session "ai-monitors" with 3 panes for logs
if tmux has-session -t ai-monitors 2>/dev/null; then
  echo "Session ai-monitors already exists. Killing old one..."
  tmux kill-session -t ai-monitors
fi

tmux new-session -d -s ai-monitors -n logs "tail -f $CODEX_LOG 2>/dev/null || echo 'Waiting for Codex log... (run codex in its terminal)'"

# Split horizontally for Claude
tmux split-window -v -t ai-monitors:logs "tail -f $CLAUDE_LOG 2>/dev/null || echo 'Waiting for Claude daemon...'; tail -f $CLAUDE_HISTORY 2>/dev/null || true"

# Split again for Gemini (user needs to start script capture in Gemini terminal first)
tmux split-window -v -t ai-monitors:logs "echo '=== Gemini Monitor ==='; echo 'To populate this: in your Gemini terminal run:'; echo 'script -q /tmp/gemini.log -c \"gemini\"'; echo; tail -f $GEMINI_LOG 2>/dev/null || echo 'Waiting for /tmp/gemini.log ...'"

tmux select-layout -t ai-monitors:logs even-vertical

# Add a 4th pane with status / instructions and enhanced live capture using helpers
tmux split-window -h -t ai-monitors:logs '
source /Users/matias/calculadora-bmc/scripts/ai-orchestrator-helpers.sh 2>/dev/null || echo "ORCHESTRATION HELPERS: source scripts/ai-orchestrator-helpers.sh to use send_claude etc. for sending instructions from the dashboard and capturing outputs to decide next steps and feed again.";
echo "=== AI TERMINALS SHARED MONITOR (ai-monitors) ===";
echo "Panes: Codex log | Claude logs | Gemini log | ENHANCED LIVE SCREENS (cycling capture_claude etc with headers, more lines, -J join)";
echo "Attach: tmux attach -t ai-monitors | Detach: Ctrl-b d";
echo "For full TUI capture: run the AI CLIs inside named tmux (codex/claude/gemini) as the active pane content (not shell for testing).";
echo "Chat monitors here give text events/history. From this Grok chat I can also run tmux send-keys to send instructions and report captures.";
echo "To orchestrate: see via monitors/captures -> decide -> send (helpers or from here) -> hear -> repeat.";
cat > /tmp/ai-live-screens.sh << "LIVE_EOF"
while true; do
  echo "=== $(date) ENHANCED LIVE SCREENS ===";
  capture_claude;
  capture_gemini;
  echo "--- CODEX ---";
  echo "Codex on s005 (in Codex terminal run: tmux new -s codex to enable full capture/send like others)";
  tail -5 $CODEX_LOG 2>/dev/null || echo "no codex log (only log tail available until moved)";
  echo "---";
  sleep 8;
done
LIVE_EOF
bash /tmp/ai-live-screens.sh
'

tmux select-layout -t ai-monitors tiled

echo "Shared monitor session 'ai-monitors' created."
echo "Attach with: tmux attach -t ai-monitors"
echo "Detach with: Ctrl+B then d"
echo
echo "For full terminal content (not just logs), run the agents inside tmux sessions named codex/claude/gemini."
