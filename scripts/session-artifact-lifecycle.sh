#!/usr/bin/env bash
# =============================================================================
# Session Artifact Lifecycle Manager
# -----------------------------------------------------------------------------
# Professional retention flow for heavy session artifacts:
# - Hot storage: source dirs (active work)
# - Warm storage: compressed bundles in local archive cache
# - Cold storage: external archive (default iCloud)
#
# Safety principles:
# - Default is dry-run (no moves/deletes)
# - Prune requires --apply-prune and moves to Trash (never rm -rf)
# - Only archives artifacts older than PACK_DAYS
# - Skips non-existing paths automatically
#
# Usage:
#   bash scripts/session-artifact-lifecycle.sh audit
#   bash scripts/session-artifact-lifecycle.sh run
#   bash scripts/session-artifact-lifecycle.sh run --apply-prune
#
# Optional flags:
#   --pack-days N       (default 3)
#   --prune-days N      (default 14)
#   --local-archive DIR (default ~/.cache/bmc-session-archive)
#   --remote-archive DIR(default ~/Library/Mobile Documents/com~apple~CloudDocs/BMC-Session-Archive)
#   --json              (machine-readable summary)
# =============================================================================

set -euo pipefail

MODE="${1:-audit}"
shift || true

PACK_DAYS="${BMC_SESSION_PACK_DAYS:-3}"
PRUNE_DAYS="${BMC_SESSION_PRUNE_DAYS:-14}"
LOCAL_ARCHIVE="${BMC_SESSION_LOCAL_ARCHIVE:-$HOME/.cache/bmc-session-archive}"
REMOTE_ARCHIVE="${BMC_SESSION_REMOTE_ARCHIVE:-$HOME/Library/Mobile Documents/com~apple~CloudDocs/BMC-Session-Archive}"
APPLY_PRUNE=0
JSON=0
VERBOSE=0

# Source roots (space-separated via env allowed)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_SOURCES=(
  "$REPO_ROOT/docs/team/ux-feedback/sessions"
  "$HOME/.cursor/browser-logs"
)

if [[ -n "${BMC_SESSION_ARTIFACT_SOURCES:-}" ]]; then
  # shellcheck disable=SC2206
  SOURCES=(${BMC_SESSION_ARTIFACT_SOURCES})
else
  SOURCES=("${DEFAULT_SOURCES[@]}")
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pack-days)
      PACK_DAYS="${2:-3}"
      shift 2
      ;;
    --prune-days)
      PRUNE_DAYS="${2:-14}"
      shift 2
      ;;
    --local-archive)
      LOCAL_ARCHIVE="${2:-$LOCAL_ARCHIVE}"
      shift 2
      ;;
    --remote-archive)
      REMOTE_ARCHIVE="${2:-$REMOTE_ARCHIVE}"
      shift 2
      ;;
    --apply-prune)
      APPLY_PRUNE=1
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

if [[ "$MODE" != "audit" && "$MODE" != "run" ]]; then
  echo "Invalid mode: $MODE (use: audit | run)" >&2
  exit 2
fi
if ! [[ "$PACK_DAYS" =~ ^[0-9]+$ && "$PRUNE_DAYS" =~ ^[0-9]+$ ]]; then
  echo "--pack-days and --prune-days must be integers" >&2
  exit 2
fi

mkdir -p "$LOCAL_ARCHIVE"
mkdir -p "$REMOTE_ARCHIVE"
mkdir -p "$LOCAL_ARCHIVE/index"

INDEX_CSV="$LOCAL_ARCHIVE/index/archive-index.csv"
LOG_FILE="$LOCAL_ARCHIVE/index/lifecycle-$(date +%Y%m%d).log"

log() {
  local msg="$*"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $msg" | tee -a "$LOG_FILE" >/dev/null
  if (( VERBOSE == 1 )); then
    echo "$msg"
  fi
}

stat_mtime() {
  local p="$1"
  if stat -f %m "$p" >/dev/null 2>&1; then
    stat -f %m "$p"
  else
    stat -c %Y "$p"
  fi
}

bytes_for_path() {
  local p="$1"
  if [[ -d "$p" ]]; then
    du -sk "$p" 2>/dev/null | awk '{print $1 * 1024}'
  elif [[ -f "$p" ]]; then
    wc -c < "$p" 2>/dev/null | tr -d ' '
  else
    echo 0
  fi
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

sha256_file() {
  local f="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$f" | awk '{print $1}'
  else
    sha256sum "$f" | awk '{print $1}'
  fi
}

safe_slug() {
  local v="$1"
  printf "%s" "$v" | sed 's/[^a-zA-Z0-9._-]/_/g'
}

candidate_paths=()
candidate_sizes=()
candidate_src_roots=()
candidate_count=0
candidate_total_bytes=0
now_epoch="$(date +%s)"

for root in "${SOURCES[@]}"; do
  [[ -d "$root" ]] || continue
  shopt -s nullglob dotglob
  for p in "$root"/*; do
    [[ -e "$p" ]] || continue
    base="$(basename "$p")"
    # Skip hidden system entries and index dir
    [[ "$base" == "." || "$base" == ".." ]] && continue
    mtime="$(stat_mtime "$p")"
    age_days=$(( (now_epoch - mtime) / 86400 ))
    (( age_days < PACK_DAYS )) && continue
    size_b="$(bytes_for_path "$p")"
    candidate_paths+=("$p")
    candidate_sizes+=("$size_b")
    candidate_src_roots+=("$root")
    candidate_count=$((candidate_count + 1))
    candidate_total_bytes=$((candidate_total_bytes + size_b))
  done
  shopt -u nullglob dotglob
done

pack_count=0
packed_bytes=0
copied_count=0
pruned_count=0
pruned_bytes=0

if [[ "$MODE" == "run" ]]; then
  [[ -f "$INDEX_CSV" ]] || echo "timestamp_iso,source_path,source_bytes,bundle_name,bundle_bytes,sha256,remote_path,pruned" > "$INDEX_CSV"
  trash_bag="$HOME/.Trash/SessionArtifactPrune-$(date +%Y%m%d-%H%M%S)"

  for i in "${!candidate_paths[@]}"; do
    src="${candidate_paths[$i]}"
    src_root="${candidate_src_roots[$i]}"
    src_size="${candidate_sizes[$i]}"
    src_base="$(basename "$src")"
    root_slug="$(safe_slug "$(basename "$src_root")")"
    base_slug="$(safe_slug "$src_base")"
    ts="$(date +%Y%m%d-%H%M%S)"
    bundle_name="${ts}-${root_slug}-${base_slug}.tar.gz"
    bundle_path="$LOCAL_ARCHIVE/$bundle_name"
    remote_path="$REMOTE_ARCHIVE/$bundle_name"

    # package one source item per bundle
    if [[ -d "$src" ]]; then
      tar -czf "$bundle_path" -C "$(dirname "$src")" "$(basename "$src")"
    else
      tar -czf "$bundle_path" -C "$(dirname "$src")" "$(basename "$src")"
    fi

    bundle_size="$(bytes_for_path "$bundle_path")"
    checksum="$(sha256_file "$bundle_path")"
    printf "%s  %s\n" "$checksum" "$bundle_name" > "$bundle_path.sha256"

    cp -f "$bundle_path" "$remote_path"
    cp -f "$bundle_path.sha256" "$REMOTE_ARCHIVE/$bundle_name.sha256"

    pack_count=$((pack_count + 1))
    packed_bytes=$((packed_bytes + bundle_size))
    copied_count=$((copied_count + 1))

    pruned="no"
    src_mtime="$(stat_mtime "$src")"
    src_age_days=$(( (now_epoch - src_mtime) / 86400 ))
    if (( APPLY_PRUNE == 1 )) && (( src_age_days >= PRUNE_DAYS )); then
      mkdir -p "$trash_bag"
      mv "$src" "$trash_bag/" 2>/dev/null || true
      pruned="yes"
      pruned_count=$((pruned_count + 1))
      pruned_bytes=$((pruned_bytes + src_size))
    fi

    echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ'),\"$src\",$src_size,$bundle_name,$bundle_size,$checksum,\"$remote_path\",$pruned" >> "$INDEX_CSV"
  done
fi

if (( JSON == 1 )); then
  cat <<EOF
{
  "mode": "$MODE",
  "pack_days": $PACK_DAYS,
  "prune_days": $PRUNE_DAYS,
  "local_archive": "$LOCAL_ARCHIVE",
  "remote_archive": "$REMOTE_ARCHIVE",
  "sources_count": ${#SOURCES[@]},
  "candidates_count": $candidate_count,
  "candidates_bytes": $candidate_total_bytes,
  "packed_count": $pack_count,
  "packed_bytes": $packed_bytes,
  "copied_count": $copied_count,
  "apply_prune": $APPLY_PRUNE,
  "pruned_count": $pruned_count,
  "pruned_bytes": $pruned_bytes,
  "index_csv": "$INDEX_CSV"
}
EOF
  exit 0
fi

echo "=== Session Artifact Lifecycle ==="
echo "Mode: $MODE"
echo "Pack threshold: ${PACK_DAYS} days"
echo "Prune threshold: ${PRUNE_DAYS} days"
echo "Local archive: $LOCAL_ARCHIVE"
echo "Remote archive: $REMOTE_ARCHIVE"
echo "Candidates: $candidate_count ($(human_bytes "$candidate_total_bytes"))"

if [[ "$MODE" == "audit" ]]; then
  echo "Dry run only. No files moved."
  echo "Run:"
  echo "  npm run session:archive:run"
  echo "Run + prune (to Trash):"
  echo "  npm run session:archive:run:prune"
  exit 0
fi

echo "Packed: $pack_count ($(human_bytes "$packed_bytes"))"
echo "Copied to remote: $copied_count bundle(s)"
echo "Pruned: $pruned_count ($(human_bytes "$pruned_bytes"))"
echo "Index: $INDEX_CSV"
