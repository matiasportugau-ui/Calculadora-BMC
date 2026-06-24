#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
# identity-golive-apply.sh
#
# Idempotently applies the Comprador identity migrations to the database in
# DATABASE_URL and seeds superadmin role for the comma-separated emails in
# ADMINS (env var) using `psql -v admins=...`.
#
# Usage:
#   DATABASE_URL=postgres://... ADMINS='alice@bmc.uy,bob@bmc.uy' \
#     bash scripts/identity-golive-apply.sh
#
# Exit codes:
#   0 success
#   1 missing DATABASE_URL
#   2 psql not found
#   3 migration apply failed
# ──────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIG_INIT="${REPO_ROOT}/supabase/migrations/20260601000001_identity_init.sql"
MIG_SEED="${REPO_ROOT}/supabase/migrations/20260601000002_identity_seed_superadmins.sql"
MIG_DRIVE_CONFIG="${REPO_ROOT}/supabase/migrations/20260624000001_user_drive_config.sql"

color() { printf "\033[1;%sm%s\033[0m\n" "$1" "$2"; }
say()   { color 36 "▶ $1"; }
ok()    { color 32 "✔ $1"; }
err()   { color 31 "✖ $1"; }

if [[ -z "${DATABASE_URL:-}" ]]; then
  err "DATABASE_URL is required"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  err "psql not found in PATH (install postgresql-client)"
  exit 2
fi

ADMINS="${ADMINS:-}"

say "Applying ${MIG_INIT}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIG_INIT" >/tmp/identity-init.out 2>&1 || {
  err "init migration failed — see /tmp/identity-init.out"
  tail -40 /tmp/identity-init.out
  exit 3
}
ok "identity schema applied"

say "Applying ${MIG_DRIVE_CONFIG}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIG_DRIVE_CONFIG" >/tmp/identity-drive-config.out 2>&1 || {
  err "user_drive_config migration failed — see /tmp/identity-drive-config.out"
  tail -40 /tmp/identity-drive-config.out
  exit 3
}
ok "identity.user_drive_config applied"

say "Verifying schema"
TABLE_COUNT=$(psql "$DATABASE_URL" -t -A -c "select count(*) from pg_tables where schemaname='identity'")
say "  identity tables: ${TABLE_COUNT}"
if [[ "${TABLE_COUNT}" -lt 13 ]]; then
  err "expected ≥13 tables under identity schema, got ${TABLE_COUNT}"
  exit 3
fi
MODULE_COUNT=$(psql "$DATABASE_URL" -t -A -c "select count(*) from identity.modules")
say "  identity.modules rows: ${MODULE_COUNT}"

if [[ -n "$ADMINS" ]]; then
  say "Seeding superadmins: ${ADMINS}"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v admins="$ADMINS" \
    -f "$MIG_SEED" >/tmp/identity-seed.out 2>&1 || {
    err "seed migration failed — see /tmp/identity-seed.out"
    tail -40 /tmp/identity-seed.out
    exit 3
  }
  GRANTED=$(psql "$DATABASE_URL" -t -A -c \
    "select count(*) from identity.role_grants rg
       join identity.users u on u.user_id = rg.user_id
      where rg.role='superadmin'")
  ok "superadmin grants in DB: ${GRANTED}"
else
  say "ADMINS empty — skipping superadmin seed (set ADMINS='a@x,b@x' to run it)"
fi

ok "GOLIVE apply complete"
