#!/usr/bin/env bash
# Copy BMC theme patches into a pulled Shopify theme directory.
# Usage: bash scripts/shopify-theme-apply-patches.sh
#        bash scripts/shopify-theme-apply-patches.sh /path/to/theme
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PATCH_ROOT="$REPO_ROOT/shopify-theme/patches"
THEME_DIR="${1:-$REPO_ROOT/shopify-theme}"

if [[ ! -d "$PATCH_ROOT/snippets" ]]; then
  echo "Missing patches at $PATCH_ROOT" >&2
  exit 1
fi

if [[ ! -d "$THEME_DIR/snippets" && ! -d "$THEME_DIR/sections" ]]; then
  echo "Theme not pulled yet (no snippets/sections in $THEME_DIR)." >&2
  echo "1) Set SHOPIFY_SHOP + SHOPIFY_CLI_THEME_TOKEN in .env" >&2
  echo "2) npm run shopify:theme:pull" >&2
  echo "3) npm run shopify:theme:apply-patches" >&2
  exit 1
fi

mkdir -p "$THEME_DIR/snippets" "$THEME_DIR/sections" "$THEME_DIR/assets"

cp -v "$PATCH_ROOT/snippets/"*.liquid "$THEME_DIR/snippets/"
cp -v "$PATCH_ROOT/sections/"*.liquid "$THEME_DIR/sections/"
cp -v "$PATCH_ROOT/assets/"*.css "$THEME_DIR/assets/"

echo ""
echo "Patches applied to $THEME_DIR"
echo "Next:"
echo "  1. Theme Editor → Product template → Add section → «BMC Cotizar Panelin»"
echo "     (place under Buy buttons)"
echo "  2. npm run shopify:theme:dev    # preview"
echo "  3. npm run shopify:theme:push   # upload unpublished"
