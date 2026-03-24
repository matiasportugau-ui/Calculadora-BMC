#!/usr/bin/env bash
# =============================================================================
# Unload (and optionally archive) LaunchAgents listed in a blocklist file.
# Host-only helper — not part of BMC app runtime.
#
# Usage:
#   chmod +x scripts/mac-launchagents-unload-blocklist.sh
#   cp scripts/mac-launchagents-blocklist.example.txt ~/mac-launchagents-blocklist.txt
#   # Edit ~/mac-launchagents-blocklist.txt — uncomment lines you want to unload
#   DRY_RUN=1 ./scripts/mac-launchagents-unload-blocklist.sh ~/mac-launchagents-blocklist.txt
#   ARCHIVE=1 ./scripts/mac-launchagents-unload-blocklist.sh ~/mac-launchagents-blocklist.txt
#
# Env:
#   DRY_RUN=1     — print actions only
#   ARCHIVE=1     — after unload, move plist to ARCHIVE_DIR (default ~/Library/LaunchAgents-disabled)
#   LA            — LaunchAgents directory (default ~/Library/LaunchAgents)
#   ARCHIVE_DIR   — where to move plists when ARCHIVE=1
#
# Revert / restore: scripts/mac-launchagents-restore-from-archive.sh (same LA / ARCHIVE_DIR).
# =============================================================================

set -euo pipefail

DRY_RUN="${DRY_RUN:-0}"
ARCHIVE="${ARCHIVE:-0}"
LA="${LA:-$HOME/Library/LaunchAgents}"
ARCHIVE_DIR="${ARCHIVE_DIR:-$HOME/Library/LaunchAgents-disabled}"
UID_STR="$(id -u)"
GUI_DOMAIN="gui/$UID_STR"

usage() {
  echo "Usage: $0 <blocklist.txt>"
  echo ""
  echo "blocklist.txt: one plist basename per line (e.g. com.example.job.plist)."
  echo "               Lines starting with # and empty lines are ignored."
  echo ""
  echo "Environment:"
  echo "  DRY_RUN=1      Show what would happen (no bootout/unload/mv)"
  echo "  ARCHIVE=1      Move plist to ARCHIVE_DIR after unload ($ARCHIVE_DIR)"
  echo "  LA=path        LaunchAgents folder (default: ~/Library/LaunchAgents)"
  exit 1
}

[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && usage
[[ -n "${1:-}" && -f "$1" ]] || usage

LIST_FILE="$1"

unload_one() {
  local base="$1"
  local plist_path="$LA/$base"

  if [[ ! -f "$plist_path" ]]; then
    echo "SKIP (file missing): $plist_path"
    return 0
  fi

  local label
  label=$(/usr/libexec/PlistBuddy -c 'Print :Label' "$plist_path" 2>/dev/null || true)
  if [[ -z "$label" ]]; then
    echo "SKIP (no Label key, may be empty plist): $plist_path"
    if [[ "$ARCHIVE" == "1" && "$DRY_RUN" != "1" ]]; then
      mkdir -p "$ARCHIVE_DIR"
      mv "$plist_path" "$ARCHIVE_DIR/"
      echo "  archived (no Label) -> $ARCHIVE_DIR/$base"
    elif [[ "$DRY_RUN" == "1" && "$ARCHIVE" == "1" ]]; then
      echo "  [DRY_RUN] would archive empty plist -> $ARCHIVE_DIR/$base"
    fi
    return 0
  fi

  echo "— $base (Label: $label)"

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "  [DRY_RUN] launchctl bootout $GUI_DOMAIN/$label"
    echo "  [DRY_RUN] launchctl unload $plist_path"
    if [[ "$ARCHIVE" == "1" ]]; then
      echo "  [DRY_RUN] mv $plist_path $ARCHIVE_DIR/"
    fi
    return 0
  fi

  launchctl bootout "$GUI_DOMAIN/$label" 2>/dev/null || true
  launchctl unload "$plist_path" 2>/dev/null || true

  if [[ "$ARCHIVE" == "1" ]]; then
    mkdir -p "$ARCHIVE_DIR"
    if [[ -f "$plist_path" ]]; then
      mv "$plist_path" "$ARCHIVE_DIR/"
      echo "  archived -> $ARCHIVE_DIR/$base"
    fi
  fi
}

echo "LaunchAgents unload — LA=$LA"
[[ "$DRY_RUN" == "1" ]] && echo "DRY_RUN=1 (no changes)"
[[ "$ARCHIVE" == "1" ]] && echo "ARCHIVE=1 -> $ARCHIVE_DIR"
echo ""

while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  [[ -z "$line" ]] && continue
  [[ "$line" =~ ^# ]] && continue
  base="$line"
  [[ "$base" != *.plist ]] && base="${base}.plist"
  unload_one "$base"
done <"$LIST_FILE"

echo ""
echo "Done. If something still loads at login, check System Settings → General → Login Items,"
echo "or apps that reinstall their plists."
