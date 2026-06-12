#!/bin/bash
# ai-orchestrator-helpers.sh
# Source this in the ai-monitors control pane or any shell with tmux access to the AI sessions.
# Provides easy functions to SEND instructions to and CAPTURE outputs from the terminals.
# Use for orchestration loop: decide -> send -> hear (via monitors or capture) -> decide next -> feed again.
#
# Usage after source:
#   send_claude "your instruction or prompt here"
#   capture_claude
#   send_gemini "..."
#   etc.
#   orchestrate_status

# Send to the claude tmux session (appears as input to the Claude TUI)
send_claude() {
  local msg="$*"
  if tmux has-session -t claude 2>/dev/null; then
    tmux send-keys -t claude "$msg" Enter
    echo "[orchestrator] Sent to claude: $msg"
  else
    echo "[orchestrator] claude session not found"
  fi
}

# Capture current screen from claude tmux (what the Claude TUI is showing)
capture_claude() {
  if tmux has-session -t claude 2>/dev/null; then
    echo "=== CLAUDE SCREEN $(date) ==="
    tmux capture-pane -t claude -p -J | tail -25
  else
    echo "[orchestrator] claude session not found"
  fi
}

# Send to the gemini tmux session
send_gemini() {
  local msg="$*"
  if tmux has-session -t gemini 2>/dev/null; then
    tmux send-keys -t gemini "$msg" Enter
    echo "[orchestrator] Sent to gemini: $msg"
  else
    echo "[orchestrator] gemini session not found"
  fi
}

# Capture current screen from gemini tmux
capture_gemini() {
  if tmux has-session -t gemini 2>/dev/null; then
    echo "=== GEMINI SCREEN $(date) ==="
    tmux capture-pane -t gemini -p -J | tail -25
  else
    echo "[orchestrator] gemini session not found"
  fi
}

# Send to codex (only if moved to named tmux 'codex' in its terminal)
send_codex() {
  local msg="$*"
  if tmux has-session -t codex 2>/dev/null; then
    tmux send-keys -t codex "$msg" Enter
    echo "[orchestrator] Sent to codex: $msg"
  else
    echo "[orchestrator] codex not in named tmux session. In the Codex terminal (s005) run: tmux new -s codex"
    echo "Then run codex inside it. Only log tail is available until then."
  fi
}

# Capture current screen from codex (only if in named tmux)
capture_codex() {
  if tmux has-session -t codex 2>/dev/null; then
    echo "=== CODEX SCREEN $(date) ==="
    tmux capture-pane -t codex -p -J | tail -25
  else
    echo "[orchestrator] codex not in named tmux. Log tail in ai-monitors pane 0:"
    tail -10 ~/.codex/log/codex-tui.log 2>/dev/null || echo "no codex log"
    echo "To enable full TUI capture: in Codex terminal (s005) run: tmux new -s codex"
  fi
}

# Status of all
orchestrate_status() {
  echo "=== ORCHESTRATOR STATUS $(date) ==="
  echo "Tmux sessions:"
  tmux ls 2>/dev/null || echo "no tmux"
  echo ""
  echo "Codex log tail (last 5):"
  tail -5 ~/.codex/log/codex-tui.log 2>/dev/null || echo "no codex log"
  echo ""
  echo "Claude last history entry:"
  tail -1 ~/.claude/history.jsonl 2>/dev/null || echo "no claude history"
  echo ""
  echo "Gemini log (if fed):"
  tail -3 /tmp/gemini.log 2>/dev/null || echo "no /tmp/gemini.log (run script wrapper in Gemini terminal)"
  echo ""
  echo "To send: send_claude \"msg\", send_gemini \"msg\", send_codex \"msg\" (after moving codex)"
  echo "To capture screen: capture_claude, capture_gemini, capture_codex"
  echo "To see all in shared: tmux attach -t ai-monitors"
}

# Example orchestration loop helper (manual use)
orchestrate_step() {
  local target="$1"
  local msg="$2"
  echo "=== ORCHESTRATION STEP ==="
  echo "Target: $target"
  echo "Instruction: $msg"
  case "$target" in
    claude) send_claude "$msg" ;;
    gemini) send_gemini "$msg" ;;
    codex) send_codex "$msg" ;;
    *) echo "Unknown target. Use claude, gemini, codex" ;;
  esac
  echo "Now watch the monitors or capture to hear output, then decide next step."
}

echo "AI Orchestrator helpers loaded. Use send_* , capture_* , orchestrate_status , orchestrate_step ."
