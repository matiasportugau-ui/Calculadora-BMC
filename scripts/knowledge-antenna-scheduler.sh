#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TZ_NAME="${TZ_NAME:-America/Montevideo}"
OUT_DIR="${OUT_DIR:-$HOME/.cache/bmc-knowledge-antenna}"
STATE_FILE="${STATE_FILE:-$OUT_DIR/schedule-state.log}"
RUN_HOUR_UTC="${RUN_HOUR_UTC:-10}"

mkdir -p "$OUT_DIR"
touch "$STATE_FILE"

export TZ="$TZ_NAME"
today_key="$(date +%Y-%m-%d)"
current_hour="$(date +%H)"
log_file="$OUT_DIR/scheduler-$(date +%Y%m%d).log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $*" | tee -a "$log_file" >/dev/null
}

already_ran_today() {
  rg -n "^${today_key}$" "$STATE_FILE" >/dev/null 2>&1
}

mark_ran_today() {
  echo "$today_key" >> "$STATE_FILE"
  local tmp="${STATE_FILE}.tmp"
  tail -n 100 "$STATE_FILE" > "$tmp" 2>/dev/null || true
  mv "$tmp" "$STATE_FILE" 2>/dev/null || true
}

if [[ "$current_hour" != "$RUN_HOUR_UTC" ]]; then
  log "Skip: current hour ${current_hour}, target hour ${RUN_HOUR_UTC}"
  exit 0
fi

if already_ran_today; then
  log "Skip: already executed for ${today_key}"
  exit 0
fi

log "Running knowledge antenna full pipeline"
node "$REPO_ROOT/scripts/knowledge-antenna-run.mjs" >> "$log_file" 2>&1
mark_ran_today
log "Completed knowledge antenna pipeline"
