#!/usr/bin/env bash
# Helper to start the local API with Doppler-injected GOOGLE_APPLICATION_CREDENTIALS
# correctly written to a temp file (required by the server for Sheets/MATRIZ auth).
# Usage: ./scripts/start-api-with-doppler-creds.sh
# Or: doppler run -- ./scripts/start-api-with-doppler-creds.sh

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
