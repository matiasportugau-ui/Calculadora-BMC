#!/bin/bash
# PreToolUse: deny high-risk agent commands. Exit 2 = block tool (Claude Code).
# Reads JSON on stdin when available; also checks CLAUDE_TOOL_INPUT / TOOL_INPUT env.
set -euo pipefail

INPUT="${CLAUDE_TOOL_INPUT:-${TOOL_INPUT:-}}"
if [[ -z "$INPUT" ]] && [[ ! -t 0 ]]; then
  INPUT="$(cat || true)"
fi

# Extract command-like fields loosely
CMD="$(printf '%s' "$INPUT" | tr '\n' ' ')"

deny_patterns=(
  'git[[:space:]]+push[[:space:]]+.*--force'
  'git[[:space:]]+push[[:space:]]+-f[[:space:]]'
  'git[[:space:]]+reset[[:space:]]+--hard'
  'rm[[:space:]]+-rf[[:space:]]+/'
  'rm[[:space:]]+-rf[[:space:]]+~'
  'rm[[:space:]]+-rf[[:space:]]+\$HOME'
  'DROP[[:space:]]+TABLE'
  'DROP[[:space:]]+DATABASE'
  'TRUNCATE[[:space:]]+TABLE'
  'mkfs\.'
  'dd[[:space:]]+if='
)

for pat in "${deny_patterns[@]}"; do
  if printf '%s' "$CMD" | grep -Eiq "$pat"; then
    echo "HCS PreToolUse DENY: matched /$pat/" >&2
    echo "Blocked for safety. Use human confirmation workflow; never force-push or destroy data from the agent loop." >&2
    exit 2
  fi
done

exit 0
