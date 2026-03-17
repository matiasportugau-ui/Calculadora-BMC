#!/usr/bin/env bash
# BMC Dashboard — Run Audit Runner then Debug Reviewer (sequential)
# Usage: bash .cursor/skills/bmc-dashboard-audit-runner/scripts/run_audit_then_debug.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../" && pwd)"
AUDIT_DIR="$REPO_ROOT/.cursor/bmc-audit"
cd "$REPO_ROOT"

mkdir -p "$AUDIT_DIR"
mkdir -p "$AUDIT_DIR/debug-export"

echo ""
echo "=== BMC Dashboard — Audit + Debug (Sequential) ==="
echo ""

# --- Phase 1: Audit Runner ---
echo "[1/2] Audit Runner: ensuring stack, running audit..."
if ! curl -sf "http://localhost:3001/health" >/dev/null 2>&1; then
  echo "  API not running. Start with: npm run dev:full-stack"
  echo "  Then re-run this script."
  exit 1
fi

bash "$REPO_ROOT/.cursor/skills/super-agente-bmc-dashboard/scripts/run_audit.sh" \
  --output="$AUDIT_DIR/latest-report.md"

# Handoff for Debug Reviewer
AUDIT_TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date +"%Y-%m-%dT%H:%M:%S%z")
cat > "$AUDIT_DIR/handoff.json" << EOF
{
  "audit_completed_at": "$AUDIT_TS",
  "report_path": ".cursor/bmc-audit/latest-report.md",
  "api_healthy": true,
  "next_step": "Invoke bmc-dashboard-debug-reviewer agent"
}
EOF

echo ""
echo "  AUDIT RUNNER COMPLETE. Report: $AUDIT_DIR/latest-report.md"
echo ""

# --- Phase 2: Debug Reviewer (simplified — agent does full logic) ---
echo "[2/2] Debug Reviewer: parsing report, exporting issues..."

# Extract issues and create debug export (minimal script; agent does full analysis)
REPORT="$AUDIT_DIR/latest-report.md"
ISSUES="$AUDIT_DIR/debug-export/issues.md"
LOGS="$AUDIT_DIR/debug-export/logs-raw.txt"
CONFIG="$AUDIT_DIR/debug-export/config-gaps.md"
RECS="$AUDIT_DIR/debug-export/recommendations.md"
DEBUG_REPORT="$AUDIT_DIR/DEBUG-REPORT.md"

# Grep for common issue patterns
{
  echo "# Issues Extracted from Audit Report"
  echo ""
  echo "## Potential Errors"
  grep -iE "error|fail|500|503|401|NO |FALTA|no responde|no encontrado" "$REPORT" 2>/dev/null | head -50 || echo "(none)"
  echo ""
  echo "## Warnings"
  grep -iE "⚠|N/A|sugerencia|revisar" "$REPORT" 2>/dev/null | head -30 || echo "(none)"
} > "$ISSUES" 2>/dev/null || echo "# No issues extracted" > "$ISSUES"

# Log excerpts (extract section between LOG and Estado)
{
  echo "# Raw log excerpts from report"
  awk '/LOG 5 DÍAS/,/## Estado del Sistema/' "$REPORT" 2>/dev/null | head -100 || echo "(no logs)"
} > "$LOGS" 2>/dev/null || echo "(no logs)" > "$LOGS"

# Config gaps
{
  echo "# Config Gaps"
  grep -iE "\.env|service-account|BMC_SHEET|GOOGLE_APPLICATION|ML_CLIENT" "$REPORT" 2>/dev/null | head -20 || echo "(none)"
} > "$CONFIG" 2>/dev/null || echo "# No config gaps" > "$CONFIG"

# Recommendations
{
  echo "# Recommendations"
  echo ""
  echo "- If API not responding: npm run start:api"
  echo "- If .env missing: copy from .env.example"
  echo "- If service-account missing: download from GCP, save to docs/bmc-dashboard-modernization/"
  echo "- If cotizaciones fails: verify BMC_SHEET_ID and share sheet with service account"
  echo "- For persistent logs: node server/index.js 2>&1 | tee server.log"
  awk '/Recomendaciones/,/^##/' "$REPORT" 2>/dev/null | head -20 || true
} > "$RECS" 2>/dev/null || true

# Debug report
{
  echo "# BMC Dashboard Debug Report"
  echo ""
  echo "**Generated:** $(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date +"%Y-%m-%dT%H:%M:%S%z")"
  echo "**Source:** latest-report.md"
  echo ""
  echo "## Summary"
  echo ""
  echo "See: .cursor/bmc-audit/debug-export/"
  echo ""
  echo "## Files"
  echo "- issues.md"
  echo "- logs-raw.txt"
  echo "- config-gaps.md"
  echo "- recommendations.md"
  echo ""
  echo "## Full Audit Report"
  echo ""
  cat "$REPORT" 2>/dev/null || echo "(report not found)"
} > "$DEBUG_REPORT"

echo ""
echo "  DEBUG REVIEWER COMPLETE."
echo ""
echo "=== Output ==="
echo "  Report:    $AUDIT_DIR/latest-report.md"
echo "  Debug:     $AUDIT_DIR/DEBUG-REPORT.md"
echo "  Export:    $AUDIT_DIR/debug-export/"
echo ""
