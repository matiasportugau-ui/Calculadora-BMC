#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MODE="${1:-ensure}" # ensure | check

NODE_MIN_MAJOR="${KNOWLEDGE_NODE_MIN_MAJOR:-20}"
AUTO_INSTALL_NODE="${KNOWLEDGE_AUTO_INSTALL_NODE:-0}" # 1 => attempt brew install node
AUTO_INSTALL_DEPS="${KNOWLEDGE_AUTO_INSTALL_DEPS:-1}" # 1 => npm ci/install when possible

log() { echo "[knowledge-env] $*"; }
warn() { echo "[knowledge-env][warn] $*" >&2; }
fail() { echo "[knowledge-env][error] $*" >&2; exit 1; }

add_common_paths() {
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
}

try_load_nvm() {
  if [[ -z "${NVM_DIR:-}" ]]; then
    export NVM_DIR="$HOME/.nvm"
  fi
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
    if command -v nvm >/dev/null 2>&1; then
      nvm use --silent default >/dev/null 2>&1 || true
      nvm use --silent node >/dev/null 2>&1 || true
    fi
  fi
}

ensure_node_npm() {
  add_common_paths
  command -v node >/dev/null 2>&1 || try_load_nvm
  command -v npm >/dev/null 2>&1 || try_load_nvm

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    if [[ "$MODE" == "ensure" && "$AUTO_INSTALL_NODE" == "1" && "$(uname -s)" == "Darwin" ]] && command -v brew >/dev/null 2>&1; then
      log "Node/npm not found; attempting brew install node (KNOWLEDGE_AUTO_INSTALL_NODE=1)."
      brew install node
      add_common_paths
    fi
  fi

  command -v node >/dev/null 2>&1 || fail "node not found. Install Node >= ${NODE_MIN_MAJOR}."
  command -v npm >/dev/null 2>&1 || fail "npm not found. Install npm with Node."

  local node_major
  node_major="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "$node_major" -lt "$NODE_MIN_MAJOR" ]]; then
    fail "Node major version ${node_major} is too old. Need >= ${NODE_MIN_MAJOR}."
  fi

  log "node=$(node --version) npm=$(npm --version)"
}

ensure_repo_deps() {
  local lock_file="$REPO_ROOT/package-lock.json"
  local marker_dep="$REPO_ROOT/node_modules/openai/package.json"

  if [[ "$MODE" == "check" ]]; then
    if [[ ! -f "$marker_dep" ]]; then
      fail "Dependencies not installed (missing node_modules). Run in ensure mode."
    fi
    log "Dependencies present."
    return
  fi

  if [[ -f "$marker_dep" ]]; then
    log "Dependencies already present."
    return
  fi

  if [[ "$AUTO_INSTALL_DEPS" != "1" ]]; then
    fail "Dependencies missing and auto install disabled (KNOWLEDGE_AUTO_INSTALL_DEPS=0)."
  fi

  log "Installing dependencies for knowledge antenna runtime..."
  (
    cd "$REPO_ROOT"
    if [[ -f "$lock_file" ]]; then
      npm ci --silent
    else
      npm install --silent
    fi
  )
  log "Dependencies installed."
}

ensure_writable_dirs() {
  mkdir -p "$REPO_ROOT/docs/team/knowledge/reports"
  mkdir -p "$HOME/.cache/bmc-knowledge-antenna"
  if [[ ! -w "$REPO_ROOT/docs/team/knowledge" ]]; then
    fail "No write permission in docs/team/knowledge."
  fi
  log "Knowledge directories writable."
}

main() {
  ensure_node_npm
  ensure_repo_deps
  ensure_writable_dirs
  log "Environment check OK."
}

main "$@"
