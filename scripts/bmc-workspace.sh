#!/bin/bash
# bmc-workspace.sh — Workspace multi-terminal para BMC en Cursor
#
# Uso:
#   bash scripts/bmc-workspace.sh          → crea sesión y adjunta
#   bash scripts/bmc-workspace.sh attach   → adjunta a sesión existente
#   source scripts/bmc-workspace.sh env    → carga funciones en la shell actual
#
# Funciones disponibles después de `source ... env`:
#   bmc-send  <ventana> <comando>   — ejecuta un comando en otra ventana
#   bmc-read  <ventana> [N]         — muestra las últimas N líneas de otra ventana
#   bmc-list                        — lista las ventanas activas
#   bmc-focus <ventana>             — enfoca una ventana

SESSION="bmc"
SOCKET="/tmp/bmc-tmux.sock"

# ── Funciones helper (disponibles vía `source ... env`) ──────────────────────
bmc-send() {
  local win="$1"; shift
  tmux -S "$SOCKET" send-keys -t "${SESSION}:${win}" "$*" Enter
}

bmc-read() {
  local win="$1"
  local lines="${2:-30}"
  echo "━━━ ${SESSION}:${win} (últimas ${lines} líneas) ━━━"
  tmux -S "$SOCKET" capture-pane -t "${SESSION}:${win}" -p -S "-${lines}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

bmc-list() {
  echo "Ventanas activas en sesión '${SESSION}':"
  tmux -S "$SOCKET" list-windows -t "$SESSION" 2>/dev/null \
    || echo "  (sesión no iniciada)"
}

bmc-focus() {
  tmux -S "$SOCKET" select-window -t "${SESSION}:$1" 2>/dev/null
}

bmc-broadcast() {
  local cmd="$*"
  tmux -S "$SOCKET" list-windows -t "$SESSION" -F '#{window_name}' 2>/dev/null \
    | while read -r win; do
        echo "→ $win: $cmd"
        tmux -S "$SOCKET" send-keys -t "${SESSION}:${win}" "$cmd" Enter
      done
}

# ── Modo: cargar funciones en shell actual ───────────────────────────────────
if [[ "$1" == "env" ]]; then
  echo "✅ Funciones BMC cargadas: bmc-send, bmc-read, bmc-list, bmc-focus, bmc-broadcast"
  return 0 2>/dev/null || exit 0
fi

# ── Modo: adjuntar a sesión existente ────────────────────────────────────────
if [[ "$1" == "attach" ]]; then
  tmux -S "$SOCKET" attach -t "$SESSION"
  exit $?
fi

# ── Modo: crear workspace completo ───────────────────────────────────────────
if tmux -S "$SOCKET" has-session -t "$SESSION" 2>/dev/null; then
  echo "ℹ️  Sesión '$SESSION' ya existe. Adjuntando..."
  chmod 777 "$SOCKET"
  tmux -S "$SOCKET" attach -t "$SESSION"
  exit 0
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Crear sesión con ventana inicial
tmux -S "$SOCKET" new-session -d -s "$SESSION" -n "dev" -c "$ROOT"

# Ventanas nombradas
tmux -S "$SOCKET" new-window -t "$SESSION" -n "api"     -c "$ROOT"
tmux -S "$SOCKET" new-window -t "$SESSION" -n "tests"   -c "$ROOT"
tmux -S "$SOCKET" new-window -t "$SESSION" -n "preview" -c "$ROOT"
tmux -S "$SOCKET" new-window -t "$SESSION" -n "git"     -c "$ROOT"

# Comandos iniciales por ventana
tmux -S "$SOCKET" send-keys -t "${SESSION}:dev"     "npm run dev" Enter
tmux -S "$SOCKET" send-keys -t "${SESSION}:api"     "npm run dev:api" Enter
tmux -S "$SOCKET" send-keys -t "${SESSION}:preview" "npm run preview:watch" Enter
tmux -S "$SOCKET" send-keys -t "${SESSION}:git"     "git status" Enter

# Volver a la ventana dev
tmux -S "$SOCKET" select-window -t "${SESSION}:dev"

# Permisos para que otros terminales Cursor puedan conectar
chmod 777 "$SOCKET"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  BMC Workspace listo                                    ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Ventanas: dev · api · tests · preview · git           ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Desde cualquier terminal Cursor:                       ║"
echo "║                                                          ║"
echo "║  Adjuntar:  tmux -S $SOCKET attach -t $SESSION         ║"
echo "║  O:         bash scripts/bmc-workspace.sh attach        ║"
echo "║                                                          ║"
echo "║  Cargar helpers:                                         ║"
echo "║    source scripts/bmc-workspace.sh env                  ║"
echo "║    bmc-send tests 'npm test'                             ║"
echo "║    bmc-read  dev  50                                     ║"
echo "║    bmc-list                                              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

tmux -S "$SOCKET" attach -t "$SESSION"
