#!/usr/bin/env bash
# =============================================================================
# Instala el host audit (disco + LaunchAgents) como job cada hora.
# Ejecutar desde la raíz del repo: ./scripts/install-host-audit-hourly.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AUDIT_SCRIPT="$REPO_ROOT/scripts/host-audit-hourly.sh"
PLIST_DEST="$HOME/Library/LaunchAgents/com.bmc.host-audit.plist"
OUT_DIR="$HOME/.cache/bmc-audit-host"

echo "Host Audit (disco + LaunchAgents) — Install hourly job"
echo "Repo root: $REPO_ROOT"
echo ""

chmod +x "$AUDIT_SCRIPT"
mkdir -p "$OUT_DIR"
echo "✓ Script executable"
echo "✓ Out dir: $OUT_DIR"

cat > "$PLIST_DEST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.bmc.host-audit</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$AUDIT_SCRIPT</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
    <dict>
      <key>Minute</key>
      <integer>0</integer>
    </dict>
  </array>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>$OUT_DIR/launchd-out.log</string>
  <key>StandardErrorPath</key>
  <string>$OUT_DIR/launchd-err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>OUT_DIR</key>
    <string>$OUT_DIR</string>
  </dict>
</dict>
</plist>
EOF
echo "✓ Plist installed: $PLIST_DEST"

launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"
echo "✓ Job loaded"

echo ""
echo "Done. Host audit (disco + LaunchAgents) runs every hour (minute 0)."
echo "Reports: $OUT_DIR/latest.md"
echo ""
echo "To stop: launchctl unload $PLIST_DEST"
echo "To test: $AUDIT_SCRIPT"
