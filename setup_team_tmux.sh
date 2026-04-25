#!/bin/bash
# setup_team_tmux.sh — shared terminal session for pair programming
SESSION_NAME="bmc"
SOCKET_PATH="/tmp/team-tmux-socket"

tmux -S "$SOCKET_PATH" new-session -d -s "$SESSION_NAME" 2>/dev/null \
  || echo "Session '$SESSION_NAME' already exists, reusing it."

chmod 777 "$SOCKET_PATH"

echo "✅ Shared terminal session ready!"
echo ""
echo "Teammates attach with:"
echo "  tmux -S $SOCKET_PATH attach -t $SESSION_NAME"
echo ""

tmux -S "$SOCKET_PATH" attach -t "$SESSION_NAME"
