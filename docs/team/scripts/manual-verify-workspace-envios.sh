#!/usr/bin/env bash
# Opens prod URLs + writes/fills pointer to active checklist.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CHECKLIST="$ROOT/docs/team/VERIFY-MANUAL-RUN-2026-08-05_054026.md"
echo "Active checklist: $CHECKLIST"
echo "Logística: https://calculadora-bmc.vercel.app/logistica"
echo "Store:     https://panelin-workspace.vercel.app/workspace/store"
if [[ "${OPEN:-1}" == "1" ]] && command -v open >/dev/null; then
  open "https://calculadora-bmc.vercel.app/logistica" 2>/dev/null || true
  open "https://panelin-workspace.vercel.app/workspace/store" 2>/dev/null || true
  open "$CHECKLIST" 2>/dev/null || true
fi
test -f "$CHECKLIST" && echo "checklist exists" || echo "MISSING checklist"
