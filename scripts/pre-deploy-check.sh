#!/bin/bash
# BMC Pre-Deploy Checklist
# Run before deploy. Requires: server at 3001 (or set BMC_API_BASE)
set -e
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

# 2. Env vars (from .env.example if exists)
echo ""
echo "2. Env vars"
if [ -f .env.example ]; then
  for var in BMC_SHEET_ID GOOGLE_APPLICATION_CREDENTIALS; do
    if grep -q "$var" .env.example 2>/dev/null; then
      if [ -n "${!var}" ]; then
        echo "   ✅ $var set"
      else
        echo "   ⚠️  $var not set (check .env)"
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

# 4. PROJECT-STATE pendientes
echo ""
echo "4. PROJECT-STATE pendientes"
if [ -f docs/PROJECT-STATE.md ]; then
  if grep -q "\- \[ \]" docs/PROJECT-STATE.md 2>/dev/null || ! grep -q "Pendientes" docs/PROJECT-STATE.md; then
    echo "   ℹ️  Check docs/PROJECT-STATE.md for pendientes"
  else
    echo "   ℹ️  PROJECT-STATE exists"
  fi
else
  echo "   ⚠️  docs/PROJECT-STATE.md not found"
fi

echo ""
echo "═══ Done ═══"
echo ""
