#!/bin/bash
# PostToolUse: quality inject — on Edit/Write under src|server|tests, run lightweight checks.
# Success is silent; failures are verbose on stderr for the agent loop.
set -euo pipefail

INPUT="${CLAUDE_TOOL_INPUT:-${TOOL_INPUT:-}}"
if [[ -z "$INPUT" ]] && [[ ! -t 0 ]]; then
  INPUT="$(cat || true)"
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT"

# Only act when path-like content mentions source trees
if ! printf '%s' "$INPUT" | grep -Eq 'src/|server/|tests/|package\.json'; then
  exit 0
fi

# Fast path: if eslint available and src touched, lint (non-fatal for hook infrastructure)
if printf '%s' "$INPUT" | grep -Eq 'src/.*\.(js|jsx|ts|tsx)' && command -v npx >/dev/null 2>&1; then
  if ! npx eslint --max-warnings 50 src/ >/tmp/hcs-eslint.out 2>&1; then
    echo "HCS PostToolUse SENSOR (eslint): failures detected — fix before finishing." >&2
    tail -n 40 /tmp/hcs-eslint.out >&2 || true
    # Do not hard-block (exit 0) so agent can self-correct; verbose feedback is the product.
  fi
fi

exit 0
