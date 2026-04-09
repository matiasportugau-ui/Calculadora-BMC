#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TZ_NAME="${TZ_NAME:-America/Montevideo}"
OUT_DIR="${OUT_DIR:-$HOME/.cache/bmc-magazine-daily}"
STATE_FILE="${STATE_FILE:-$OUT_DIR/schedule-state.log}"
RUN_HOUR_LOCAL="${RUN_HOUR_LOCAL:-8}"

mkdir -p "$OUT_DIR"
touch "$STATE_FILE"

export TZ="$TZ_NAME"
today_key="$(date +%Y-%m-%d)"
current_hour=$((10#$(date +%H)))
target_hour=$((10#${RUN_HOUR_LOCAL}))
log_file="$OUT_DIR/scheduler-$(date +%Y%m%d).log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $*" | tee -a "$log_file" >/dev/null
}

already_ran_today() {
  grep -Fxq "$today_key" "$STATE_FILE" 2>/dev/null
}

mark_ran_today() {
  echo "$today_key" >> "$STATE_FILE"
  tail -n 100 "$STATE_FILE" > "${STATE_FILE}.tmp" 2>/dev/null || true
  mv "${STATE_FILE}.tmp" "$STATE_FILE" 2>/dev/null || true
}

if [[ "$current_hour" -ne "$target_hour" ]]; then
  log "Skip: hora actual ${current_hour}, objetivo ${target_hour}"
  exit 0
fi

if already_ran_today; then
  log "Skip: ya ejecutado para ${today_key}"
  exit 0
fi

log "Ejecutando magazine:daily --send"
cd "$REPO_ROOT"
node "$REPO_ROOT/scripts/magazine-daily-digest.mjs" --send >>"$log_file" 2>&1
mark_ran_today
log "Completado magazine:daily"
