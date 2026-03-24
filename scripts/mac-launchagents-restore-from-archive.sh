#!/usr/bin/env bash
# =============================================================================
# Restore LaunchAgents moved by mac-launchagents-unload-blocklist.sh (ARCHIVE=1).
# Host-only helper — not part of BMC app runtime.
#
# Usage (same paths/env que el unload):
#   chmod +x scripts/mac-launchagents-restore-from-archive.sh
#
#   # Restaurar solo los .plist listados en el mismo blocklist que usaste al archivar:
#   DRY_RUN=1 ./scripts/mac-launchagents-restore-from-archive.sh ~/mac-launchagents-blocklist.txt
#   ./scripts/mac-launchagents-restore-from-archive.sh ~/mac-launchagents-blocklist.txt
#
#   # Restaurar TODO lo que esté en ~/Library/LaunchAgents-disabled/ (*.plist)
#   DRY_RUN=1 ./scripts/mac-launchagents-restore-from-archive.sh --all
#   ./scripts/mac-launchagents-restore-from-archive.sh --all
#
# Env:
#   DRY_RUN=1       — print actions only
#   LA              — LaunchAgents directory (default ~/Library/LaunchAgents)
#   ARCHIVE_DIR     — carpeta donde quedaron los plist (default ~/Library/LaunchAgents-disabled)
# =============================================================================

set -euo pipefail

DRY_RUN="${DRY_RUN:-0}"
LA="${LA:-$HOME/Library/LaunchAgents}"
ARCHIVE_DIR="${ARCHIVE_DIR:-$HOME/Library/LaunchAgents-disabled}"
UID_STR="$(id -u)"
GUI_DOMAIN="gui/$UID_STR"

usage() {
  echo "Usage:"
  echo "  $0 <blocklist.txt>     — restore each basename listed (non-comment lines)"
  echo "  $0 --all               — restore every *.plist in ARCHIVE_DIR"
  echo ""
  echo "Environment:"
  echo "  DRY_RUN=1              Show actions only"
  echo "  LA=$LA"
  echo "  ARCHIVE_DIR=$ARCHIVE_DIR"
  exit 1
}

[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && usage

MODE="list"
LIST_FILE=""
if [[ "${1:-}" == "--all" ]]; then
  MODE="all"
elif [[ -n "${1:-}" && -f "$1" ]]; then
  LIST_FILE="$1"
else
  usage
fi

restore_one() {
  local base="$1"
  local archived="$ARCHIVE_DIR/$base"
  local target="$LA/$base"

  if [[ ! -f "$archived" ]]; then
    echo "SKIP (not in archive): $archived"
    return 0
  fi

  if [[ -f "$target" ]]; then
    echo "SKIP (already in LaunchAgents, not overwriting): $target"
    return 0
  fi

  local label
  label=$(/usr/libexec/PlistBuddy -c 'Print :Label' "$archived" 2>/dev/null || true)

  echo "— $base${label:+ (Label: $label)}"

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "  [DRY_RUN] mv $archived $target"
    if [[ -n "$label" ]]; then
      echo "  [DRY_RUN] launchctl bootstrap $GUI_DOMAIN $target"
      echo "  [DRY_RUN] (fallback) launchctl load $target"
    else
      echo "  [DRY_RUN] (no Label in plist — solo mv; cargá a mano si hace falta)"
    fi
    return 0
  fi

  mkdir -p "$LA"
  mv "$archived" "$target"

  if [[ -z "$label" ]]; then
    echo "  restored (no Label) -> $target"
    return 0
  fi

  # Por si quedó estado viejo en launchd
  launchctl bootout "$GUI_DOMAIN/$label" 2>/dev/null || true

  if launchctl bootstrap "$GUI_DOMAIN" "$target" 2>/dev/null; then
    echo "  loaded: launchctl bootstrap $GUI_DOMAIN $target"
  elif launchctl load "$target" 2>/dev/null; then
    echo "  loaded: launchctl load $target"
  else
    echo "  WARN: plist restaurado en $target pero load/bootstrap falló. Probá:"
    echo "        launchctl bootstrap $GUI_DOMAIN $target"
    return 0
  fi
}

echo "LaunchAgents restore — LA=$LA ARCHIVE_DIR=$ARCHIVE_DIR"
[[ "$DRY_RUN" == "1" ]] && echo "DRY_RUN=1 (no changes)"
echo ""

if [[ "$MODE" == "all" ]]; then
  if [[ ! -d "$ARCHIVE_DIR" ]]; then
    echo "Nothing to do: ARCHIVE_DIR does not exist: $ARCHIVE_DIR"
    exit 0
  fi
  shopt -s nullglob
  files=("$ARCHIVE_DIR"/*.plist)
  shopt -u nullglob
  if [[ ${#files[@]} -eq 0 ]]; then
    echo "No *.plist files in $ARCHIVE_DIR"
    exit 0
  fi
  for f in "${files[@]}"; do
    restore_one "$(basename "$f")"
  done
else
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^# ]] && continue
    base="$line"
    [[ "$base" != *.plist ]] && base="${base}.plist"
    restore_one "$base"
  done <"$LIST_FILE"
fi

echo ""
echo "Done. Si algo no arranca, revisá Login Items o reinstalá la app que registra el job."
