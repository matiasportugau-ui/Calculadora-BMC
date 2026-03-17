#!/usr/bin/env bash
# Bump package.json version and append changelog entry.
# Usage: ./scripts/bump_version.sh [major|minor|patch] ["Changelog message"]
# Example: ./scripts/bump_version.sh patch "Fix dashboard API health check"

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PKG="$REPO_ROOT/package.json"
CHANGELOG="$REPO_ROOT/docs/CHANGELOG.md"

BUMP="${1:-patch}"
MSG="${2:-}"

# Parse current version from package.json
CURRENT=$(grep -o '"version": "[^"]*"' "$PKG" | head -1 | sed 's/"version": "\(.*\)"/\1/')
IFS='.' read -r MAJ MIN PATCH <<< "$CURRENT"

case "$BUMP" in
  major) MAJ=$((MAJ + 1)); MIN=0; PATCH=0 ;;
  minor) MIN=$((MIN + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *) echo "Usage: $0 [major|minor|patch] [message]"; exit 1 ;;
esac

NEW_VERSION="$MAJ.$MIN.$PATCH"
DATE=$(date +%Y-%m-%d)

# Update package.json (sed for portability)
if [[ "$(uname)" == "Darwin" ]]; then
  sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" "$PKG"
else
  sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" "$PKG"
fi

# Prepend changelog entry (insert after title, before first ## [)
ENTRY="## [$NEW_VERSION] — $DATE

${MSG:-Update.}

"
if [[ -f "$CHANGELOG" ]]; then
  # Keep title + blank line, insert new entry, then rest
  { head -2 "$CHANGELOG"; echo "$ENTRY"; tail -n +3 "$CHANGELOG"; } > "$CHANGELOG.tmp"
  mv "$CHANGELOG.tmp" "$CHANGELOG"
else
  printf "# Changelog — Panelin Calculadora BMC\n\n%s\n" "$ENTRY" > "$CHANGELOG"
fi

echo "Bumped: $CURRENT → $NEW_VERSION ($BUMP)"
echo "Updated: package.json, docs/CHANGELOG.md"
