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

# 3. API contract validation (A3 ratchet: fail hard when API is healthy)
# Soft-skip only when health is unreachable (local API down is not a contract fail).
echo ""
echo "3. API contract validation"
if ! command -v node >/dev/null 2>&1; then
  echo "   ⚠️  Node not found, skip contract validation"
elif ! curl -sf "$BASE/health" > /dev/null 2>&1; then
  echo "   ⚠️  API unreachable at $BASE — skip contracts (start API or set BMC_API_BASE)"
else
  if BMC_API_BASE="$BASE" node scripts/validate-api-contracts.js; then
    echo "   ✅ Contracts OK"
  else
    echo "   ❌ Contract validation FAILED — fix API/Sheets contracts before deploy (SDD A3)"
    exit 1
  fi
fi

# 4. OpenAI API key audit (local .env source — fails the gate if 401)
echo ""
echo "4. OpenAI API key (local .env)"
if bash scripts/openai-key-audit.sh --source=local --strict >/dev/null 2>&1; then
  echo "   ✅ Local OPENAI_API_KEY ACTIVE"
else
  echo "   ❌ Local OPENAI_API_KEY INACTIVE — rotate before deploy: npm run keys:rotate"
  exit 1
fi

# 5. PROJECT-STATE pendientes (canonical: docs/team/PROJECT-STATE.md; docs/PROJECT-STATE.md is a redirect stub)
TEAM_STATE="docs/team/PROJECT-STATE.md"
echo ""
echo "5. PROJECT-STATE pendientes ($TEAM_STATE)"
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

# 6. Cloud Run secrets drift (fails the gate if a required secret would be stripped)
echo ""
echo "6. Cloud Run secrets drift (--set-secrets vs manifest)"
if command -v node >/dev/null 2>&1; then
  if node scripts/gate-secrets-drift.mjs; then
    echo "   ✅ No secrets drift"
  else
    echo "   ❌ Secrets drift — fix before deploy (see gate output above)"
    exit 1
  fi
else
  echo "   ⚠️  Node not found, skip secrets drift gate"
fi

# 7. Drive folder config table (when DATABASE_URL is set)
echo ""
echo "7. identity.user_drive_config (Drive tab per-user folder)"
if [ -n "${DATABASE_URL:-}" ] && command -v node >/dev/null 2>&1; then
  node scripts/check-drive-config-table.mjs
  rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "   ✅ Drive config table OK"
  elif [ "$rc" -eq 1 ]; then
    echo "   ❌ Missing table — run: npm run identity:golive:apply"
    exit 1
  else
    echo "   ❌ Drive config table check failed (DB connectivity or query error — see output above)"
    exit 1
  fi
else
  echo "   ℹ️  DATABASE_URL unset — skip (apply migration before enabling Drive folder save in prod)"
fi

echo ""
echo "═══ Done ═══"
echo ""
