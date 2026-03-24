#!/usr/bin/env bash
# =============================================================================
# Drive Cleanup — Automated (hourly via launchd)
# =============================================================================
# 1. Generates report of what would be cleaned
# 2. Shows macOS dialog asking for approval
# 3. If approved: runs cleanup. If cancelled or timeout: skips.
# Based on .cursor/skills/drive-space-optimizer/SKILL.md
# =============================================================================

set -euo pipefail

LOG_DIR="${LOG_DIR:-$HOME/.cache/drive-cleanup}"
LOG_FILE="$LOG_DIR/cleanup-$(date +%Y%m%d).log"
REPORT_FILE="$LOG_DIR/pending-report-$(date +%Y%m%d-%H%M%S).txt"
THRESHOLD_GB="${THRESHOLD_GB:-5}"   # Only run dialog if free space < this (0 = always)
DIALOG_TIMEOUT="${DIALOG_TIMEOUT:-120}"  # Seconds to wait for approval (0 = no timeout)
DRY_RUN="${DRY_RUN:-0}"
SKIP_APPROVAL="${SKIP_APPROVAL:-0}"  # Set to 1 to run without dialog (e.g. manual non-interactive)
USE_TRASH="${USE_TRASH:-1}"         # 1 = move to Trash (review/empty manually); 0 = delete permanently

mkdir -p "$LOG_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# -----------------------------------------------------------------------------
# 1. Check disk space
# -----------------------------------------------------------------------------
get_free_gb() {
  df -g / 2>/dev/null | awk 'NR==2 {print $4}' || df / 2>/dev/null | awk 'NR==2 {print int($4/1024/1024)}'
}

free_before=$(get_free_gb 2>/dev/null || echo "0")
log "=== Drive cleanup run ==="
log "Free space: ${free_before} GB | Threshold: ${THRESHOLD_GB} GB"

# Skip if already enough space (unless THRESHOLD_GB=0)
if [[ "$THRESHOLD_GB" != "0" ]] && [[ "${free_before:-0}" -ge "$THRESHOLD_GB" ]]; then
  log "Free space OK (>= ${THRESHOLD_GB} GB). No approval needed."
  exit 0
fi

# -----------------------------------------------------------------------------
# 2. Build report (what would be cleaned)
# -----------------------------------------------------------------------------
CACHE_DIRS=(
  "$HOME/Library/Caches/com.openai.atlas:OpenAI Atlas"
  "$HOME/Library/Caches/Google:Google"
  "$HOME/Library/Caches/SiriTTS:Siri TTS"
  "$HOME/Library/Caches/node-gyp:node-gyp"
  "$HOME/Library/Caches/Homebrew:Homebrew"
  "$HOME/Library/Caches/ms-playwright-go:Playwright"
  "$HOME/Library/Caches/pip:pip"
)

report_lines=()
total_bytes=0

for entry in "${CACHE_DIRS[@]}"; do
  dir="${entry%%:*}"
  name="${entry##*:}"
  if [[ -d "$dir" ]]; then
    size_str=$(du -sh "$dir" 2>/dev/null | awk '{print $1}' || echo "0B")
    # macOS du -s uses 512-byte blocks
    size_blocks=$(du -s "$dir" 2>/dev/null | awk '{print $1}' || echo 0)
    size_bytes=$((size_blocks * 512))
    total_bytes=$((total_bytes + size_bytes))
    report_lines+=("$name: $size_str")
  fi
done

# npm/pnpm
if command -v npm &>/dev/null; then
  npm_size=$(npm cache verify 2>/dev/null | tail -1 || true)
  # npm doesn't easily give size; assume non-zero if cache exists
  if [[ -d "$HOME/.npm" ]] || [[ -d "${npm_config_cache:-$HOME/.npm/_cacache}" ]]; then
    report_lines+=("npm cache: (metadata)")
  fi
fi
if command -v pnpm &>/dev/null; then
  report_lines+=("pnpm store: (metadata)")
fi

# Build human-readable total
total_mb=$((total_bytes / 1024 / 1024))
if [[ $total_mb -ge 1024 ]]; then
  total_human="$((total_mb / 1024)) GB"
else
  total_human="${total_mb} MB"
fi

report_body=$(printf '%s\n' "${report_lines[@]}")
{
  echo "=== Drive Cleanup Report — $(date '+%Y-%m-%d %H:%M') ==="
  echo ""
  echo "Espacio libre actual: ${free_before} GB"
  echo "Estimado a recuperar: ~${total_human}"
  echo ""
  echo "Se limpiarían (caches regenerables):"
  echo "$report_body"
  echo ""
  if [[ "${USE_TRASH:-1}" == "1" ]]; then
    echo "Los archivos se moverán a la PAPELERA (podés revisar y vaciar manualmente)."
  else
    echo "Los archivos se ELIMINARÁN permanentemente (USE_TRASH=0)."
  fi
  echo ""
  echo "No se toca: proyecto, node_modules, .env, documentos."
} > "$REPORT_FILE"
log "Report saved: $REPORT_FILE"

# If nothing to clean, exit early
if [[ ${#report_lines[@]} -eq 0 ]] || [[ $total_bytes -lt 1048576 ]]; then
  log "Nothing substantial to clean. Skipping."
  exit 0
fi

# -----------------------------------------------------------------------------
# 3. Ask for approval (unless SKIP_APPROVAL or DRY_RUN)
# -----------------------------------------------------------------------------
approved=0
if [[ "$DRY_RUN" == "1" ]]; then
  log "[DRY-RUN] Would show approval dialog. Report: $REPORT_FILE"
  exit 0
fi

if [[ "$SKIP_APPROVAL" == "1" ]]; then
  approved=1
  log "SKIP_APPROVAL=1: running without dialog"
else
  # Build dialog message (keep short to avoid AppleScript escaping issues)
  msg="Drive Cleanup

Espacio libre: ${free_before} GB
Recuperar aprox: ${total_human}

Reporte: $REPORT_FILE

Caches: $(IFS=,; echo "${report_lines[*]}")

¿Aprobar limpieza?"
  msg_escaped=$(printf '%s' "$msg" | sed 's/"/\\"/g' | tr '\n' ' ' | sed 's/  */ /g')

  if [[ "$DIALOG_TIMEOUT" == "0" ]]; then
    result=$(osascript -e "button returned of (display dialog \"$msg_escaped\" buttons {\"Cancelar\", \"Aprobar\"} default button 2 with title \"Drive Cleanup\")" 2>/dev/null || echo "Cancel")
  else
    result=$(osascript <<APPLESCRIPT 2>/dev/null || echo "Cancel"
try
  set d to display dialog "$msg_escaped" buttons {"Cancelar", "Aprobar"} default button 2 with title "Drive Cleanup" giving up after $DIALOG_TIMEOUT
  return button returned of d
on error number -1719
  return "Cancel"
end try
APPLESCRIPT
)
  fi

  if [[ "$result" == "Aprobar" ]]; then
    approved=1
    log "User approved cleanup"
  else
    log "User cancelled or timeout. Skipping."
    exit 0
  fi
fi

# -----------------------------------------------------------------------------
# 4. Execute cleanup
# -----------------------------------------------------------------------------
[[ $approved -eq 1 ]] || exit 0

cleaned=0
TRASH_BAG=""
if [[ "$USE_TRASH" == "1" ]]; then
  TRASH_BAG="$HOME/.Trash/DriveCleanup-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$TRASH_BAG"
  log "Moving caches to Trash: $TRASH_BAG"
fi

clean_cache_dir() {
  local dir="$1"
  local name="$2"
  if [[ -d "$dir" ]]; then
    local size
    size=$(du -sh "$dir" 2>/dev/null | awk '{print $1}' || echo "?")
    if [[ "$USE_TRASH" == "1" ]] && [[ -n "$TRASH_BAG" ]]; then
      local dest="$TRASH_BAG/${name// /_}"
      mkdir -p "$dest"
      for item in "${dir}"/*; do
        [[ -e "$item" ]] && mv "$item" "$dest/" 2>/dev/null || true
      done
    else
      rm -rf "${dir:?}"/* 2>/dev/null || true
    fi
    log "Cleaned $name: $size"
    cleaned=1
  fi
}

for entry in "${CACHE_DIRS[@]}"; do
  dir="${entry%%:*}"
  name="${entry##*:}"
  clean_cache_dir "$dir" "$name"
done

npm cache clean --force 2>/dev/null && log "Cleaned npm cache" && cleaned=1 || true
pnpm store prune 2>/dev/null && log "Cleaned pnpm store" && cleaned=1 || true

free_after=$(get_free_gb 2>/dev/null || echo "?")
log "Free space after: ${free_after} GB"
if [[ "$USE_TRASH" == "1" ]] && [[ -d "${TRASH_BAG:-}" ]]; then
  log "Caches moved to Trash: $TRASH_BAG — vaciá la Papelera cuando quieras liberar el espacio."
fi
log "---"
