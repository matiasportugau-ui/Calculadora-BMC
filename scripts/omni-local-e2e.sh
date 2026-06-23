#!/usr/bin/env bash
# Self-provisioning local E2E for the WAVE 4 omni gates (HITL / H4 / F3).
#
# Stands up its OWN throwaway Postgres cluster, applies the omni migrations,
# runs scripts/omni-local-e2e.mjs against it, then tears everything down.
# It never touches any pre-existing database -- fully side-effect-safe.
#
#   npm run omni:local-e2e
#
# No AI provider keys, no channel creds, no Sheets, no prod contact required.
set -euo pipefail

# Preflight: needs local Postgres binaries. Skip cleanly if absent (e.g. CI).
for bin in initdb pg_ctl createdb; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "[omni-local-e2e] '${bin}' not found -- skipping (install Postgres to run this gate)."
    exit 0
  fi
done

PORT="${OMNI_E2E_PORT:-55432}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/omni-e2e-XXXXXX")"
PGDATA="${WORK}/pgdata"
PGSOCK="${WORK}/sock"
mkdir -p "${PGSOCK}"

cleanup() {
  pg_ctl -D "${PGDATA}" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "${WORK}" || true
}
trap cleanup EXIT INT TERM

echo "[omni-local-e2e] initdb"
initdb -D "${PGDATA}" -U postgres -A trust >/dev/null

echo "[omni-local-e2e] starting Postgres on 127.0.0.1:${PORT}"
pg_ctl -D "${PGDATA}" -o "-p ${PORT} -k ${PGSOCK} -c listen_addresses=127.0.0.1" -w start >/dev/null

createdb -h 127.0.0.1 -p "${PORT}" -U postgres omni_e2e
E2E_URL="postgres://postgres@127.0.0.1:${PORT}/omni_e2e"

echo "[omni-local-e2e] applying omni migrations"
DATABASE_URL="${E2E_URL}" npm run --silent omni:migrate

echo "[omni-local-e2e] running E2E harness"
# Unset DATABASE_URL so the harness guard (must differ from DATABASE_URL) is satisfied
# and nothing else can resolve a real DB.
set +e
env -u DATABASE_URL OMNI_E2E_DATABASE_URL="${E2E_URL}" node scripts/omni-local-e2e.mjs
code=$?
set -e

exit "${code}"
