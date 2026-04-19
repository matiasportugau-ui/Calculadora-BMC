#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[ERROR] No es un repositorio Git"
  exit 1
fi

chmod +x .githooks/post-commit
chmod +x .githooks/post-merge

git config core.hooksPath .githooks

echo "[OK] AUTOTRACE: hooks en .githooks"
echo "[OK] core.hooksPath=.githooks"
