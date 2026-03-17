#!/usr/bin/env bash
# BMC Dashboard — Go-Live Automation
# Runs all automated checks and steps. For manual steps, see docs/ATLAS-BROWSER-PROMPT-GO-LIVE.md
# Usage: ./scripts/go-live-automation.sh [--start-api] [--ngrok]

set -e
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

START_API=false
START_NGROK=false
for arg in "$@"; do
  case "$arg" in
    --start-api) START_API=true ;;
    --ngrok)     START_NGROK=true ;;
  esac
done

echo ""
echo "=== BMC Go-Live Automation ==="
echo ""

# 1. Setup check
echo "[1/5] Setup check..."
./run_dashboard_setup.sh --check-only
echo ""

# 2. Start API if requested
if $START_API; then
  echo "[2/5] Starting API..."
  if ! curl -sf http://localhost:3001/health >/dev/null 2>&1; then
    npm run start:api &
    sleep 4
  fi
  echo "  ✓ API ready"
else
  echo "[2/5] API (skip — use --start-api to auto-start)"
  if curl -sf http://localhost:3001/health >/dev/null 2>&1; then
    echo "  ✓ API already running"
  else
    echo "  ⚠ Start manually: npm run start:api"
  fi
fi
echo ""

# 3. Contract validation
echo "[3/5] Contract validation..."
if BMC_API_BASE=http://localhost:3001 node scripts/validate-api-contracts.js 2>/dev/null; then
  echo "  ✓ Contracts OK"
else
  echo "  ⚠ Run with API: BMC_API_BASE=http://localhost:3001 node scripts/validate-api-contracts.js"
fi
echo ""

# 4. Verify sheets tabs (requires googleapis)
echo "[4/5] Sheets tabs..."
if node scripts/verify-sheets-tabs.js 2>/dev/null; then
  echo "  ✓ Tabs OK"
else
  echo "  ⚠ Tabs missing or not shared. Run Atlas Browser prompt for manual steps."
fi
echo ""

# 5. ngrok (optional)
if $START_NGROK; then
  echo "[5/5] ngrok..."
  if command -v ngrok &>/dev/null; then
    if ! curl -sf http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -q "public_url"; then
      ngrok http 3001 &
      sleep 4
    fi
    echo "  ✓ ngrok (inspector: http://127.0.0.1:4040)"
  else
    echo "  ⚠ ngrok not installed: brew install ngrok"
  fi
else
  echo "[5/5] ngrok (skip — use --ngrok to start)"
fi

echo ""
echo "=== Automated steps complete ==="
echo ""
echo "  For manual steps (share workbook, Apps Script), run Atlas Browser with:"
echo "  docs/ATLAS-BROWSER-PROMPT-GO-LIVE.md"
echo ""
