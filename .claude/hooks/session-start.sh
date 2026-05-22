#!/bin/bash
# SessionStart hook for Claude Code on the web.
#
# Purpose:
#   1. Ensure .env exists (idempotent, same as before)
#   2. In remote environments (Claude Code on the web), provision the
#      Google service account from BMC_SERVICE_ACCOUNT_JSON env var so
#      the evals harness can read the planilla
#   3. In remote environments, install npm deps so tests, linters, and
#      the evals harness work in the session
#   4. Report which capabilities are available
#
# To provision credentials for remote sessions, set in your Claude Code
# on the web environment config:
#
#   BMC_SERVICE_ACCOUNT_JSON  = <contents of service-account.json>
#   ANTHROPIC_API_KEY         = <optional, for LLM-based evals (i4+)>
#   BMC_EVALS_API_TOKEN       = <optional, alt path via Cloud Run proxy>
#
# Runs in async mode: the session starts immediately while npm install
# happens in background. Trade-off documented in the commit message.
# Container state caches after first run so resumes are fast.

set -euo pipefail

# Announce async mode to Claude Code BEFORE any other stdout. Timeout 300s
# to cover the first-ever npm install.
echo '{"async": true, "asyncTimeout": 300000}'

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# ── 1. Always ──────────────────────────────────────────────────────────
npm run env:ensure

cat <<EOF

=== Calculadora BMC ===

  npm run dev:full    API :3001 + Vite :5173
  npm run dev         Vite only
  npm run gate:local  lint + test (before commit)

EOF

# ── 2. Remote-only setup ───────────────────────────────────────────────
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "→ Claude Code remote env detected — provisioning"

# 2a. Restore Google service account from env var
SA_PATH="docs/bmc-dashboard-modernization/service-account.json"
if [ -f "$SA_PATH" ]; then
  echo "  · SA already present at $SA_PATH"
elif [ -n "${BMC_SERVICE_ACCOUNT_JSON:-}" ]; then
  mkdir -p "$(dirname "$SA_PATH")"
  printf '%s' "$BMC_SERVICE_ACCOUNT_JSON" > "$SA_PATH"
  chmod 600 "$SA_PATH"
  bytes=$(wc -c < "$SA_PATH")
  if [ "$bytes" -lt 200 ]; then
    echo "  ‼ SA written but only $bytes bytes — env var truncated?"
  else
    echo "  ✓ wrote SA → $SA_PATH ($bytes bytes)"
  fi
else
  echo "  · BMC_SERVICE_ACCOUNT_JSON not set — evals harness will fail until you"
  echo "    set it in the Claude Code on the web environment config, or use the"
  echo "    Cloud Run proxy (BMC_EVALS_API_BASE + BMC_EVALS_API_TOKEN)."
fi

# 2b. Install npm deps (idempotent; cached in container snapshot)
if [ ! -d node_modules ] || [ "package.json" -nt "node_modules/.package-lock.json" ] 2>/dev/null; then
  echo "  · running npm install ..."
  if npm install --no-audit --no-fund --silent 2>&1 | tail -3; then
    echo "  ✓ deps installed"
  else
    echo "  ‼ npm install failed — tests and harness won't run"
  fi
else
  echo "  · node_modules up to date"
fi

# 2c. Report capabilities
echo
echo "Capabilities for this session:"
if [ -f "$SA_PATH" ]; then
  echo "  ✓ Google Sheets (via SA)"
else
  echo "  ✗ Google Sheets (no SA file)"
fi
if [ -n "${BMC_EVALS_API_TOKEN:-}" ]; then
  echo "  ✓ Evals proxy token (BMC_EVALS_API_TOKEN)"
fi
if [ -n "${BMC_EVALS_API_BASE:-}" ]; then
  echo "  ✓ Evals proxy base (BMC_EVALS_API_BASE)"
fi
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  echo "  ✓ Anthropic API key"
else
  echo "  · Anthropic API key not set (LLM-based evals will skip)"
fi
echo
