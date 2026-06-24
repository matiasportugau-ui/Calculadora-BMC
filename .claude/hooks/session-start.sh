#!/bin/bash
set -euo pipefail

# Only run in Claude Code on the web (remote) sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Install ALSA dev headers required by the native `midi` addon (linux only)
if command -v apt-get &>/dev/null && ! dpkg -s libasound2-dev &>/dev/null 2>&1; then
  SUDO=""
  command -v sudo &>/dev/null && SUDO="sudo"
  $SUDO apt-get install -y libasound2-dev >/dev/null 2>&1 || true
fi

# Install npm dependencies only when node_modules is missing (container state is cached)
if [[ ! -d node_modules ]]; then
  npm install
fi

# Skip disk precheck in cloud environments (idempotent — only appends if not already set)
if ! grep -qF 'BMC_DISK_PRECHECK_SKIP' "$CLAUDE_ENV_FILE" 2>/dev/null; then
  echo 'export BMC_DISK_PRECHECK_SKIP=1' >> "$CLAUDE_ENV_FILE"
fi

# Create .env from .env.example if it doesn't exist yet
npm run env:ensure

echo ""
echo "=== Calculadora BMC ==="
echo ""
echo "  npm run dev:full    API :3001 + Vite :5173"
echo "  npm run dev         Vite only"
echo "  npm run gate:local  lint + test (before commit)"
echo ""
