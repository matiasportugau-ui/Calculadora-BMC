#!/usr/bin/env bash
set -euo pipefail

PLIST_DEST="$HOME/Library/LaunchAgents/com.bmc.magazine-daily.plist"

launchctl unload "$PLIST_DEST" 2>/dev/null || true
rm -f "$PLIST_DEST"
echo "Desinstalado: com.bmc.magazine-daily"
