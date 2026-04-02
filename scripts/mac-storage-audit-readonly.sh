#!/usr/bin/env bash
# Read-only storage / system snapshot for macOS performance triage.
# Does not delete or modify anything. Safe to run anytime.
# See: .cursor/skills/mac-performance-optimizer/PLAN-EJECUCION.md

set -euo pipefail

echo "=== mac-storage-audit-readonly ($(date -Iseconds)) ==="
echo

echo "--- System ---"
sw_vers 2>/dev/null || true
echo

echo "--- Memory ---"
if sysctl -n hw.memsize &>/dev/null; then
  bytes=$(sysctl -n hw.memsize)
  gb=$(awk -v b="$bytes" 'BEGIN { printf "%.1f", b/1024^3 }')
  echo "RAM: ~${gb} GiB"
fi
echo

echo "--- Startup volume (df) ---"
df -h / 2>/dev/null || df -h /
echo

echo "--- diskutil (summary) ---"
diskutil info / 2>/dev/null | grep -E 'Volume Name|File System|Volume Free Space|Container Total|This disk|APFS' || true
echo

echo "--- Top of home (du -sh; may take a bit) ---"
HOME_DIR="${HOME:-/tmp}"
for d in Desktop Documents Downloads Library Movies Music Pictures; do
  p="$HOME_DIR/$d"
  if [[ -d "$p" ]]; then
    du -sh "$p" 2>/dev/null || true
  fi
done
echo

echo "--- Common heavy subtrees (user) ---"
for p in \
  "$HOME_DIR/Library/Caches" \
  "$HOME_DIR/Library/Logs" \
  "$HOME_DIR/Library/Developer/Xcode/DerivedData" \
  "$HOME_DIR/Library/Containers/com.docker.docker"; do
  if [[ -d "$p" ]]; then
    du -sh "$p" 2>/dev/null || true
  fi
done
echo

if command -v docker &>/dev/null; then
  echo "--- Docker ---"
  docker system df 2>/dev/null || echo "(docker not reachable or not running)"
  echo
fi

echo "--- Done (read-only) ---"
