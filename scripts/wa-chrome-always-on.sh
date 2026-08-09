#!/usr/bin/env bash
# Always-on WhatsApp Web Chrome for Mode C — persistent session, no daily QR.
#
# Keeps a dedicated Chrome profile linked to WhatsApp so the extension can
# ingest without you re-opening browser / re-logging every day.
#
# Usage:
#   ./scripts/wa-chrome-always-on.sh              # start in background (or focus if running)
#   ./scripts/wa-chrome-always-on.sh start --wait # start + block until Chrome exits (LaunchAgent)
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
POLL_SEC=10

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

# Exact profile path only (avoid matching chrome-wa-profile-personal-1 when PROFILE is chrome-wa-profile)
profile_pgrep() {
  pgrep -f "user-data-dir=${PROFILE_DIR}( |$)" 2>/dev/null || true
}

is_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  if [[ -n "$(profile_pgrep | head -1)" ]]; then
    return 0
  fi
  return 1
}

# Best-effort main browser PID for this profile
resolve_running_pid() {
  local pid
  if [[ -f "$PID_FILE" ]]; then
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "$pid"
      return 0
    fi
  fi
  pid="$(profile_pgrep | head -1)"
  if [[ -n "$pid" ]]; then
    echo "$pid" >"$PID_FILE"
    echo "$pid"
    return 0
  fi
  return 1
}

# Block until no process uses this profile (Chrome main often re-execs / reparents).
wait_while_running() {
  echo "→ Waiting on WA Chrome (poll ${POLL_SEC}s). Exit when Chrome quits → KeepAlive restarts."
  while is_running; do
    sleep "$POLL_SEC"
  done
  echo "→ WA Chrome exited at $(date '+%Y-%m-%d %H:%M:%S')"
  rm -f "$PID_FILE"
}

cmd_status() {
  echo "Profile:  $PROFILE_DIR"
  if is_running; then
    echo "Status:   RUNNING"
    profile_pgrep | head -3 || true
    [[ -f "$PID_FILE" ]] && echo "PID file: $(cat "$PID_FILE")"
  else
    echo "Status:   stopped"
  fi

  if [[ -f "$PLIST_DST" ]]; then
    echo "Agent:    installed ($PLIST_DST)"
    launchctl print "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null | head -8 || echo "  (loaded? check launchctl list | grep bmc.wa)"
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
  # Prefer graceful stop of recorded PID, then any profile match
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
  pkill -f "user-data-dir=${PROFILE_DIR}" 2>/dev/null || true
  echo "Stopped always-on WA Chrome."
}

launch_chrome() {
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

  # Clear singleton locks if stale (crash leftovers) — only when not running
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

  # New session so launchd process-group teardown cannot SIGTERM Chrome
  # if the wrapper ever exits early (belt + suspenders with AbandonProcessGroup).
  if command -v setsid >/dev/null 2>&1; then
    setsid "$chrome" "${args[@]}" "$WA_URL" "$SPA_URL" \
      >>"$LOG_FILE" 2>&1 &
  else
    # macOS often lacks setsid; nohup + disown still helps interactive shells
    nohup "$chrome" "${args[@]}" "$WA_URL" "$SPA_URL" \
      >>"$LOG_FILE" 2>&1 &
    disown "$!" 2>/dev/null || true
  fi
  local pid=$!
  echo "$pid" >"$PID_FILE"
  sleep 2
  if kill -0 "$pid" 2>/dev/null; then
    echo "  ✓ running PID $pid"
  else
    sleep 1
    if pid="$(resolve_running_pid)"; then
      echo "  ✓ Chrome reparented — session process is up (PID $pid)"
    else
      echo "  WARN: process exited quickly — see $LOG_FILE" >&2
      return 1
    fi
  fi
  return 0
}

print_banner() {
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

# $1 = wait flag: 0|1
cmd_start() {
  local wait_mode="${1:-0}"
  mkdir -p "$REPO/.runtime" "$PROFILE_DIR"

  if is_running; then
    echo "Already running — leave it alone (session stays linked)."
    resolve_running_pid >/dev/null || true
    cmd_status
    echo ""
    echo "Cockpit: $SPA_URL"
    echo "Tip: do not run Playwright scripts against the same PROFILE while this is up."
    if [[ "$wait_mode" == "1" ]]; then
      wait_while_running
    fi
    return 0
  fi

  if ! launch_chrome; then
    if [[ "$wait_mode" == "1" ]]; then
      # Non-zero so KeepAlive retries after ThrottleInterval
      exit 1
    fi
    return 1
  fi

  print_banner

  if [[ "$wait_mode" == "1" ]]; then
    wait_while_running
  fi
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
  echo "Starts on login; KeepAlive only when Chrome actually exits (start --wait)."
  cmd_status
}

cmd_uninstall_agent() {
  launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
  rm -f "$PLIST_DST"
  echo "Uninstalled LaunchAgent $PLIST_LABEL"
}

# Parse: start [--wait] | --status | --stop | --install-agent | ...
MAIN="${1:-start}"
shift || true
WAIT_MODE=0
for arg in "$@"; do
  case "$arg" in
    --wait|wait) WAIT_MODE=1 ;;
  esac
done
# LaunchAgent sets XPC_SERVICE_NAME=com.bmc.wa-chrome — always wait under launchd
if [[ "${XPC_SERVICE_NAME:-}" == "$PLIST_LABEL" ]]; then
  WAIT_MODE=1
fi

case "$MAIN" in
  start|"") cmd_start "$WAIT_MODE" ;;
  --status|status) cmd_status ;;
  --stop|stop) cmd_stop ;;
  --install-agent|install-agent) cmd_install_agent ;;
  --uninstall-agent|uninstall-agent) cmd_uninstall_agent ;;
  -h|--help)
    sed -n '1,30p' "$0"
    ;;
  *)
    echo "Unknown: $MAIN (start [--wait]|status|stop|install-agent|uninstall-agent)"
    exit 1
    ;;
esac
