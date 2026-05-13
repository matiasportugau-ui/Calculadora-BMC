#!/usr/bin/env bash
# Monthly branch hygiene check. Run on first Friday of each month.
# Prints three actionable lists; takes no destructive action.
#
# Usage:
#   bash scripts/branch-housekeeping-monthly.sh
#
# For full automated cleanup (>50 branches), invoke the bmc-branch-cleanup skill.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "═══════════════════════════════════════════════════════════"
echo "Branch housekeeping report — $(date -Iseconds)"
echo "═══════════════════════════════════════════════════════════"

echo ""
echo "── Refrescando refs ──"
git fetch --all --prune --quiet

total=$(git branch -r | grep -v 'HEAD ->' | wc -l | tr -d ' ')
echo "Branches remotas totales: $total"

# ──────────────────────────────────────────────────────────────
echo ""
echo "## 1) Mergeadas a main (safe-delete via gh pr list --state merged)"
echo ""
gh pr list --state open --limit 200 --json headRefName --jq '.[].headRefName' | sort -u > /tmp/_open.txt
gh pr list --state merged --limit 200 \
  --json number,headRefName,mergedAt,title \
  --jq '.[] | select(.headRefName != "main") | "\(.number)\t\(.headRefName)\t\(.mergedAt[0:10])\t\(.title)"' \
  > /tmp/_merged.txt

# Filter to branches still on origin AND not in open-PR blocklist
git for-each-ref --format='%(refname:short)' refs/remotes/origin/ \
  | sed 's|^origin/||' | sort -u > /tmp/_heads.txt

awk -F'\t' '{print $2}' /tmp/_merged.txt | sort -u > /tmp/_merged-branches.txt
comm -12 /tmp/_merged-branches.txt /tmp/_heads.txt > /tmp/_safe-delete.txt
comm -23 /tmp/_safe-delete.txt /tmp/_open.txt > /tmp/_safe-delete-final.txt

n=$(wc -l < /tmp/_safe-delete-final.txt | tr -d ' ')
echo "  $n branches con PR mergeado que aún viven en origin:"
while IFS= read -r b; do
  pr=$(awk -F'\t' -v b="$b" '$2==b {print "#"$1; exit}' /tmp/_merged.txt)
  printf "  - %-50s (%s)\n" "$b" "$pr"
done < /tmp/_safe-delete-final.txt

# ──────────────────────────────────────────────────────────────
echo ""
echo "## 2) Stale ≥30 días sin PR abierto"
echo ""
cutoff=$(date -v-30d +%Y-%m-%d 2>/dev/null || date -d '30 days ago' +%Y-%m-%d)
git for-each-ref --format='%(committerdate:short)|%(refname:short)' refs/remotes/origin/ \
  | awk -F'|' -v c="$cutoff" '$1 < c {gsub(/^origin\//, "", $2); print $1, $2}' \
  | while read -r date branch; do
      [ "$branch" = "main" ] && continue
      [ "$branch" = "HEAD" ] && continue
      if ! grep -Fxq "$branch" /tmp/_open.txt; then
        printf "  - %s  %s\n" "$date" "$branch"
      fi
    done

# ──────────────────────────────────────────────────────────────
echo ""
echo "## 3) PRs abiertos con conflicts (necesitan rebase)"
echo ""
gh pr list --state open --limit 200 --json number,headRefName,mergeable \
  --jq '.[] | select(.mergeable=="CONFLICTING") | "  - #\(.number) \(.headRefName)"'

# ──────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Para limpieza masiva, usar skill bmc-branch-cleanup"
echo "═══════════════════════════════════════════════════════════"

# Cleanup
rm -f /tmp/_open.txt /tmp/_merged.txt /tmp/_heads.txt /tmp/_merged-branches.txt /tmp/_safe-delete.txt /tmp/_safe-delete-final.txt
