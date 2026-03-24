#!/usr/bin/env bash
# =============================================================================
# Host audit (disco + LaunchAgents) — ligero, para ejecución cada hora.
# Escribe a ~/.cache/bmc-audit-host/
#
# Uso: ./scripts/host-audit-hourly.sh
#      (o vía launchd: scripts/install-host-audit-hourly.sh)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="${OUT_DIR:-$HOME/.cache/bmc-audit-host}"
mkdir -p "$OUT_DIR"

STAMP=$(date '+%Y%m%d-%H%M')
OUT="$OUT_DIR/report-$STAMP.md"

{
  echo "# Host audit — $(date -Iseconds)"
  echo ""
  echo "## Disco"
  FREE_GB=$(df -g / 2>/dev/null | awk 'NR==2 {print $4}' || df / 2>/dev/null | awk 'NR==2 {print int($4/1024/1024)}')
  echo "Libre en /: ${FREE_GB:-?} GB"
  echo ""
  echo "## LaunchAgents"
  echo ""
} > "$OUT"

if [[ -x "$REPO_ROOT/scripts/audit-launchagents-matias.sh" ]]; then
  "$REPO_ROOT/scripts/audit-launchagents-matias.sh" >> "$OUT" 2>&1 || echo "(audit falló)" >> "$OUT"
else
  echo "audit-launchagents-matias.sh no encontrado" >> "$OUT"
fi

# Copiar como latest para acceso rápido
cp "$OUT" "$OUT_DIR/latest.md"

echo "[$(date '+%H:%M:%S')] Host audit → $OUT_DIR/latest.md"
