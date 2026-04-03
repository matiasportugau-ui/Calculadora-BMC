#!/usr/bin/env bash
# =============================================================================
# Install LaunchAgent for session artifact lifecycle schedule.
# Schedule (Montevideo):
#   00:00, 09:00, 17:00 + catch-up next hour if missed
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SCHEDULER_SCRIPT="$REPO_ROOT/scripts/session-artifact-scheduler.sh"
PLIST_DEST="$HOME/Library/LaunchAgents/com.bmc.session-archive-schedule.plist"
OUT_DIR="$HOME/.cache/bmc-session-archive/scheduler"
STATE_FILE="$HOME/.cache/bmc-session-archive/index/schedule-state.log"

echo "Session Artifact Schedule — Install launchd job"
echo "Repo root: $REPO_ROOT"
echo ""

chmod +x "$SCHEDULER_SCRIPT"
mkdir -p "$OUT_DIR"
mkdir -p "$(dirname "$STATE_FILE")"

cat > "$PLIST_DEST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.bmc.session-archive-schedule</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$SCHEDULER_SCRIPT</string>
  </array>

  <!-- run hourly at minute 0; scheduler script gates slots/catch-up -->
  <key>StartCalendarInterval</key>
  <array>
    <dict>
      <key>Minute</key>
      <integer>0</integer>
    </dict>
  </array>

  <!-- run once when loading/login to catch a recent missed slot -->
  <key>RunAtLoad</key>
  <true/>

  <key>StandardOutPath</key>
  <string>$OUT_DIR/launchd-out.log</string>
  <key>StandardErrorPath</key>
  <string>$OUT_DIR/launchd-err.log</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>TZ_NAME</key>
    <string>America/Montevideo</string>
    <key>OUT_DIR</key>
    <string>$OUT_DIR</string>
    <key>STATE_FILE</key>
    <string>$STATE_FILE</string>
    <key>APPLY_PRUNE</key>
    <string>0</string>
  </dict>
</dict>
</plist>
EOF

launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"

echo "✓ Installed and loaded: $PLIST_DEST"
echo "✓ Timezone: America/Montevideo"
echo "✓ Slots: 00:00, 09:00, 17:00 (+1h catch-up)"
echo "✓ Manual run stays available: npm run session:archive:run"
