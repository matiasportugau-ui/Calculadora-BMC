#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
# identity-golive.sh — orchestrator
#
# Runs the two GOLIVE phases that DON'T need browser/UAT:
#   1. apply migrations (idempotent)
#   2. preflight against the live API
#
# After this exits 0, the only remaining GOLIVE work is human:
#   - manually create the Sheets tab «Base de datos cotis de clientes»
#   - run the 10-min UAT script in docs/master-plans/user-identity-GOLIVE.md
#
# Required env:
#   DATABASE_URL    Postgres for migrations apply
#   API_BASE        Cloud Run URL for preflight
# Optional env:
#   ADMINS          comma-separated emails seeded as superadmin
#   ADMIN_BEARER    JWT to exercise the admin sheets-status preflight check
# ──────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

color() { printf "\033[1;%sm%s\033[0m\n" "$1" "$2"; }
say()   { color 36 "═══ $1"; }
ok()    { color 32 "✔ $1"; }
err()   { color 31 "✖ $1"; }

if [[ -z "${DATABASE_URL:-}" ]]; then
  err "DATABASE_URL is required"
  exit 1
fi
if [[ -z "${API_BASE:-}" ]]; then
  err "API_BASE is required"
  exit 1
fi

say "Phase 1 — apply migrations"
bash "${REPO_ROOT}/scripts/identity-golive-apply.sh"
ok "migrations applied"

say "Phase 2 — preflight live API"
node "${REPO_ROOT}/scripts/identity-golive-preflight.mjs"
ok "preflight passed"

cat <<EOF

────────────────────────────────────────────────────────────────
Remaining manual GOLIVE work (humans only):

  □ Create Sheets tab «Base de datos cotis de clientes» in BMC_SHEET_ID
    (header row will be auto-populated on first sync)
  □ Verify Google OAuth Web client ID origins include the prod + preview URLs
  □ Run the 10-minute UAT script in:
      docs/master-plans/user-identity-GOLIVE.md
  □ Mark PR #137 as ready for review and merge once UAT is green

────────────────────────────────────────────────────────────────
EOF
