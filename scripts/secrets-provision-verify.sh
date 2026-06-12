#!/usr/bin/env bash
# secrets-provision-verify.sh
#
# Unified, opinionated helper to provision/rotate secrets for panelin-calc
# and verify the full chain (local drift + prod mounts).
#
# Philosophy (per SECRETS-STRATEGY.md):
# - Local: Doppler (bmc-backend/prd) is source of truth for dev.
# - Prod: GSM is source of truth. CI (deploy-calc-api.yml) + this script keep mounts in sync.
# - Never hardcode values. Prefer GSM mounts over env literals.
# - One command (or small sequence) to go from "I changed a secret in Doppler/.env" to "verified on prod".
#
# Usage (recommended under Doppler for local .env injection):
#   doppler run -- ./scripts/secrets-provision-verify.sh
#   doppler run -- ./scripts/secrets-provision-verify.sh --dry-run
#   ./scripts/secrets-provision-verify.sh --service panelin-calc --verify-only
#
# Flags:
#   --dry-run          Print what would happen; do not call gcloud or mutate.
#   --service NAME     Cloud Run service (default: panelin-calc)
#   --verify-only      Skip provision; only run drift + health checks + summary.
#   --no-sheets-mount  Skip the dedicated MATRIZ sheets secret mount script.
#   --help
#
# The script is intentionally chatty and safe. It calls the existing
# provision-secrets.sh + run_ml_cloud_run_setup.sh + cloud-run-matriz-sheets-secret.sh
# so the older scripts remain the implementation details.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SERVICE_NAME="panelin-calc"
DRY_RUN=0
VERIFY_ONLY=0
SKIP_SHEETS_MOUNT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --service) SERVICE_NAME="$2"; shift 2 ;;
    --verify-only) VERIFY_ONLY=1; shift ;;
    --no-sheets-mount) SKIP_SHEETS_MOUNT=1; shift ;;
    -h|--help)
      sed -n '1,/^# The script is intentionally chatty/p' "$0" | head -n -1
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

echo "=== BMC Secrets Provision + Verify ==="
echo "Service: $SERVICE_NAME"
echo "Repo:    $REPO_ROOT"
echo "Mode:    $([ "$DRY_RUN" -eq 1 ] && echo 'DRY-RUN' || echo 'EXECUTE')"
echo "Verify-only: $VERIFY_ONLY"
echo ""

# --- 0. Basic sanity ---
if ! command -v gcloud >/dev/null 2>&1; then
  echo "ERROR: gcloud not found in PATH. Install Google Cloud SDK."
  exit 1
fi

PROJECT_ID="$(gcloud config get-value project 2>/dev/null || true)"
if [[ -z "$PROJECT_ID" ]]; then
  echo "ERROR: No active gcloud project. Run: gcloud config set project chatbot-bmc-live"
  exit 1
fi
echo "gcloud project: $PROJECT_ID"

if [[ "$DRY_RUN" -eq 0 && "$VERIFY_ONLY" -eq 0 && ! -f .env && -z "${DOPPLER_TOKEN:-}" ]]; then
  echo "WARNING: No .env and not obviously under 'doppler run --'."
  echo "         Many steps will be limited. Prefer: doppler run -- $0 ..."
fi

# --- 1. Provision high-sensitivity (if not verify-only) ---
if [[ "$VERIFY_ONLY" -eq 0 ]]; then
  echo ""
  echo ">>> [1/4] High-sensitivity provision (provision-secrets.sh)"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "    (dry-run) Would run: ./scripts/provision-secrets.sh $SERVICE_NAME"
  else
    ./scripts/provision-secrets.sh "$SERVICE_NAME"
  fi
else
  echo ">>> [1/4] Skipped provision (--verify-only)"
fi

# --- 2. Bulk env + remaining mounts via the established run script ---
echo ""
echo ">>> [2/4] Bulk Cloud Run sync (run_ml_cloud_run_setup.sh)"
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "    (dry-run) Would run: ./run_ml_cloud_run_setup.sh $SERVICE_NAME"
else
  ./run_ml_cloud_run_setup.sh "$SERVICE_NAME"
fi

# --- 3. Dedicated Sheets SA + MATRIZ mount (critical for /actualizar-precios-calculadora) ---
if [[ "$SKIP_SHEETS_MOUNT" -eq 0 ]]; then
  echo ""
  echo ">>> [3/4] MATRIZ / Sheets SA mount (cloud-run-matriz-sheets-secret.sh)"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "    (dry-run) Would run: ./scripts/cloud-run-matriz-sheets-secret.sh"
  else
    ./scripts/cloud-run-matriz-sheets-secret.sh
  fi
else
  echo ">>> [3/4] Skipped Sheets mount (--no-sheets-mount)"
fi

# --- 4. Verification (always) ---
echo ""
echo ">>> [4/4] Verification"

echo ""
echo "---- Drift check (must be zero for this goal) ----"
if node scripts/check-env-drift.mjs --json >/tmp/drift.json 2>&1; then
  echo "✅ check-env-drift: clean (exit 0)"
  cat /tmp/drift.json
else
  echo "❌ check-env-drift reported drift (see below)"
  cat /tmp/drift.json || node scripts/check-env-drift.mjs || true
  echo "   Fix: add the missing vars to .env.example + deploy-calc-api.yml + (if truly console-only) ALLOWED_ENV_DRIFT.txt"
fi

echo ""
echo "---- Known consumers of major tokens (update these after rotation) ----"
cat <<'CONSUMERS'
API_AUTH_TOKEN (or API_KEY):
  - server/config.js + requireServiceOrUser / requireCrmCockpitAuth / devModeAuth
  - src/contexts/BmcAuthProvider + operatorApiClient.js + PricingEditor.jsx (VITE_BMC_API_AUTH_TOKEN fallback)
  - docs/team/panelsim/* , AGENTS.md (cockpit, ingest-email, etc.)
  - GPT actions / MCP panelin / external callers
  - CI smoke, scripts that call /api/crm/* or /api/agent/*

AI keys (ANTHROPIC_API_KEY etc.):
  - server/lib/suggestResponse.js, agentCore.js, aiProviderConfig.js
  - /api/crm/suggest-response, /api/agent/*, plan interpreter, etc.
  - Health reports hasTokens / provider availability

Sheets / GOOGLE_APPLICATION_CREDENTIALS (service account):
  - server/config.js + bmcDashboard.js (MATRIZ + all CRM tabs)
  - cloud-run-matriz-sheets-secret.sh (the dedicated mount)
  - /api/actualizar-precios-calculadora (critical smoke)

ML / WA / Shopify secrets:
  - mercadoLibreClient.js, wa.js, shopify routes, webhooks
  - OAuth flows and token stores (GCS or file)

FacturaExpress (new 2026-06):
  - server/lib/facturaExpressClient.js (login + apiFetch + verifyWebhookSignature)
  - server/routes/panelin.js (sync/* endpoints)
  - server/routes/webhooks.js (/webhooks/facturaexpress)
  - panelin-platform migrations (invoices, stock movements with source 'facturaexpress')

CONSUMERS

echo ""
echo "---- Post-deploy smoke hints (run these after a real deploy) ----"
echo "BMC_API_BASE=https://panelin-calc-...us-central1.run.app npm run smoke:prod"
echo "curl -s \"\$BMC_API_BASE/health\" | jq '.ok, .hasSheets, .hasTokens'"
echo "curl -s -H \"Authorization: Bearer \$API_AUTH_TOKEN\" \"\$BMC_API_BASE/api/crm/suggest-response\" -d '{\"question\":\"test\"}' | jq"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "Run complete."
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "This was a dry-run. Re-run without --dry-run (ideally under doppler) to apply."
fi
echo "Next manual steps if you rotated something:"
echo "  1. Update any external consumers (GPT Builder actions, MCP clients, operator notes)."
echo "  2. Trigger CI deploy (or workflow_dispatch) so the new yaml mounts take effect."
echo "  3. Re-run smoke:prod against the new revision."
echo "════════════════════════════════════════════════════════════"

# Optional: if user wants a quick local health probe (won't have real secrets unless under doppler + API running)
if command -v curl >/dev/null 2>&1 && [[ -n "${BMC_API_BASE:-}" ]]; then
  echo ""
  echo "Quick probe against $BMC_API_BASE/health (if the API is reachable)..."
  curl -sS --max-time 5 "$BMC_API_BASE/health" | head -c 300 || echo "(probe failed or no BMC_API_BASE)"
fi

exit 0
