#!/usr/bin/env bash
# HITL ship script — Paneli MCP (PR #1095) → main → Cloud Run + Vercel
# Agent auto-mode cannot merge/deploy production; run this locally.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Merge PR #1095"
gh pr merge 1095 --squash --delete-branch

echo "==> Wait for main tip"
git fetch origin main
MAIN_SHA=$(git rev-parse origin/main)
echo "main=$MAIN_SHA"

echo "==> Trigger Cloud Run deploy (workflow_dispatch)"
gh workflow run "Deploy Calculator API to Cloud Run" --ref main
echo "==> Trigger Vercel production deploy (workflow_dispatch)"
gh workflow run "Deploy Frontend to Vercel" --ref main

echo "==> Watch latest deploy runs"
sleep 5
gh run list --workflow="Deploy Calculator API to Cloud Run" --branch main --limit 1
gh run list --workflow="Deploy Frontend to Vercel" --branch main --limit 1

echo
echo "When Cloud Run finishes:"
echo "  curl -sS https://panelin-calc-q74zutv7dq-uc.a.run.app/mcp/health"
echo "  curl -sS https://calculadora-bmc.vercel.app/mcp/health"
echo
echo "Auth smoke (uses API_AUTH_TOKEN until PANELI_MCP_SECRET is provisioned):"
echo "  doppler run --project=bmc-backend --config=prd -- \\"
echo "    bash -lc 'BMC_API_BASE=https://panelin-calc-q74zutv7dq-uc.a.run.app PANELI_MCP_SECRET=\"\$API_AUTH_TOKEN\" npm run smoke:paneli-mcp'"
echo
echo "Optional dedicated secret:"
echo "  bash scripts/provision-paneli-mcp-secret.sh"
