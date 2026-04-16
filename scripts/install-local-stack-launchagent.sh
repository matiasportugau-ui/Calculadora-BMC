#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENTRY="$REPO_ROOT/scripts/local-stack-launchd-entry.sh"
LABEL="com.bmc.calculadora-localstack"
PLIST_DEST="$HOME/Library/LaunchAgents/${LABEL}.plist"
RUNTIME_DIR="$REPO_ROOT/.runtime"

mkdir -p "$RUNTIME_DIR"
chmod +x "$ENTRY"

cat >"$PLIST_DEST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>WorkingDirectory</key>
  <string>${REPO_ROOT}</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${ENTRY}</string>
  </array>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>

  <key>ThrottleInterval</key>
  <integer>10</integer>

  <key>StandardOutPath</key>
  <string>${RUNTIME_DIR}/local-stack-launchd-stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${RUNTIME_DIR}/local-stack-launchd-stderr.log</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key>
    <string>${HOME}</string>
    <key>BMC_DISK_PRECHECK_MODE</key>
    <string>warn</string>
  </dict>
</dict>
</plist>
EOF

launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"

echo "Instalado: $PLIST_DEST"
echo "Label: $LABEL"
echo "Arranca al iniciar sesión (y reinicia si npm falla; si ya hay stack sano, sale sin duplicar)."
echo "BMC_DISK_PRECHECK_MODE=warn solo para este agente: con poco disco, Vite arranca igual (aviso en log)."
echo "Logs: $RUNTIME_DIR/local-stack-launchd*.log"
echo "Probar ahora: launchctl kickstart -k \"gui/\$(id -u)/$LABEL\""
echo "Desinstalar: npm run local:stack:launchd:uninstall"
