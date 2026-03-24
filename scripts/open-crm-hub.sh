#!/usr/bin/env bash
# Open WORKSPACE-CRM-HUB in the default browser (macOS `open`).
# Start the static server first: npm run team:hub
set -e
URL="${CRM_HUB_URL:-http://localhost:4710/team/WORKSPACE-CRM-HUB.html}"
if command -v open >/dev/null 2>&1; then
  exec open "$URL"
fi
echo "Open this URL in your browser (install \`open\` on macOS or set BROWSER):"
echo "$URL"
