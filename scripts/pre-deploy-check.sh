#!/bin/bash
# BMC Pre-Deploy Checklist
# Run before deploy. Requires: server at 3001 (or set BMC_API_BASE)
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

BASE="${BMC_API_BASE:-http://localhost:3001}"
echo ""
echo "═══ BMC Pre-Deploy Check ═══"
echo ""

# 1. Health
echo "1. Health check ($BASE/health)"
if curl -sf "$BASE/health" > /dev/null 2>&1; then
  echo "   ✅ Health OK"
else
  echo "   ⚠️  Health unreachable (is server running?)"
fi

# 2. Env vars — load .env so checks match what Node/dotenv sees (values with spaces must be quoted in .env)
echo ""
echo "2. Env vars"
if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  . ./.env
  set +a
fi
if [ -f .env.example ]; then
  for var in BMC_SHEET_ID GOOGLE_APPLICATION_CREDENTIALS; do
    if grep -q "$var" .env.example 2>/dev/null; then
      if [ -n "${!var}" ]; then
        echo "   ✅ $var set"
      else
        echo "   ⚠️  $var not set (check .env or export in shell)"
      fi
    fi
  done
else
  echo "   ⚠️  .env.example not found"
fi

# 3. API contract validation
echo ""
echo "3. API contract validation"
if command -v node >/dev/null 2>&1; then
  if BMC_API_BASE="$BASE" node scripts/validate-api-contracts.js 2>/dev/null; then
    echo "   ✅ Contracts OK"
  else
    echo "   ⚠️  Contract validation had issues (see above)"
  fi
else
  echo "   ⚠️  Node not found, skip contract validation"
fi

# 4. PROJECT-STATE pendientes (canonical: docs/team/PROJECT-STATE.md; docs/PROJECT-STATE.md is a redirect stub)
TEAM_STATE="docs/team/PROJECT-STATE.md"
echo ""
echo "4. PROJECT-STATE pendientes ($TEAM_STATE)"
if [ -f "$TEAM_STATE" ]; then
  OPEN_COUNT="$(grep -c '^- \[ \]' "$TEAM_STATE" 2>/dev/null || true)"
  if [ -z "$OPEN_COUNT" ]; then OPEN_COUNT=0; fi
  echo "   ℹ️  Open checklist items (markdown): $OPEN_COUNT"
  if [ -f docs/PROJECT-STATE.md ]; then
    echo "   ℹ️  Legacy redirect: docs/PROJECT-STATE.md → team/PROJECT-STATE.md"
  fi
else
  echo "   ⚠️  $TEAM_STATE not found"
fi

echo ""
echo "═══ Done ═══"
echo ""
