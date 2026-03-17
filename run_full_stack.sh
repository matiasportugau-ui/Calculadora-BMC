#!/usr/bin/env bash
# Full-stack startup: API (3001) + Vite (5173) + Panelin Evolution viewer (3847) si existe.
# Uso: ./run_full_stack.sh [--no-viewer]

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

USE_VIEWER=true
for arg in "$@"; do
  case "$arg" in
    --no-viewer) USE_VIEWER=false ;;
  esac
done

VIEWER_DIR="$HOME/.panelin-evolution/viewer"

echo ""
echo "=== BMC Full Stack ==="
echo ""

# API + Vite siempre
CMD_API="node server/index.js"
CMD_VITE="npm run dev"

if [[ "$USE_VIEWER" == "true" ]] && [[ -d "$VIEWER_DIR" ]]; then
  echo "  API:     http://localhost:3001"
  echo "  Vite:    http://localhost:5173"
  echo "  Viewer:  http://localhost:3847"
  echo ""
  npx --yes concurrently -n api,vite,viewer -c blue,green,magenta \
    "$CMD_API" \
    "$CMD_VITE" \
    "npx --yes serve \"$VIEWER_DIR\" --listen 0.0.0.0:3847"
else
  if [[ "$USE_VIEWER" == "true" ]] && [[ ! -d "$VIEWER_DIR" ]]; then
    echo "  (Viewer no encontrado en $VIEWER_DIR — omitiendo)"
    echo ""
  fi
  echo "  API:     http://localhost:3001"
  echo "  Vite:    http://localhost:5173"
  echo ""
  npx --yes concurrently -n api,vite -c blue,green \
    "$CMD_API" \
    "$CMD_VITE"
fi
