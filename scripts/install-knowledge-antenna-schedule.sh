#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEDULER_SCRIPT="$REPO_ROOT/scripts/knowledge-antenna-scheduler.sh"

PLIST_DEST="$HOME/Library/LaunchAgents/com.bmc.knowledge-antenna.plist"
OUT_DIR="$HOME/.cache/bmc-knowledge-antenna"
STATE_FILE="$OUT_DIR/schedule-state.log"

mkdir -p "$OUT_DIR"
touch "$STATE_FILE"
chmod +x "$SCHEDULER_SCRIPT"

cat > "$PLIST_DEST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.bmc.knowledge-antenna</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$SCHEDULER_SCRIPT</string>
  </array>

  <key>StartCalendarInterval</key>
  <array>
    <dict>
      <key>Minute</key>
      <integer>0</integer>
    </dict>
  </array>

  <key>RunAtLoad</key>
  <true/>

  <key>StandardOutPath</key>
  <string>$OUT_DIR/launchd-out.log</string>
  <key>StandardErrorPath</key>
  <string>$OUT_DIR/launchd-err.log</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>TZ_NAME</key>
    <string>America/Montevideo</string>
    <key>RUN_HOUR_UTC</key>
    <string>10</string>
    <key>OUT_DIR</key>
    <string>$OUT_DIR</string>
    <key>STATE_FILE</key>
    <string>$STATE_FILE</string>
  </dict>
</dict>
</plist>
EOF

launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"

echo "Installed: $PLIST_DEST"
echo "Schedule: hourly tick; run at local 10:00 (TZ America/Montevideo)"
echo "Manual trigger: npm run knowledge:run"
