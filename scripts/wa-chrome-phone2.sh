#!/usr/bin/env bash
# Second WhatsApp phone — isolated Chrome profile (does NOT touch main always-on).
#
# Usage:
#   ./scripts/wa-chrome-phone2.sh start     # open WA Web for QR with other phone
#   ./scripts/wa-chrome-phone2.sh reset     # wipe profile + start (fresh QR)
#   ./scripts/wa-chrome-phone2.sh stop
#   ./scripts/wa-chrome-phone2.sh status
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE="${PROFILE_DIR:-$REPO/.runtime/chrome-wa-profile-phone2}"
# Keep legacy personal-1 path as alias if phone2 dir missing but personal-1 exists
if [[ ! -d "$PROFILE" && -d "$REPO/.runtime/chrome-wa-profile-personal-1" && "${1:-}" != "reset" ]]; then
  PROFILE="$REPO/.runtime/chrome-wa-profile-personal-1"
fi
PID_FILE="$REPO/.runtime/wa-chrome-phone2.pid"
LOG_FILE="$REPO/.runtime/wa-chrome-phone2.log"
CDP_PORT="${WA_PHONE2_CDP_PORT:-9223}"
WA_URL="https://web.whatsapp.com/"
TAG="phone2" # used when scanning process list (avoid matching this script path)

kill_profile_chrome() {
  python3 - "$PROFILE" <<'PY'
import os, signal, sys, time, subprocess
profile = sys.argv[1]
def list_pids():
    out = subprocess.check_output(["ps", "-ax", "-o", "pid=,command="], text=True)
    pids = []
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split(None, 1)
        if len(parts) < 2:
            continue
        pid, cmd = int(parts[0]), parts[1]
        # Match Chrome using this user-data-dir only
        if profile in cmd and "user-data-dir=" in cmd and "Chrome" in cmd:
            pids.append(pid)
    return pids
pids = list_pids()
for pid in pids:
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
time.sleep(1.5)
for pid in list_pids():
    try:
        os.kill(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
left = list_pids()
print(f"stopped {len(pids)} procs; remaining={left}")
sys.exit(0 if not left else 1)
PY
}

is_running() {
  python3 - "$PROFILE" <<'PY'
import sys, subprocess
profile = sys.argv[1]
out = subprocess.check_output(["ps", "-ax", "-o", "pid=,command="], text=True)
for line in out.splitlines():
    if profile in line and "user-data-dir=" in line and "Chrome" in line:
        print(line.strip()[:160])
        sys.exit(0)
sys.exit(1)
PY
}

resolve_chrome() {
  local p
  for p in \
    "/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta" \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
    if [[ -x "$p" ]]; then
      echo "$p"
      return 0
    fi
  done
  return 1
}

resolve_ext() {
  local c
  for c in \
    "${WA_EXT_BUILD:-}" \
    "$REPO/../calculadora-bmc-wa-extension/.output/chrome-mv3" \
    "$HOME/Panelin calc loca/calculadora-bmc-wa-extension/.output/chrome-mv3"; do
    [[ -z "$c" ]] && continue
    if [[ -f "$c/manifest.json" ]]; then
      echo "$c"
      return 0
    fi
  done
  return 1
}

cmd_stop() {
  kill_profile_chrome || true
  rm -f "$PID_FILE"
  echo "Phone-2 Chrome stopped. Main always-on untouched."
}

cmd_status() {
  echo "Profile: $PROFILE"
  echo "CDP:     http://127.0.0.1:$CDP_PORT"
  if is_running; then
    echo "Status:  RUNNING"
  else
    echo "Status:  stopped"
  fi
  if curl -s "http://127.0.0.1:$CDP_PORT/json/list" >/dev/null 2>&1; then
    echo "Tabs:"
    curl -s "http://127.0.0.1:$CDP_PORT/json/list" | python3 -c '
import sys, json
for t in json.load(sys.stdin):
    if t.get("type") == "page":
        print(" ", (t.get("title") or "")[:50], "|", (t.get("url") or "")[:70])
' 2>/dev/null || true
  fi
}

cmd_start() {
  local wipe="${1:-0}"
  mkdir -p "$REPO/.runtime"

  if is_running >/dev/null 2>&1; then
    if [[ "$wipe" == "1" ]]; then
      cmd_stop
    else
      echo "Already running:"
      cmd_status
      # Focus WA tab if CDP up
      if curl -s "http://127.0.0.1:$CDP_PORT/json/list" >/dev/null 2>&1; then
        local id
        id="$(curl -s "http://127.0.0.1:$CDP_PORT/json/list" | python3 -c '
import sys, json
tabs = json.load(sys.stdin)
for t in tabs:
    if t.get("type")=="page" and "web.whatsapp.com" in (t.get("url") or ""):
        print(t["id"]); break
else:
    for t in tabs:
        if t.get("type")=="page":
            print(t["id"]); break
' 2>/dev/null || true)"
        [[ -n "$id" ]] && curl -s "http://127.0.0.1:$CDP_PORT/json/activate/$id" >/dev/null
      fi
      osascript -e 'tell application "Google Chrome" to activate' 2>/dev/null || true
      echo ""
      echo "Scan QR with the OTHER phone: WhatsApp → Linked devices → Link a device"
      return 0
    fi
  fi

  if [[ "$wipe" == "1" ]]; then
    if [[ -d "$PROFILE" ]]; then
      local bak="${PROFILE}.bak-$(date +%Y%m%d_%H%M%S)"
      mv "$PROFILE" "$bak"
      echo "Old profile moved to $bak"
    fi
  fi
  mkdir -p "$PROFILE"

  local chrome ext
  chrome="$(resolve_chrome)" || { echo "ERROR: Chrome not found" >&2; exit 1; }
  ext=""
  if ext="$(resolve_ext)"; then
    echo "Extension: $ext"
  else
    echo "WARN: no extension build — WA Web only (still fine for QR login)"
  fi

  # Clear stale locks
  rm -f "$PROFILE/SingletonLock" "$PROFILE/SingletonCookie" "$PROFILE/SingletonSocket" 2>/dev/null || true

  : >"$LOG_FILE"
  local args=(
    --user-data-dir="$PROFILE"
    --remote-debugging-port="$CDP_PORT"
    --no-first-run
    --no-default-browser-check
    --disable-features=DialMediaRouteProvider
    --disable-session-crashed-bubble
    --hide-crash-restore-bubble
    --new-window
  )
  [[ -n "$ext" ]] && args+=(--load-extension="$ext")

  echo "→ Starting phone-2 Chrome"
  echo "   Profile: $PROFILE"
  echo "   CDP:     $CDP_PORT"
  echo "   Log:     $LOG_FILE"
  # ONLY WhatsApp Web so QR is the first thing you see (no cockpit tab)
  nohup "$chrome" "${args[@]}" "$WA_URL" >>"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"

  local i
  for i in $(seq 1 15); do
    if curl -s "http://127.0.0.1:$CDP_PORT/json/version" >/dev/null 2>&1; then
      echo "  ✓ CDP up (${i}s) pid=$(cat "$PID_FILE")"
      break
    fi
    sleep 1
  done
  sleep 2

  # Activate first page
  local id
  id="$(curl -s "http://127.0.0.1:$CDP_PORT/json/list" 2>/dev/null | python3 -c '
import sys, json
try:
    tabs = json.load(sys.stdin)
except Exception:
    raise SystemExit
for t in tabs:
    if t.get("type") == "page":
        print(t["id"]); break
' 2>/dev/null || true)"
  if [[ -n "$id" ]]; then
    curl -s "http://127.0.0.1:$CDP_PORT/json/activate/$id" >/dev/null || true
  fi

  osascript -e 'tell application "Google Chrome" to activate' 2>/dev/null || true
  # Try to front the window titled WhatsApp
  osascript <<'OSA' 2>/dev/null || true
tell application "System Events"
  tell process "Google Chrome"
    set frontmost to true
    repeat with w in windows
      try
        if (name of w as text) contains "WhatsApp" then
          perform action "AXRaise" of w
          exit repeat
        end if
      end try
    end repeat
  end tell
end tell
OSA

  cmd_status
  cat <<EOF

════════════════════════════════════════════════════════
 PHONE 2 — link the OTHER phone

 1) Look for Chrome window: "WhatsApp" / web.whatsapp.com
 2) On that phone: WhatsApp → ⋮ or Settings
       → Linked devices → Link a device
 3) Scan the QR on THIS Mac window
 4) Leave the window open (minimize OK)

 Main BMC phone session is separate (always-on profile).
 Stop phone-2 only:  ./scripts/wa-chrome-phone2.sh stop
 Fresh QR again:     ./scripts/wa-chrome-phone2.sh reset
════════════════════════════════════════════════════════
EOF
}

case "${1:-start}" in
  start) cmd_start 0 ;;
  reset|fresh) cmd_start 1 ;;
  stop) cmd_stop ;;
  status|--status) cmd_status ;;
  -h|--help) sed -n '1,12p' "$0" ;;
  *) echo "Unknown: $1 (start|reset|stop|status)"; exit 1 ;;
esac
