#!/usr/bin/env bash
# Migrate Cloud Run env vars from plain literals to Secret Manager refs (two-step).
# Cloud Run rejects changing env→secret type in a single update (see Phase 0 / hotfix #167).
#
# Usage:
#   ./scripts/cloud-run-env-to-secret.sh SMTP_PASS WA_JWT_SECRET
#   ./scripts/cloud-run-env-to-secret.sh --from-env API_AUTH_TOKEN   # read value from .env
#
# Options:
#   --service NAME     default panelin-calc
#   --project ID       default chatbot-bmc-live
#   --region REGION    default us-central1
#   --dry-run          print steps only
#   --from-env         load values from repo .env (keys must exist and be non-empty)

set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

PROJECT="${GCLOUD_PROJECT:-chatbot-bmc-live}"
REGION="${GCLOUD_REGION:-us-central1}"
SERVICE="${GCLOUD_SERVICE:-panelin-calc}"
DRY_RUN=0
FROM_ENV=0
KEYS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --service) SERVICE="$2"; shift 2 ;;
    --project) PROJECT="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --from-env) FROM_ENV=1; shift ;;
    -h|--help)
      sed -n '1,20p' "$0"
      exit 0
      ;;
    *)
      KEYS+=("$1")
      shift
      ;;
  esac
done

if [[ ${#KEYS[@]} -eq 0 ]]; then
  echo "Error: pass at least one env var name (e.g. SMTP_PASS WA_JWT_SECRET)"
  exit 1
fi

load_env_key() {
  local k="$1"
  local line val
  line=$(grep -E "^${k}=" .env 2>/dev/null | grep -v '^#' | head -1) || true
  [[ -z "$line" ]] && return 1
  val="${line#*=}"
  val="${val%\"}" ; val="${val#\"}"
  val="${val%\'}" ; val="${val#\'}"
  printf '%s' "$val"
}

RUNTIME_SA="$(gcloud run services describe "$SERVICE" \
  --region="$REGION" --project="$PROJECT" \
  --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
if [[ -z "$RUNTIME_SA" ]]; then
  echo "Error: could not read runtime SA for $SERVICE"
  exit 1
fi

echo "=== Cloud Run env → Secret Manager ==="
echo "  service=$SERVICE project=$PROJECT region=$REGION"
echo "  runtime SA=$RUNTIME_SA"
echo "  keys: ${KEYS[*]}"
echo ""

declare -a MIGRATE_KEYS=()

for key in "${KEYS[@]}"; do
  val=""
  if [[ "$FROM_ENV" -eq 1 ]]; then
    val="$(load_env_key "$key" || true)"
    if [[ -z "$val" ]]; then
      echo "Error: $key empty or missing in .env (--from-env)"
      exit 1
    fi
  else
    val="$(gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT" --format=json \
    | node -e "
const key=process.argv[1];
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
const env=d.spec?.template?.spec?.containers?.[0]?.env||[];
const e=env.find(x=>x.name===key);
if(!e){ process.exit(2); }
if(e.valueFrom?.secretKeyRef){ process.exit(3); }
if(e.value==null){ process.exit(4); }
process.stdout.write(String(e.value));
" "$key" 2>/dev/null || true)"
    rc=$?
    if [[ $rc -eq 3 ]]; then
      echo "⏭  $key: already a secret ref — skip"
      continue
    fi
    if [[ $rc -ne 0 || -z "$val" ]]; then
      echo "Error: could not read literal value for $key on $SERVICE (rc=$rc)"
      exit 1
    fi
  fi

  if [[ "$val" == "-" ]]; then
    echo "Warning: $key is placeholder '-' on Cloud Run — provision a real value before migrating"
    continue
  fi

  echo "→ $key: ensure GSM secret + accessor..."
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "  [dry-run] gcloud secrets create|$key + versions add + IAM + remove-env-vars + update-secrets"
    continue
  fi

  if ! gcloud secrets describe "$key" --project="$PROJECT" >/dev/null 2>&1; then
    gcloud secrets create "$key" --replication-policy=automatic --project="$PROJECT" --quiet
  fi
  current="$(gcloud secrets versions access latest --secret="$key" --project="$PROJECT" 2>/dev/null || echo "")"
  if [[ "$current" != "$val" ]]; then
    printf '%s' "$val" | gcloud secrets versions add "$key" --data-file=- --project="$PROJECT" --quiet >/dev/null
    echo "  ↑ new GSM version for $key"
  else
    echo "  ✓ GSM $key unchanged"
  fi
  gcloud secrets add-iam-policy-binding "$key" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT" \
    --quiet >/dev/null 2>&1 || true
  MIGRATE_KEYS+=("$key")
done

if [[ ${#MIGRATE_KEYS[@]} -eq 0 ]]; then
  echo "Nothing to mount (all keys skipped or already secrets)."
  exit 0
fi

REMOVE_LIST="$(IFS=,; echo "${MIGRATE_KEYS[*]}")"
SECRET_PAIRS=()
for key in "${MIGRATE_KEYS[@]}"; do
  SECRET_PAIRS+=("$key=$key:latest")
done
SECRETS_CSV="$(IFS=,; echo "${SECRET_PAIRS[*]}")"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] gcloud run services update --remove-env-vars=$REMOVE_LIST"
  echo "[dry-run] gcloud run services update --update-secrets=$SECRETS_CSV"
  exit 0
fi

echo ""
echo "Step 1/2: remove literal env vars..."
gcloud run services update "$SERVICE" \
  --region="$REGION" \
  --project="$PROJECT" \
  --remove-env-vars="$REMOVE_LIST" \
  --quiet

echo "Step 2/2: mount Secret Manager refs..."
gcloud run services update "$SERVICE" \
  --region="$REGION" \
  --project="$PROJECT" \
  --update-secrets="$SECRETS_CSV" \
  --quiet

echo ""
echo "Done. Verify names only:"
gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT" --format=json \
  | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
const env=d.spec?.template?.spec?.containers?.[0]?.env||[];
const lit=env.filter(e=>e.value&&!e.valueFrom).map(e=>e.name);
const sec=env.filter(e=>e.valueFrom?.secretKeyRef).map(e=>e.name);
console.log('literals:', lit.length);
console.log('secrets:', sec.length, sec.join(', '));
"
