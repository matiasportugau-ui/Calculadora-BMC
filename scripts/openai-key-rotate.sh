#!/usr/bin/env bash
# openai-key-rotate.sh
# Rotate OPENAI_API_KEY safely across local .env + Cloud Run.
#
# What it does, in order:
#   1. Reads a new key from a hidden prompt (never echoed, never in shell history).
#   2. Validates it against https://api.openai.com/v1/models  → must return 200.
#   3. Updates ./.env atomically (a .bak backup is left next to it).
#   4. (Optional, on confirm) updates Cloud Run service `panelin-calc` to use
#      Secret Manager instead of an inline env var:
#        - creates secret `openai-api-key` if it does not exist
#        - adds the new key as a fresh version
#        - on the service: --remove-env-vars OPENAI_API_KEY
#                          --set-secrets   OPENAI_API_KEY=openai-api-key:latest
#   5. Re-runs scripts/openai-key-audit.sh.
#
# Aborts at any failure — your old (dead) key is left in place if anything goes wrong.
#
# Usage:
#   bash scripts/openai-key-rotate.sh
#
# Env overrides:
#   CLOUD_RUN_SERVICE   default: panelin-calc
#   CLOUD_RUN_REGION    default: us-central1
#   GCP_SECRET_NAME     default: openai-api-key
#   SKIP_CLOUD_RUN=1    update local .env only

set -u
set -o pipefail

CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-panelin-calc}"
CLOUD_RUN_REGION="${CLOUD_RUN_REGION:-us-central1}"
GCP_SECRET_NAME="${GCP_SECRET_NAME:-openai-api-key}"
SKIP_CLOUD_RUN="${SKIP_CLOUD_RUN:-0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
dim()  { printf "\033[2m%s\033[0m\n" "$*"; }
red()  { printf "\033[31m%s\033[0m\n" "$*"; }
grn()  { printf "\033[32m%s\033[0m\n" "$*"; }
ylw()  { printf "\033[33m%s\033[0m\n" "$*"; }
die()  { red "ABORT: $*"; exit 1; }

[ -f "$REPO_ROOT/.env" ] || die "No .env at $REPO_ROOT — refusing to write a new one blind."

bold "OpenAI API Key Rotation"
dim  "Service: $CLOUD_RUN_SERVICE @ $CLOUD_RUN_REGION   Secret: $GCP_SECRET_NAME"
echo

# ── 1. Read the new key (hidden, with confirmation)
printf "Paste the NEW OpenAI API key (input hidden): "
IFS= read -rs NEW_KEY
echo
[ -z "${NEW_KEY:-}" ] && die "Empty input."

printf "Confirm NEW key (paste again): "
IFS= read -rs NEW_KEY_CONFIRM
echo
[ "$NEW_KEY" = "$NEW_KEY_CONFIRM" ] || { unset NEW_KEY NEW_KEY_CONFIRM; die "Confirmation did not match."; }
unset NEW_KEY_CONFIRM

if [[ "$NEW_KEY" != sk-* ]]; then
  ylw "Warning: key does not start with 'sk-'. Continuing anyway…"
fi
key_len=${#NEW_KEY}
key_prefix="${NEW_KEY:0:8}"
key_suffix="${NEW_KEY: -4}"
dim "fingerprint: ${key_prefix}…${key_suffix} · len ${key_len}"

# ── 2. Validate against OpenAI BEFORE touching anything
bold "Validating key against api.openai.com/v1/models…"
http_code=$(curl -s -o /tmp/openai-rotate-resp.$$ -w "%{http_code}" \
  --max-time 10 \
  -H "Authorization: Bearer ${NEW_KEY}" \
  https://api.openai.com/v1/models 2>/dev/null || echo "000")

if [ "$http_code" != "200" ]; then
  echo "OpenAI returned HTTP $http_code"
  head -c 600 /tmp/openai-rotate-resp.$$ 2>/dev/null
  echo
  rm -f /tmp/openai-rotate-resp.$$
  unset NEW_KEY
  die "New key did NOT validate. No changes made."
fi
rm -f /tmp/openai-rotate-resp.$$
grn "Key is ACTIVE (HTTP 200)."
echo

# ── 3. Local .env update (atomic + .bak)
bold "Updating ./.env"
ts=$(date +%Y%m%d-%H%M%S)
backup="$REPO_ROOT/.env.bak.$ts"
cp -p "$REPO_ROOT/.env" "$backup" || die "Could not create backup $backup"
dim "Backup: $backup"

tmpfile="$(mktemp "${TMPDIR:-/tmp}/env.XXXXXX")"
trap 'rm -f "$tmpfile"' EXIT

if grep -qE "^OPENAI_API_KEY=" "$REPO_ROOT/.env"; then
  awk -v new="$NEW_KEY" '
    BEGIN { replaced = 0 }
    /^OPENAI_API_KEY=/ && !replaced { print "OPENAI_API_KEY=" new; replaced = 1; next }
    { print }
  ' "$REPO_ROOT/.env" > "$tmpfile" || die "awk replace failed."
else
  cat "$REPO_ROOT/.env" > "$tmpfile"
  printf "OPENAI_API_KEY=%s\n" "$NEW_KEY" >> "$tmpfile"
fi

# Permissions: keep original mode if possible.
chmod --reference="$REPO_ROOT/.env" "$tmpfile" 2>/dev/null || chmod 600 "$tmpfile"
mv "$tmpfile" "$REPO_ROOT/.env" || die "Could not move tmp into .env"
trap - EXIT
grn "Local .env updated."
echo

# ── 4. Cloud Run rotation (optional)
if [ "$SKIP_CLOUD_RUN" = "1" ]; then
  ylw "SKIP_CLOUD_RUN=1 — leaving Cloud Run untouched."
else
  if ! command -v gcloud >/dev/null 2>&1; then
    ylw "gcloud not on PATH — leaving Cloud Run untouched."
  elif ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q .; then
    ylw "gcloud not authenticated (run 'gcloud auth login') — leaving Cloud Run untouched."
  else
    gcp_project="$(gcloud config get-value project 2>/dev/null || true)"
    bold "Cloud Run: rotating OPENAI_API_KEY on $CLOUD_RUN_SERVICE"
    dim "GCP project: ${gcp_project:-<unset>}"
    printf "Proceed with Cloud Run rotation? [y/N] "
    read -r ans
    if [[ ! "$ans" =~ ^[yY]$ ]]; then
      ylw "Skipped Cloud Run by user choice."
    else
      # 4a. Ensure secret exists
      if gcloud secrets describe "$GCP_SECRET_NAME" >/dev/null 2>&1; then
        dim "Secret $GCP_SECRET_NAME exists — adding new version."
      else
        dim "Creating secret $GCP_SECRET_NAME…"
        gcloud secrets create "$GCP_SECRET_NAME" --replication-policy=automatic \
          || die "Failed to create secret $GCP_SECRET_NAME."
      fi

      # 4b. Push new version (no temp file with key on disk)
      printf '%s' "$NEW_KEY" \
        | gcloud secrets versions add "$GCP_SECRET_NAME" --data-file=- \
        || die "Failed to add secret version."
      grn "Added new version to $GCP_SECRET_NAME."

      # 4c. Grant the runtime SA access (idempotent, soft-fail if no permission)
      runtime_sa="$(gcloud run services describe "$CLOUD_RUN_SERVICE" \
        --region="$CLOUD_RUN_REGION" \
        --format="value(spec.template.spec.serviceAccountName)" 2>/dev/null || true)"
      if [ -n "$runtime_sa" ]; then
        dim "Granting roles/secretmanager.secretAccessor to $runtime_sa…"
        gcloud secrets add-iam-policy-binding "$GCP_SECRET_NAME" \
          --member="serviceAccount:${runtime_sa}" \
          --role="roles/secretmanager.secretAccessor" >/dev/null 2>&1 \
          || ylw "Could not bind IAM (may already be bound or you lack permission)."
      fi

      # 4d. Switch the service to read OPENAI_API_KEY from Secret Manager.
      # NOTE: --update-secrets MERGES (keeps the other mounted secrets). Using
      # --set-secrets here would REPLACE the whole list and strip DATABASE_URL,
      # IDENTITY_JWT_SECRET, service-account.json, etc. (the #313/#315/#317 bug).
      dim "Updating Cloud Run service to use $GCP_SECRET_NAME:latest…"
      gcloud run services update "$CLOUD_RUN_SERVICE" \
        --region="$CLOUD_RUN_REGION" \
        --remove-env-vars=OPENAI_API_KEY \
        --update-secrets=OPENAI_API_KEY="${GCP_SECRET_NAME}:latest" \
        || die "gcloud run services update failed."
      grn "Cloud Run rotated."
    fi
  fi
fi

# Wipe the key from this shell ASAP
unset NEW_KEY

# ── 5. Audit
echo
bold "Re-running audit"
bash "$SCRIPT_DIR/openai-key-audit.sh" || true

echo
bold "Done."
dim "Local .env backup: $backup"
dim "Tip: hit 'Verificar clave' in the Agent Admin → Voz tab, or:"
dim "    curl -s \$API_BASE/api/agent/voice/health -H \"X-Api-Auth-Token: \$API_AUTH_TOKEN\" | jq"
