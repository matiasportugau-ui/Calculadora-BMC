#!/usr/bin/env bash
# Deploy BMC Dashboard + Calculadora to Cloud Run (panelin-calc)
# Requires: gcloud CLI, project chatbot-bmc-live
# Usage: ./scripts/deploy-cloud-run.sh [--no-build] [--local-docker]
#
# By default uses Cloud Build (no local Docker needed).
# Use --local-docker to build with local Docker and push.

set -e
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

PROJECT="${GCLOUD_PROJECT:-chatbot-bmc-live}"
REGION="${GCLOUD_REGION:-us-central1}"
SERVICE="${GCLOUD_SERVICE:-panelin-calc}"
IMAGE="gcr.io/${PROJECT}/${SERVICE}"

NO_BUILD=false
LOCAL_DOCKER=false
for arg in "$@"; do
  [[ "$arg" == "--no-build" ]] && NO_BUILD=true
  [[ "$arg" == "--local-docker" ]] && LOCAL_DOCKER=true
done

echo ""
echo "=== Deploy BMC Dashboard + Calculadora to Cloud Run ==="
echo "  Service: $SERVICE"
echo "  Project: $PROJECT"
echo "  Region:  $REGION"
echo ""

if ! $NO_BUILD; then
  if $LOCAL_DOCKER && command -v docker &>/dev/null; then
    echo "[1/3] Building with local Docker..."
    docker build -f Dockerfile.bmc-dashboard -t "$IMAGE" .
    echo "[2/3] Pushing to gcr.io..."
    docker push "$IMAGE"
  else
    echo "[1/2] Building with Cloud Build (no local Docker needed)..."
    gcloud builds submit --config cloudbuild.yaml --project "$PROJECT" .
  fi
  echo "  ✓ Build OK"
else
  echo "[1/2] Skipping build (--no-build)"
fi
echo ""

echo "[$([ "$NO_BUILD" = true ] && echo "1" || echo "3")/3] Deploying to Cloud Run..."
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --project "$PROJECT" \
  --platform managed \
  --allow-unauthenticated \
  --timeout=300

echo ""
echo "=== Deploy complete ==="
echo ""
echo "  Run: gcloud run services describe $SERVICE --region=$REGION --format='value(status.url)'"
echo "  Calculadora: <URL>/calculadora"
echo "  Dashboard:   <URL>/finanzas"
echo "  API:         <URL>/calc"
echo ""
