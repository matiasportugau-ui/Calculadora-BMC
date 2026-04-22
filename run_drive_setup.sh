#!/usr/bin/env bash
# Arranca Vite con Drive: guarda VITE_GOOGLE_CLIENT_ID en .env.local (no pisa .env).
#
# Uso:
#   ./run_drive_setup.sh '<CLIENT_ID>.apps.googleusercontent.com'
#
# Equivale a: npm run drive:configure (interactivo) o node scripts/set-vite-google-client.mjs --set '…'

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

CLIENT_ID="${1:-}"
if [[ -z "$CLIENT_ID" ]]; then
  echo "Uso: ./run_drive_setup.sh '<VITE_GOOGLE_CLIENT_ID>'"
  echo ""
  echo "O interactivo: npm run drive:bootstrap && npm run drive:configure"
  echo "Docs: docs/GOOGLE_DRIVE_SETUP_PROMPT.md | docs/GOOGLE-DRIVE-OAUTH-AUTOMATION-PLAN.md"
  exit 1
fi

node scripts/set-vite-google-client.mjs --set "$CLIENT_ID"
npm install || exit 1
npm run dev
