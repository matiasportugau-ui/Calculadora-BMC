#!/bin/bash
# ==============================================================================
# BMC Finanzas 404 Repro Automation
# Purpose: Confirm whether the legacy /finanzas static dashboard assets
#          are actually present inside the Docker image that runs on Cloud Run.
#
# This is the automated version of Phase 1 from the 2026-05-29 finanzas-404 plan.
#
# Usage (on your Mac with Docker Desktop):
#   chmod +x scripts/repro-finanzas-404.sh
#   ./scripts/repro-finanzas-404.sh
#
# Output: finanzas-repro-YYYYMMDD-HHMMSS.log  (paste the whole thing back to the agent)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="finanzas-repro-$(date +%Y%m%d-%H%M%S).log"
DASHBOARD_DIR="docs/bmc-dashboard-modernization/dashboard"
IMAGE_NAME="bmc-finanzas-test:latest"
CONTAINER_PORT=3010

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
  echo -e "$@" | tee -a "$LOG_FILE"
}

section() {
  echo "" | tee -a "$LOG_FILE"
  echo "================================================================================" | tee -a "$LOG_FILE"
  echo -e "${BLUE}$1${NC}" | tee -a "$LOG_FILE"
  echo "================================================================================" | tee -a "$LOG_FILE"
}

die() {
  echo -e "${RED}ERROR: $1${NC}" | tee -a "$LOG_FILE"
  echo ""
  echo "Full log saved to: $LOG_FILE"
  echo "Please paste the entire contents of that file back to the agent."
  exit 1
}

# -----------------------------------------------------------------------------
# 1. Environment checks
# -----------------------------------------------------------------------------
section "1. Environment checks"

if ! command -v docker >/dev/null 2>&1; then
  die "Docker command not found. Install Docker Desktop for Mac and make sure it is running."
fi

if ! docker info >/dev/null 2>&1; then
  die "Docker daemon not reachable. Open Docker Desktop and wait until it says 'Docker Desktop is running'."
fi

echo "Docker version:" | tee -a "$LOG_FILE"
docker --version | tee -a "$LOG_FILE"

cd "$REPO_ROOT"
echo "Working directory: $(pwd)" | tee -a "$LOG_FILE"

if [[ ! -f "Dockerfile.bmc-dashboard" ]]; then
  die "Dockerfile.bmc-dashboard not found in repo root. Are you in the correct directory?"
fi

if [[ ! -d "$DASHBOARD_DIR" ]]; then
  die "Source dashboard directory not found: $DASHBOARD_DIR"
fi

log "✅ Docker is available and daemon is running"
log "✅ Running from correct repo root"

# -----------------------------------------------------------------------------
# 2. Build the exact image used in production
# -----------------------------------------------------------------------------
section "2. Building production image (this can take 2-4 minutes on first run)"

log "Command: docker build -f Dockerfile.bmc-dashboard -t $IMAGE_NAME ."
echo ""

if ! docker build -f Dockerfile.bmc-dashboard -t "$IMAGE_NAME" . 2>&1 | tee -a "$LOG_FILE"; then
  die "Docker build failed. See log above."
fi

log "✅ Image built successfully: $IMAGE_NAME"

# -----------------------------------------------------------------------------
# 3. The critical inspection (what actually ends up inside the image)
# -----------------------------------------------------------------------------
section "3. CRITICAL INSPECTION — Dashboard files inside the image?"

INSPECTION_CMD='
  echo "=== INSIDE CONTAINER ==="
  echo "pwd: $(pwd)"
  echo ""
  echo "=== /app/docs/bmc-dashboard-modernization/dashboard/ ==="
  ls -la /app/docs/bmc-dashboard-modernization/dashboard/ 2>&1 || echo ">>> FOLDER MISSING OR EMPTY <<<"
  echo ""
  echo "=== parent directory ==="
  ls -la /app/docs/bmc-dashboard-modernization/ 2>&1 || true
  echo ""
  echo "=== Does index.html exist? ==="
  ls -l /app/docs/bmc-dashboard-modernization/dashboard/index.html 2>&1 || echo "MISSING"
'

log "Running inspection container..."
echo ""

INSPECTION_OUTPUT=$(docker run --rm "$IMAGE_NAME" sh -c "$INSPECTION_CMD" 2>&1)

echo "$INSPECTION_OUTPUT" | tee -a "$LOG_FILE"

# -----------------------------------------------------------------------------
# 4. Root cause analysis (the whole point of this script)
# -----------------------------------------------------------------------------
section "4. ROOT CAUSE ANALYSIS"

if echo "$INSPECTION_OUTPUT" | grep -q "FOLDER MISSING OR EMPTY"; then
  echo -e "${RED}╔══════════════════════════════════════════════════════════════════════════════╗${NC}" | tee -a "$LOG_FILE"
  echo -e "${RED}║  ✅ ROOT CAUSE CONFIRMED                                                    ║${NC}" | tee -a "$LOG_FILE"
  echo -e "${RED}║  The legacy /finanzas dashboard static files did NOT make it into the image.║${NC}" | tee -a "$LOG_FILE"
  echo -e "${RED}║  This is exactly why prod returns {ok:false, error:\"Not found\", path:\"/finanzas\"} ║${NC}" | tee -a "$LOG_FILE"
  echo -e "${RED}╚══════════════════════════════════════════════════════════════════════════════╝${NC}" | tee -a "$LOG_FILE"
  CONFIRMED=1
else
  if echo "$INSPECTION_OUTPUT" | grep -q "index.html"; then
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}" | tee -a "$LOG_FILE"
    echo -e "${GREEN}║  ⚠️  UNEXPECTED RESULT                                                        ║${NC}" | tee -a "$LOG_FILE"
    echo -e "${GREEN}║  The dashboard files ARE present inside the image you just built.             ║${NC}" | tee -a "$LOG_FILE"
    echo -e "${GREEN}║  The 404 in production is likely caused by:                                   ║${NC}" | tee -a "$LOG_FILE"
    echo -e "${GREEN}║    • Old Cloud Run revision still receiving traffic                           ║${NC}" | tee -a "$LOG_FILE"
    echo -e "${GREEN}║    • Stale build cache / previous image                                       ║${NC}" | tee -a "$LOG_FILE"
    echo -e "${GREEN}║    • .dockerignore change not yet deployed                                    ║${NC}" | tee -a "$LOG_FILE"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}" | tee -a "$LOG_FILE"
    CONFIRMED=0
  else
    echo -e "${YELLOW}⚠️  Ambiguous result. Please paste the full log.${NC}" | tee -a "$LOG_FILE"
    CONFIRMED=0
  fi
fi

# -----------------------------------------------------------------------------
# 5. Optional: quick functional test (if port is free)
# -----------------------------------------------------------------------------
section "5. Functional smoke (optional)"

if lsof -i :$CONTAINER_PORT >/dev/null 2>&1; then
  log "Port $CONTAINER_PORT already in use — skipping live container test."
else
  log "Starting temporary container on port $CONTAINER_PORT for curl test..."
  docker run --rm -d --name bmc-finanzas-smoke -p $CONTAINER_PORT:3001 \
    -e PORT=3001 -e NODE_ENV=production "$IMAGE_NAME" >/dev/null

  sleep 3

  log "Testing http://localhost:$CONTAINER_PORT/finanzas"
  curl -I "http://localhost:$CONTAINER_PORT/finanzas" 2>&1 | tee -a "$LOG_FILE" || true

  log "First 600 bytes of HTML (if any):"
  curl -s "http://localhost:$CONTAINER_PORT/finanzas" 2>&1 | head -c 600 | tee -a "$LOG_FILE" || true

  docker stop bmc-finanzas-smoke >/dev/null 2>&1 || true
fi

# -----------------------------------------------------------------------------
# 6. Next steps for the user
# -----------------------------------------------------------------------------
section "6. WHAT TO DO NEXT"

echo "Log file created: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if [[ "${CONFIRMED:-0}" == "1" ]]; then
  echo -e "${GREEN}NEXT STEP:${NC}" | tee -a "$LOG_FILE"
  echo "1. Copy the ENTIRE contents of $LOG_FILE" | tee -a "$LOG_FILE"
  echo "2. Paste it back to the agent (Grok/Claude)." | tee -a "$LOG_FILE"
  echo "3. Say something like: \"Root cause confirmed by the script.\"" | tee -a "$LOG_FILE"
  echo "" | tee -a "$LOG_FILE"
  echo "The agent will then immediately apply the two fixes (.dockerignore + server logging)." | tee -a "$LOG_FILE"
else
  echo "Even though the result was unexpected, still paste the log file." | tee -a "$LOG_FILE"
  echo "The agent will analyze it and decide on the correct next action." | tee -a "$LOG_FILE"
fi

echo ""
echo "Full reproducible log saved to: $(pwd)/$LOG_FILE"
echo "Please paste that file (or its content) to continue the fix."

# Make the log easy to open
if command -v open >/dev/null 2>&1; then
  echo ""
  echo "Tip: run this to open the log in your editor:"
  echo "  open $LOG_FILE"
fi
