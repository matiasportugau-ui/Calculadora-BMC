#!/bin/bash
# setup_gemini_tmux.sh
SESSION_NAME="gemini"

# Create a new detached session if it doesn't exist
tmux has-session -t "$SESSION_NAME" 2>/dev/null
if [ $? != 0 ]; then
  tmux new-session -d -s "$SESSION_NAME"
  echo "✅ Tmux session '$SESSION_NAME' created."
else
  echo "ℹ️ Tmux session '$SESSION_NAME' already exists."
fi

echo "To attach, use: tmux attach -t $SESSION_NAME"
