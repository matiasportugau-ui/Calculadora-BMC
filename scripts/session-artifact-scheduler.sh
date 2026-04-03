#!/usr/bin/env bash
# =============================================================================
# Session Artifact Scheduler (launchd target)
# -----------------------------------------------------------------------------
# Runs lifecycle pack at Montevideo schedule:
#   - 00:00
#   - 09:00
#   - 17:00
# with catch-up window of +1h if machine was asleep/offline.
#
# This script is safe:
# - archives only (no prune by default)
# - deduplicates each slot execution via state file
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TZ_NAME="${TZ_NAME:-America/Montevideo}"
OUT_DIR="${OUT_DIR:-$HOME/.cache/bmc-session-archive/scheduler}"
STATE_FILE="${STATE_FILE:-$HOME/.cache/bmc-session-archive/index/schedule-state.log}"
APPLY_PRUNE="${APPLY_PRUNE:-0}" # keep 0 by default (safer)

mkdir -p "$OUT_DIR"
mkdir -p "$(dirname "$STATE_FILE")"

LOG_FILE="$OUT_DIR/scheduler-$(date +%Y%m%d).log"
export TZ="$TZ_NAME"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $*" | tee -a "$LOG_FILE" >/dev/null
}

date_for_offset() {
  local offset="$1"
  local fmt="$2"
  if [[ "$offset" == "0" ]]; then
    date +"$fmt"
  elif [[ "$offset" =~ ^-?[0-9]+$ ]]; then
    # BSD date on macOS
    date -v"${offset}"H +"$fmt"
  else
    date +"$fmt"
  fi
}

is_target_hour() {
  local h="$1"
  [[ "$h" == "00" || "$h" == "09" || "$h" == "17" ]]
}

slot_key_for_offset() {
  local offset="$1"
  date_for_offset "$offset" "%Y-%m-%d-%H"
}

slot_hour_for_offset() {
  local offset="$1"
  date_for_offset "$offset" "%H"
}

has_run_slot() {
  local key="$1"
  [[ -f "$STATE_FILE" ]] && rg -n "^${key}$" "$STATE_FILE" >/dev/null 2>&1
}

mark_run_slot() {
  local key="$1"
  echo "$key" >> "$STATE_FILE"
  # keep state bounded
  local tmp="${STATE_FILE}.tmp"
  tail -n 800 "$STATE_FILE" > "$tmp" 2>/dev/null || true
  mv "$tmp" "$STATE_FILE" 2>/dev/null || true
}

run_lifecycle_for_slot() {
  local slot_key="$1"
  local reason="$2"
  log "Running session lifecycle for slot ${slot_key} (${reason})"
  if [[ "$APPLY_PRUNE" == "1" ]]; then
    /bin/bash "$REPO_ROOT/scripts/session-artifact-lifecycle.sh" run --apply-prune >> "$LOG_FILE" 2>&1
  else
    /bin/bash "$REPO_ROOT/scripts/session-artifact-lifecycle.sh" run >> "$LOG_FILE" 2>&1
  fi
  mark_run_slot "$slot_key"
  log "Completed slot ${slot_key}"
}

log "Scheduler tick started"

# Priority: run current target slot; otherwise catch-up previous target slot (+1h window)
current_hour="$(slot_hour_for_offset 0)"
current_key="$(slot_key_for_offset 0)"

if is_target_hour "$current_hour"; then
  if has_run_slot "$current_key"; then
    log "Skip current slot ${current_key}: already executed"
    exit 0
  fi
  run_lifecycle_for_slot "$current_key" "exact target hour"
  exit 0
fi

prev_hour="$(slot_hour_for_offset -1)"
prev_key="$(slot_key_for_offset -1)"
if is_target_hour "$prev_hour"; then
  if has_run_slot "$prev_key"; then
    log "Skip catch-up slot ${prev_key}: already executed"
    exit 0
  fi
  run_lifecycle_for_slot "$prev_key" "catch-up (+1h)"
  exit 0
fi

log "No target slot for this tick (hour=${current_hour}); nothing to run"
