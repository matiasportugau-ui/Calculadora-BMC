#!/usr/bin/env bash
# Helper to start the local API with Doppler-injected GOOGLE_APPLICATION_CREDENTIALS
# correctly written to a temp file (required by the server for Sheets/MATRIZ auth).
#
# Preferred for most work: use the unified orchestrator
#   doppler run -- ./scripts/secrets-provision-verify.sh
# (it still calls this for the SA file path when you need the API directly).
#
# Usage:
#   doppler run -- ./scripts/start-api-with-doppler-creds.sh
#   doppler run -- npm run start:api   (if you handle the SA file yourself)

set -euo pipefail

if [[ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]]; then
  echo "ERROR: GOOGLE_APPLICATION_CREDENTIALS not set (run under 'doppler run -- ...')"
  exit 1
fi

RAW="$GOOGLE_APPLICATION_CREDENTIALS"
KEYFILE=$(mktemp)
printf '%s' "$RAW" > "$KEYFILE"
export GOOGLE_APPLICATION_CREDENTIALS="$KEYFILE"

echo "Using key file: $KEYFILE"
echo "Starting API (port 3001)..."
exec npm run start:api
