#!/usr/bin/env bash
#
# Share Localhost — BMC Dashboard
# Exposes the local BMC dashboard (or API) via ngrok.
# See: docs/SHARE-LOCALHOST-DASHBOARD.md
#
# Usage:
#   ./scripts/run_share_dashboard.sh        # default: port 3849 (dashboard only)
#   ./scripts/run_share_dashboard.sh 3001   # API + dashboard
#

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

PORT="${1:-3849}"

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok is not installed."
  echo "Install with: brew install ngrok"
  echo "Then add your auth token: ngrok config add-authtoken \$YOUR_TOKEN"
  echo "Docs: https://ngrok.com/docs/llms.txt"
  exit 1
fi

# Optional: check if something is listening (lsof may not be available on all systems)
if command -v lsof >/dev/null 2>&1; then
  if ! lsof -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Nothing is listening on port $PORT."
    if [ "$PORT" = "3849" ]; then
      echo "Start the dashboard in another terminal: npm run bmc-dashboard"
    else
      echo "Start the API in another terminal: npm run start:api  (or npm run dev:full)"
    fi
    echo ""
    read -p "Continue with ngrok anyway? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
fi

echo "Starting ngrok http $PORT (Share Localhost — BMC Dashboard)"
echo "Inspector: http://127.0.0.1:4040"
echo ""
exec ngrok http "$PORT"
