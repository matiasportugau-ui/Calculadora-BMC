#!/bin/bash
# ═══════════════════════════════════════════════════════
# Ver Full Team Run en tiempo real
# ═══════════════════════════════════════════════════════
# Uso: ./scripts/watch-full-team-run.sh
# Ejecutar en una terminal mientras lanzás "run full team" en Cursor.
# Muestra el transcript del subagent en tiempo real.

LATEST=$(find "$HOME/.cursor/projects" -path "*/subagents/*.jsonl" -type f 2>/dev/null | xargs ls -t 2>/dev/null | head -1)
[[ -z "$LATEST" ]] && { echo "No hay transcripts de subagents. Lanzá 'run full team' primero."; exit 1; }

echo "→ Siguiendo: $(basename "$LATEST")"
echo "  (Ctrl+C para salir)"
echo "─────────────────────────────────────────────────"

tail -f "$LATEST" 2>/dev/null | while read -r line; do
  if command -v jq &>/dev/null; then
    text=$(echo "$line" | jq -r 'if .message.content then .message.content[0].text // empty else empty end' 2>/dev/null)
    [[ -n "$text" ]] && echo "$text" && echo "---"
  else
    echo "$line"
  fi
done
