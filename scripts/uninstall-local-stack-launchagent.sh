#!/usr/bin/env bash
set -euo pipefail

LABEL="com.bmc.calculadora-localstack"
PLIST_DEST="$HOME/Library/LaunchAgents/${LABEL}.plist"

launchctl unload "$PLIST_DEST" 2>/dev/null || true
rm -f "$PLIST_DEST"
echo "Desinstalado: $LABEL"
