#!/usr/bin/env bash
# Runs when the workspace folder opens (VS Code/Cursor task: runOn folderOpen).
# Idempotent: skips npm install if node_modules exists; local-view script avoids duplicate API/Vite.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -d node_modules ]]; then
  echo "[workspace-folder-open] Installing dependencies (first time or clean clone)..."
  npm install
else
  echo "[workspace-folder-open] node_modules present — skipping npm install."
fi

npm run env:ensure

echo "[workspace-folder-open] Ensuring local API + Vite (see .runtime/ if something fails)..."
bash scripts/local-view-autolaunch.sh
