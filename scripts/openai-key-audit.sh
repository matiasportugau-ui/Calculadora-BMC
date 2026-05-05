#!/usr/bin/env bash
# openai-key-audit.sh
# Locate every OPENAI_API_KEY visible from this machine and ping OpenAI /v1/models
# to label each one ACTIVE / INACTIVE. Never prints full keys — only prefix/suffix.
#
# Sources scanned:
#   - Local .env files at the repo root and ./Calculadora-BMC/.env*
#   - Current shell ($OPENAI_API_KEY)
#   - Cloud Run service env (gcloud, optional)
#   - Vercel project env (vercel CLI, optional; existence only)
#
# Usage:
#   bash scripts/openai-key-audit.sh
#   CLOUD_RUN_SERVICE=panelin-calc CLOUD_RUN_REGION=us-central1 bash scripts/openai-key-audit.sh

set -u

CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-panelin-calc}"
CLOUD_RUN_REGION="${CLOUD_RUN_REGION:-us-central1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
dim()  { printf "\033[2m%s\033[0m\n" "$*"; }
red()  { printf "\033[31m%s\033[0m" "$*"; }
grn()  { printf "\033[32m%s\033[0m" "$*"; }
ylw()  { printf "\033[33m%s\033[0m" "$*"; }

# Print a row: source | prefix...suffix | len | http_code | label
header_printed=0
print_row() {
  if [ "$header_printed" -eq 0 ]; then
    printf "%-46s  %-18s  %-5s  %-9s  %s\n" "SOURCE" "KEY" "LEN" "HTTP" "LABEL"
    printf "%-46s  %-18s  %-5s  %-9s  %s\n" "------" "---" "---" "----" "-----"
    header_printed=1
  fi
  printf "%-46s  %-18s  %-5s  %-9s  %s\n" "$1" "$2" "$3" "$4" "$5"
}

probe_key() {
  # $1 = source label, $2 = key value (may be empty)
  local source="$1" key="$2"
  if [ -z "$key" ]; then
    print_row "$source" "(empty)" "0" "-" "$(ylw NOT-SET)"
    return
  fi
  local len=${#key}
  local prefix="${key:0:8}"
  local suffix="${key: -4}"
  local fingerprint="${prefix}...${suffix}"

  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 8 \
    -H "Authorization: Bearer ${key}" \
    https://api.openai.com/v1/models 2>/dev/null || echo "000")

  local label
  case "$code" in
    200) label="$(grn ACTIVE)" ;;
    401) label="$(red INACTIVE)" ;;
    429) label="$(ylw RATE-LIMITED)" ;;
    000) label="$(ylw NETWORK-ERROR)" ;;
    *)   label="$(ylw "HTTP $code")" ;;
  esac
  print_row "$source" "$fingerprint" "$len" "$code" "$label"
}

# Read a single env-style file and print the OPENAI_API_KEY line if present.
read_env_key() {
  local file="$1"
  [ -f "$file" ] || return 1
  local line
  line=$(grep -E "^OPENAI_API_KEY=" "$file" 2>/dev/null | head -1)
  [ -z "$line" ] && return 1
  local val="${line#OPENAI_API_KEY=}"
  # strip surrounding quotes if any
  val="${val%\"}"; val="${val#\"}"
  val="${val%\'}"; val="${val#\'}"
  printf "%s" "$val"
}

bold "OpenAI API Key Audit"
dim "Repo: $REPO_ROOT"
dim "$(date)"
echo

# 1) Local .env* files (repo root + nested Calculadora-BMC if any)
# Use a while-read loop so this works on macOS bash 3.2 (no mapfile).
bold "1. Local files"
while IFS= read -r f; do
  [ -z "$f" ] && continue
  val=$(read_env_key "$f" || true)
  probe_key "$f" "${val:-}"
done < <(find . -maxdepth 4 \
  -not -path "*/node_modules/*" -not -path "*/.git/*" \
  -not -path "*/dist/*" -not -path "*/build/*" -not -path "*/.next/*" \
  \( -name ".env" -o -name ".env.*" \) -type f 2>/dev/null | sort -u)

echo
bold "2. Current shell env"
probe_key "process.env.OPENAI_API_KEY" "${OPENAI_API_KEY:-}"

# 3) Cloud Run service env (optional)
echo
bold "3. Cloud Run service ($CLOUD_RUN_SERVICE @ $CLOUD_RUN_REGION)"
if ! command -v gcloud >/dev/null 2>&1; then
  dim "gcloud CLI not on PATH — skipping."
else
  if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q .; then
    dim "gcloud not authenticated (run 'gcloud auth login') — skipping."
  else
    # 3a) Inline env var on the service
    cr_inline=$(gcloud run services describe "$CLOUD_RUN_SERVICE" \
      --region="$CLOUD_RUN_REGION" \
      --format="value(spec.template.spec.containers[0].env.filter('name=OPENAI_API_KEY').extract(value).flatten())" \
      2>/dev/null || true)
    probe_key "cloudrun:env(OPENAI_API_KEY)" "${cr_inline:-}"

    # 3b) Secret-Manager-mounted env var
    cr_secret_ref=$(gcloud run services describe "$CLOUD_RUN_SERVICE" \
      --region="$CLOUD_RUN_REGION" \
      --format="value(spec.template.spec.containers[0].env.filter('name=OPENAI_API_KEY').extract(valueFrom.secretKeyRef.name).flatten())" \
      2>/dev/null || true)
    if [ -n "$cr_secret_ref" ]; then
      cr_secret_val=$(gcloud secrets versions access latest --secret="$cr_secret_ref" 2>/dev/null || true)
      probe_key "cloudrun:secret($cr_secret_ref)" "${cr_secret_val:-}"
    else
      dim "No Secret-Manager reference for OPENAI_API_KEY on $CLOUD_RUN_SERVICE."
    fi
  fi
fi

# 4) Vercel project env (existence only — values cannot be fetched without pulling)
echo
bold "4. Vercel project env"
if ! command -v vercel >/dev/null 2>&1; then
  dim "vercel CLI not on PATH — skipping."
else
  if ! vercel whoami >/dev/null 2>&1; then
    dim "vercel CLI not authenticated (run 'vercel login') — skipping."
  else
    vercel_listing=$(vercel env ls 2>/dev/null || true)
    if echo "$vercel_listing" | grep -q "OPENAI_API_KEY"; then
      echo "$vercel_listing" | awk 'NR==1 || /OPENAI_API_KEY/'
      dim "Tip: 'vercel env pull .env.vercel.local' brings values down so this script can probe them."
    else
      dim "No OPENAI_API_KEY in Vercel env."
    fi
  fi
fi

echo
bold "Done."
dim "Tip: GET /api/agent/voice/health (admin auth) returns the live key status from the running server."
