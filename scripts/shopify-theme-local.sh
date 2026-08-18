#!/usr/bin/env bash
# Shopify theme local workflow: pull → edit → preview → push (upload).
# Usage:
#   bash scripts/shopify-theme-local.sh pull
#   bash scripts/shopify-theme-local.sh dev
#   bash scripts/shopify-theme-local.sh push [--unpublished]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
THEME_DIR="${SHOPIFY_THEME_DIR:-$REPO_ROOT/shopify-theme}"
cd "$REPO_ROOT"

# Load .env if present (SHOPIFY_SHOP, SHOPIFY_CLI_THEME_TOKEN, etc.)
if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
fi

SHOP="${SHOPIFY_SHOP:-}"
if [[ -n "$SHOP" && "$SHOP" != *.myshopify.com ]]; then
  SHOP="${SHOP}.myshopify.com"
fi

need_shop() {
  if [[ -z "$SHOP" ]]; then
    echo "Set SHOPIFY_SHOP in .env (e.g. your-store.myshopify.com)" >&2
    exit 1
  fi
}

need_cli() {
  if ! command -v shopify >/dev/null 2>&1 && ! npx --yes shopify version >/dev/null 2>&1; then
    echo "Shopify CLI not found. Install: npm i -g @shopify/cli @shopify/theme" >&2
    exit 1
  fi
}

run_shopify() {
  if command -v shopify >/dev/null 2>&1; then
    shopify "$@"
  else
    npx --yes shopify "$@"
  fi
}

CMD="${1:-help}"
shift || true

case "$CMD" in
  pull)
    need_shop
    need_cli
    mkdir -p "$THEME_DIR"
    echo "Pulling live theme into $THEME_DIR (shop=$SHOP)…"
    # Prefer Theme Access password if set; else interactive CLI auth.
    EXTRA=()
    if [[ -n "${SHOPIFY_CLI_THEME_TOKEN:-}" ]]; then
      EXTRA+=(--password "$SHOPIFY_CLI_THEME_TOKEN")
    fi
    run_shopify theme pull --path "$THEME_DIR" --store "$SHOP" "${EXTRA[@]}" "$@"
    echo "Done. Edit files under shopify-theme/, then: npm run shopify:theme:dev"
    ;;
  dev)
    need_shop
    need_cli
    if [[ ! -d "$THEME_DIR" ]] || [[ -z "$(ls -A "$THEME_DIR" 2>/dev/null | grep -v README.md | grep -v '^\.' || true)" ]]; then
      echo "Theme folder empty. Run: npm run shopify:theme:pull" >&2
      exit 1
    fi
    EXTRA=()
    if [[ -n "${SHOPIFY_CLI_THEME_TOKEN:-}" ]]; then
      EXTRA+=(--password "$SHOPIFY_CLI_THEME_TOKEN")
    fi
    echo "Starting local theme preview (shop=$SHOP)…"
    run_shopify theme dev --path "$THEME_DIR" --store "$SHOP" "${EXTRA[@]}" "$@"
    ;;
  push)
    need_shop
    need_cli
    EXTRA=(--unpublished)
    if [[ "${1:-}" == "--live" ]]; then
      EXTRA=()
      shift
      echo "WARNING: pushing to LIVE theme" >&2
    fi
    if [[ -n "${SHOPIFY_CLI_THEME_TOKEN:-}" ]]; then
      EXTRA+=(--password "$SHOPIFY_CLI_THEME_TOKEN")
    fi
    echo "Uploading theme from $THEME_DIR (shop=$SHOP)…"
    run_shopify theme push --path "$THEME_DIR" --store "$SHOP" "${EXTRA[@]}" "$@"
    echo "Upload finished."
    ;;
  help|*)
    cat <<EOF
Shopify theme local workflow

  npm run shopify:theme:pull   # download live theme → shopify-theme/
  npm run shopify:theme:dev    # local preview (edit + hot reload)
  npm run shopify:theme:push   # upload as unpublished theme (safe)
  npm run shopify:theme:push -- --live   # upload to live (careful)

Requires: SHOPIFY_SHOP in .env, Shopify CLI login or SHOPIFY_CLI_THEME_TOKEN
(Theme Access password from Shopify Admin → Apps → Theme Access).

Catalog Local Studio (titles/prices drafts): http://localhost:5173/hub/shopify
EOF
    ;;
esac
