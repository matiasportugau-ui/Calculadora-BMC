#!/usr/bin/env bash
# Install drive cleanup as hourly launchd job
# Run from repo root: ./scripts/install-drive-cleanup-hourly.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLIST_SOURCE="$SCRIPT_DIR/drive-cleanup-launchd.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.bmc.drive-cleanup.plist"
LOG_DIR="$HOME/.cache/drive-cleanup"

echo "Drive Cleanup — Install hourly job"
echo "Repo root: $REPO_ROOT"
echo ""

# 1. Make script executable
chmod +x "$SCRIPT_DIR/drive-cleanup-automated.sh"
echo "✓ Script executable"

# 2. Create log dir
mkdir -p "$LOG_DIR"
echo "✓ Log dir: $LOG_DIR"

# 3. Generate plist with correct path
SCRIPT_PATH="$REPO_ROOT/scripts/drive-cleanup-automated.sh"
if [[ ! -f "$SCRIPT_PATH" ]]; then
  echo "Error: script not found at $SCRIPT_PATH"
  exit 1
fi

# Create plist with repo path
cat > "$PLIST_DEST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.bmc.drive-cleanup</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$SCRIPT_PATH</string>
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
  <string>$LOG_DIR/launchd-out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/launchd-err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>THRESHOLD_GB</key>
    <string>8</string>
    <key>DIALOG_TIMEOUT</key>
    <string>120</string>
    <key>LOG_DIR</key>
    <string>$LOG_DIR</string>
  </dict>
</dict>
</plist>
EOF
echo "✓ Plist installed: $PLIST_DEST"

# 4. Unload if already loaded
launchctl unload "$PLIST_DEST" 2>/dev/null || true

# 5. Load job
launchctl load "$PLIST_DEST"
echo "✓ Job loaded"

echo ""
echo "Done. Cleanup runs every hour (minute 0) when free space < 8 GB."
echo "Logs: $LOG_DIR/cleanup-YYYYMMDD.log"
echo ""
echo "To stop: launchctl unload $PLIST_DEST"
echo "To test: DRY_RUN=1 $SCRIPT_PATH"
