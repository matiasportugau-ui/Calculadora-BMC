#!/usr/bin/env bash
# =============================================================================
# MCP Cache Manager (safe-by-default)
# -----------------------------------------------------------------------------
# Audit and prune cache used by chrome-devtools MCP and npx bootstrap cache.
#
# Safety:
# - Default mode is read-only (audit)
# - Destructive actions require --apply
# - Prune moves to Trash (never permanent delete)
# - Main profile "chrome-profile" is never pruned automatically
#
# Usage:
#   bash scripts/mcp-cache-manager.sh audit [--days N] [--json]
#   bash scripts/mcp-cache-manager.sh prune [--days N] [--apply] [--json]
# =============================================================================

set -euo pipefail

MODE="${1:-audit}"
shift || true

STALE_DAYS="${MCP_CACHE_STALE_DAYS:-7}"
APPLY=0
JSON=0
VERBOSE=0

MCP_ROOT="${MCP_CACHE_ROOT:-$HOME/.cache/chrome-devtools-mcp}"
NPX_CACHE_ROOT="${MCP_NPX_CACHE_ROOT:-$HOME/.npm/_npx}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --days)
      STALE_DAYS="${2:-7}"
      shift 2
      ;;
    --apply)
      APPLY=1
      shift
      ;;
    --json)
      JSON=1
      shift
      ;;
    --verbose)
      VERBOSE=1
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if ! [[ "$STALE_DAYS" =~ ^[0-9]+$ ]]; then
  echo "Invalid --days value: $STALE_DAYS" >&2
  exit 2
fi

now_epoch="$(date +%s)"

stat_mtime() {
  local p="$1"
  if stat -f %m "$p" >/dev/null 2>&1; then
    stat -f %m "$p"
  else
    stat -c %Y "$p"
  fi
}

dir_size_kb() {
  local p="$1"
  if [[ -d "$p" ]]; then
    du -sk "$p" 2>/dev/null | awk '{print $1}'
  else
    echo 0
  fi
}

bytes_from_kb() {
  local kb="${1:-0}"
  echo $((kb * 1024))
}

human_bytes() {
  local b="${1:-0}"
  if (( b >= 1073741824 )); then
    awk "BEGIN { printf \"%.2f GB\", $b/1073741824 }"
  elif (( b >= 1048576 )); then
    awk "BEGIN { printf \"%.2f MB\", $b/1048576 }"
  elif (( b >= 1024 )); then
    awk "BEGIN { printf \"%.2f KB\", $b/1024 }"
  else
    echo "${b} B"
  fi
}

# Bash 3.2 (macOS /usr/bin/bash): building arrays via eval inside a function leaves those
# arrays function-local, so prune --apply breaks under set -u. Scan at top level instead.
stale_mcp_dirs=()
total_mcp_bytes=0
stale_mcp_bytes=0
if [[ -d "$MCP_ROOT" ]]; then
  for d in "$MCP_ROOT"/chrome-profile*; do
    [[ -d "$d" ]] || continue
    base="$(basename "$d")"
    if [[ "$base" == "chrome-profile" ]]; then
      continue
    fi
    mtime="$(stat_mtime "$d")"
    age_days=$(( (now_epoch - mtime) / 86400 ))
    size_kb="$(dir_size_kb "$d")"
    size_b="$(bytes_from_kb "$size_kb")"
    total_mcp_bytes=$((total_mcp_bytes + size_b))
    if (( age_days >= STALE_DAYS )); then
      stale_mcp_bytes=$((stale_mcp_bytes + size_b))
      stale_mcp_dirs+=("$d")
    fi
  done
fi

stale_npx_dirs=()
total_npx_bytes=0
stale_npx_bytes=0
if [[ -d "$NPX_CACHE_ROOT" ]]; then
  for d in "$NPX_CACHE_ROOT"/*; do
    [[ -d "$d" ]] || continue
    base="$(basename "$d")"
    if [[ "$base" == "chrome-profile" ]]; then
      continue
    fi
    mtime="$(stat_mtime "$d")"
    age_days=$(( (now_epoch - mtime) / 86400 ))
    size_kb="$(dir_size_kb "$d")"
    size_b="$(bytes_from_kb "$size_kb")"
    total_npx_bytes=$((total_npx_bytes + size_b))
    if (( age_days >= STALE_DAYS )); then
      stale_npx_bytes=$((stale_npx_bytes + size_b))
      stale_npx_dirs+=("$d")
    fi
  done
fi

move_to_trash() {
  local src="$1"
  local bag="$2"
  [[ -e "$src" ]] || return 0
  mkdir -p "$bag"
  mv "$src" "$bag/" 2>/dev/null || true
}

emit_json() {
  local total_mcp="$1"
  local stale_mcp="$2"
  local total_npx="$3"
  local stale_npx="$4"
  local stale_count_mcp="$5"
  local stale_count_npx="$6"
  local applied="$7"
  cat <<EOF
{
  "mode": "$MODE",
  "stale_days": $STALE_DAYS,
  "mcp_root": "$MCP_ROOT",
  "npx_cache_root": "$NPX_CACHE_ROOT",
  "mcp_total_bytes": $total_mcp,
  "mcp_stale_bytes": $stale_mcp,
  "npx_total_bytes": $total_npx,
  "npx_stale_bytes": $stale_npx,
  "mcp_stale_count": $stale_count_mcp,
  "npx_stale_count": $stale_count_npx,
  "apply": $applied
}
EOF
}

stale_count_mcp="${#stale_mcp_dirs[@]}"
stale_count_npx="${#stale_npx_dirs[@]}"

if [[ "$MODE" == "audit" ]]; then
  if (( JSON == 1 )); then
    emit_json "$total_mcp_bytes" "$stale_mcp_bytes" "$total_npx_bytes" "$stale_npx_bytes" "$stale_count_mcp" "$stale_count_npx" 0
    exit 0
  fi

  echo "=== MCP Cache Audit ==="
  echo "MCP root: $MCP_ROOT"
  echo "NPX cache root: $NPX_CACHE_ROOT"
  echo "Stale threshold: ${STALE_DAYS} days"
  echo
  echo "chrome-devtools-mcp (isolated profiles pattern: chrome-profile*):"
  echo "  total (without main profile): $(human_bytes "$total_mcp_bytes")"
  echo "  stale candidate:             $(human_bytes "$stale_mcp_bytes") ($stale_count_mcp dirs)"
  echo
  echo "npx cache (_npx):"
  echo "  total:                       $(human_bytes "$total_npx_bytes")"
  echo "  stale candidate:             $(human_bytes "$stale_npx_bytes") ($stale_count_npx dirs)"
  echo
  echo "Run prune safely:"
  echo "  npm run mcp:cache:prune"
  echo "Apply prune (move to Trash):"
  echo "  npm run mcp:cache:prune:apply"
  exit 0
fi

if [[ "$MODE" != "prune" ]]; then
  echo "Invalid mode: $MODE (use: audit | prune)" >&2
  exit 2
fi

if (( APPLY != 1 )); then
  if (( JSON == 1 )); then
    emit_json "$total_mcp_bytes" "$stale_mcp_bytes" "$total_npx_bytes" "$stale_npx_bytes" "$stale_count_mcp" "$stale_count_npx" 0
    exit 0
  fi
  echo "=== MCP Cache Prune (dry-run) ==="
  echo "Nothing deleted. Use --apply to move stale cache directories to Trash."
  echo "Would reclaim approximately: $(human_bytes $((stale_mcp_bytes + stale_npx_bytes)))"
  exit 0
fi

trash_bag="$HOME/.Trash/McpCachePrune-$(date +%Y%m%d-%H%M%S)"

# Bash 3.2 + set -u: "${arr[@]}" in for is an error when arr is empty; guard on length.
if (( ${#stale_mcp_dirs[@]} > 0 )); then
  for d in "${stale_mcp_dirs[@]}"; do
    (( VERBOSE == 1 )) && echo "Prune MCP: $d"
    move_to_trash "$d" "$trash_bag"
  done
fi

if (( ${#stale_npx_dirs[@]} > 0 )); then
  for d in "${stale_npx_dirs[@]}"; do
    (( VERBOSE == 1 )) && echo "Prune NPX: $d"
    move_to_trash "$d" "$trash_bag"
  done
fi

if (( JSON == 1 )); then
  emit_json "$total_mcp_bytes" "$stale_mcp_bytes" "$total_npx_bytes" "$stale_npx_bytes" "$stale_count_mcp" "$stale_count_npx" 1
  exit 0
fi

echo "=== MCP Cache Prune Applied ==="
echo "Moved to Trash bag: $trash_bag"
echo "Estimated reclaimed (before empty Trash): $(human_bytes $((stale_mcp_bytes + stale_npx_bytes)))"
