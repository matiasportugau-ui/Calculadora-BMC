#!/usr/bin/env bash
# Always-on WhatsApp Web Chrome for Mode C — persistent session, no daily QR.
#
# Keeps a dedicated Chrome profile linked to WhatsApp so the extension can
# ingest without you re-opening browser / re-logging every day.
#
# Usage:
#   ./scripts/wa-chrome-always-on.sh              # start (or focus if running)
#   ./scripts/wa-chrome-always-on.sh --status
#   ./scripts/wa-chrome-always-on.sh --stop
#   ./scripts/wa-chrome-always-on.sh --install-agent   # LaunchAgent KeepAlive
#   ./scripts/wa-chrome-always-on.sh --uninstall-agent
#
# Env:
#   SPA_URL          default https://calculadora-bmc.vercel.app/hub/wa
#   WA_EXT_FORCE_STABLE=1  allow Chrome stable without auto --load-extension
#   PROFILE_DIR      default .runtime/chrome-wa-profile
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE_DIR="${PROFILE_DIR:-$REPO/.runtime/chrome-wa-profile}"
PID_FILE="$REPO/.runtime/wa-chrome-always-on.pid"
LOG_FILE="$REPO/.runtime/wa-chrome-always-on.log"
SPA_URL="${SPA_URL:-https://calculadora-bmc.vercel.app/hub/wa}"
WA_URL="https://web.whatsapp.com/"
PLIST_LABEL="com.bmc.wa-chrome"
PLIST_SRC="$REPO/docs/wa-cockpit/com.bmc.wa-chrome.plist.example"
PLIST_DST="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"

# Resolve extension build dir (several possible locations on this machine)
resolve_ext_build() {
  local candidates=(
    "${WA_EXT_BUILD:-}"
    "$REPO/../calculadora-bmc-wa-extension/.output/chrome-mv3"
    "$HOME/Panelin calc loca/calculadora-bmc-wa-extension/.output/chrome-mv3"
    "$HOME/Panelin calc loca/calculadora-bmc-wa-extension/chrome-mv3"
    "$HOME/calculadora-bmc-wa-extension/.output/chrome-mv3"
  )
  local c
  for c in "${candidates[@]}"; do
    [[ -z "$c" ]] && continue
    if [[ -f "$c/manifest.json" ]]; then
      echo "$c"
      return 0
    fi
  done
  return 1
}

resolve_chrome() {
  # Prefer browsers that still honor --load-extension (Chrome stable 147+ blocks it)
  local entry kind path
  for entry in \
    "beta:/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta" \
    "dev:/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev" \
    "canary:/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary" \
    "chromium:/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "brave:/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
    "edge:/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
    "stable:/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
    kind="${entry%%:*}"
    path="${entry#*:}"
    if [[ -x "$path" ]]; then
      echo "$kind|$path"
      return 0
    fi
  done
  return 1
}

is_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  # Exact profile path only (avoid matching chrome-wa-profile-personal-1 when PROFILE is chrome-wa-profile)
  if pgrep -f "user-data-dir=${PROFILE_DIR}( |$)" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

cmd_status() {
  echo "Profile:  $PROFILE_DIR"
  if is_running; then
    echo "Status:   RUNNING"
    pgrep -fl "user-data-dir=${PROFILE_DIR}( |$)" 2>/dev/null | head -3 || true
    [[ -f "$PID_FILE" ]] && echo "PID file: $(cat "$PID_FILE")"
  else
    echo "Status:   stopped"
  fi

  if [[ -f "$PLIST_DST" ]]; then
    echo "Agent:    installed ($PLIST_DST)"
    launchctl print "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null | head -5 || echo "  (loaded? check launchctl list | grep bmc.wa)"
  else
    echo "Agent:    not installed"
  fi
  if [[ -d "$PROFILE_DIR" ]]; then
    echo "Session:  profile exists (QR only if WhatsApp unlinks this device)"
  else
    echo "Session:  no profile yet — first start needs QR"
  fi
}

cmd_stop() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "Stopping PID $pid…"
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
  # Kill all chrome instances on this profile (children)
  pkill -f "user-data-dir=${PROFILE_DIR}" 2>/dev/null || true
  echo "Stopped always-on WA Chrome."
}

cmd_start() {
  mkdir -p "$REPO/.runtime" "$PROFILE_DIR"

  if is_running; then
    echo "Already running — leave it alone (session stays linked)."
    cmd_status
    echo ""
    echo "Cockpit: $SPA_URL"
    echo "Tip: do not run Playwright scripts against the same PROFILE while this is up."
    return 0
  fi

  local chrome_pair chrome_kind chrome
  chrome_pair="$(resolve_chrome)" || {
    echo "ERROR: no Chrome/Brave/Edge found in /Applications" >&2
    exit 1
  }
  chrome_kind="${chrome_pair%%|*}"
  chrome="${chrome_pair#*|}"

  local ext_build=""
  if ext_build="$(resolve_ext_build)"; then
    echo "Extension: $ext_build"
  else
    echo "WARN: extension build not found — launching WA Web only."
    echo "  Build: cd \"\$HOME/Panelin calc loca/calculadora-bmc-wa-extension\" && npm run build"
    echo "  Or set WA_EXT_BUILD=/path/to/chrome-mv3"
  fi

  if [[ "$chrome_kind" = "stable" ]]; then
    echo "⚠️  Chrome stable may ignore --load-extension (v147+)."
    echo "   Prefer: brew install --cask google-chrome-beta"
    if [[ -n "$ext_build" && "${WA_EXT_FORCE_STABLE:-0}" != "1" ]]; then
      echo "   Continuing with stable (extension may need manual load)."
    fi
  fi

  # Clear singleton locks if stale (crash leftovers)
  for f in SingletonLock SingletonCookie SingletonSocket; do
    rm -f "$PROFILE_DIR/$f" 2>/dev/null || true
  done

  local args=(
    --user-data-dir="$PROFILE_DIR"
    --no-first-run
    --no-default-browser-check
    --disable-features=DialMediaRouteProvider
    --disable-session-crashed-bubble
    --hide-crash-restore-bubble
  )
  if [[ -n "$ext_build" ]]; then
    args+=(--load-extension="$ext_build")
  fi

  echo "→ Starting always-on WA Chrome ($chrome_kind)"
  echo "   Profile: $PROFILE_DIR"
  echo "   Log:     $LOG_FILE"

  # Open WA Web + cockpit (prod cockpit default so no local vite needed)
  nohup "$chrome" "${args[@]}" "$WA_URL" "$SPA_URL" \
    >>"$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" >"$PID_FILE"
  sleep 2
  if kill -0 "$pid" 2>/dev/null; then
    echo "  ✓ running PID $pid"
  else
    # Chrome often re-execs; re-detect
    sleep 1
    if is_running; then
      echo "  ✓ Chrome reparented — session process is up"
    else
      echo "  WARN: process exited quickly — see $LOG_FILE"
    fi
  fi

  cat <<EOF

════════════════════════════════════════════════════════
 ALWAYS-ON Mode C session

 1) If QR appears → scan ONCE (session then persists).
 2) Extension: ensure Sync ON + API URL production:
      https://panelin-calc-q74zutv7dq-uc.a.run.app
 3) Leave this Chrome open (minimize is fine).
 4) Use cockpit for day-to-day — no need to re-open:
      $SPA_URL

 Install auto-start on login:
   ./scripts/wa-chrome-always-on.sh --install-agent

 G8 voice notes (few clicks when you want transcripts):
   ./scripts/wa-g8-one-click.sh
════════════════════════════════════════════════════════
EOF
}

cmd_install_agent() {
  mkdir -p "$HOME/Library/LaunchAgents"
  if [[ ! -f "$PLIST_SRC" ]]; then
    echo "ERROR: missing $PLIST_SRC" >&2
    exit 1
  fi
  # Expand paths into installed plist
  sed \
    -e "s|__REPO__|$REPO|g" \
    -e "s|__HOME__|$HOME|g" \
    "$PLIST_SRC" >"$PLIST_DST"
  launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"
  launchctl enable "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
  launchctl kickstart -k "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
  echo "Installed LaunchAgent: $PLIST_DST"
  echo "Starts on login and KeepAlive if Chrome exits."
  cmd_status
}

cmd_uninstall_agent() {
  launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
  rm -f "$PLIST_DST"
  echo "Uninstalled LaunchAgent $PLIST_LABEL"
}

case "${1:-start}" in
  start|"") cmd_start ;;
  --status|status) cmd_status ;;
  --stop|stop) cmd_stop ;;
  --install-agent|install-agent) cmd_install_agent ;;
  --uninstall-agent|uninstall-agent) cmd_uninstall_agent ;;
  -h|--help)
    sed -n '1,25p' "$0"
    ;;
  *)
    echo "Unknown: $1 (start|status|stop|install-agent|uninstall-agent)"
    exit 1
    ;;
esac
