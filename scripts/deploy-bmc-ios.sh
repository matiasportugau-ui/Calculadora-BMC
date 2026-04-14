#!/usr/bin/env bash
# BMC Connect iOS — prepare directory and print Vercel deploy steps.
# Usage: bash scripts/deploy-bmc-ios.sh
# Optional: DEPLOY_TARGET=~/bmc-connect-ios bash scripts/deploy-bmc-ios.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC_DIR="$REPO_ROOT/bmc-connect-ios"
ROOT="${DEPLOY_TARGET:-$HOME/bmc-connect-ios}"

if [[ ! -f "$SRC_DIR/index.html" ]]; then
  echo "Missing $SRC_DIR/index.html (clone repo or copy files)." >&2
  exit 1
fi

echo ""
echo "▶ Syncing bmc-connect-ios → $ROOT"
mkdir -p "$ROOT"
cp "$SRC_DIR/index.html" "$SRC_DIR/vercel.json" "$ROOT/"

echo "▶ Files ready. Deploy with Vercel CLI (no global install):"
echo ""
echo "  cd \"$ROOT\""
echo "  npx vercel@latest deploy --yes --name bmc-connect-ios"
echo ""
echo "  → Login with your Vercel account"
echo "  → Copy the production URL"
echo "  → Open in Safari on iPhone → Share → Add to Home Screen"
echo ""
