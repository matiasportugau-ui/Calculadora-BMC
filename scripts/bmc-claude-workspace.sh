#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# bmc-claude-workspace.sh — Multi-terminal Claude Code workspace para BMC
#
# Crea 5 ventanas tmux: 4 con Claude Code especializado + 1 conductor.
# El conductor (ventana 0) es desde donde se invocan skills y se envían
# instrucciones a los otros 4 agentes vía bmc-send.
#
# Uso:
#   bash scripts/bmc-claude-workspace.sh          → crear + adjuntar
#   bash scripts/bmc-claude-workspace.sh attach   → adjuntar a sesión existente
#   bash scripts/bmc-claude-workspace.sh kill     → destruir sesión
#   bash scripts/bmc-claude-workspace.sh status   → listar ventanas y procesos
#   source scripts/bmc-claude-workspace.sh env    → cargar helpers en shell
#
# Helpers disponibles tras `source ... env`:
#   bmc-send  <ventana> <mensaje>   → envía mensaje a claude en esa ventana
#   bmc-read  <ventana> [N]         → muestra últimas N líneas de esa ventana
#   bmc-ask   <ventana> <tarea>     → envía tarea estructurada con contexto
#   bmc-list                        → lista ventanas activas
#   bmc-broadcast <mensaje>         → envía el mismo mensaje a todos los agentes
# ══════════════════════════════════════════════════════════════════════════════

SESSION="bmc"
SOCKET="/tmp/bmc-tmux.sock"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAUDE_BIN="${CLAUDE_BIN:-claude}"

# ── Colores por ventana (tmux colour0-255) ────────────────────────────────────
COLOR_CONDUCTOR="colour196"   # 🔴 rojo  — control center
COLOR_CALC="colour81"         # 🔵 cyan  — BOM / pricing / cálculos
COLOR_SERVER="colour82"       # 🟢 verde — API / Express / server
COLOR_TESTS="colour220"       # 🟡 amarillo — gate / tests
COLOR_OPS="colour177"         # 🟣 magenta — git / deploy / docs

# ── Roles de cada agente (se envían como primer mensaje a claude) ─────────────
ROLE_CALC="Sos el especialista de CALCULADORA BMC. Tu área exclusiva:
  • src/utils/calculations.js — lógica de cálculo
  • src/data/constants.js — precios, paneles, perfiles
  • src/utils/helpers.js — utilidades compartidas
  • BOM (bill of materials): grupos, totales, IVA
Respondé solo con acciones en tu área. Cuando recibas una tarea del conductor, ejecutala y reportá resultado."

ROLE_SERVER="Sos el especialista de SERVER/API BMC. Tu área exclusiva:
  • server/routes/ — endpoints Express
  • server/index.js — entry point y middleware
  • server/config.js — env vars y feature flags
  • server/lib/ — helpers de servidor
  • Integraciones: Sheets, Cloud Run, WhatsApp webhook
Ejecutá las tareas que lleguen del conductor y reportá resultado."

ROLE_TESTS="Sos el especialista de TESTS/GATE BMC. Tu área exclusiva:
  • tests/validation.js — suite principal (368 tests)
  • tests/calc-routes.validation.js — API tests
  • npm run gate:local — lint + tests
  • Playwright E2E cuando corresponda
Antes de reportar cualquier cambio como listo, corré el gate. Nunca marques como OK sin tests verdes."

ROLE_OPS="Sos el especialista de OPS/DEPLOY BMC. Tu área exclusiva:
  • git — commits, branches, PRs
  • Vercel deploy (frontend: calculadora-bmc.vercel.app)
  • Cloud Run deploy (API: panelin-calc, us-central1)
  • docs/team/PROJECT-STATE.md — actualización post-deploy
  • .accessible-base/kb.json — sync post-cambios
Ejecutá deploys y reportá URLs + revision IDs."

# ── Helpers (disponibles vía `source ... env`) ────────────────────────────────
bmc-send() {
  local win="$1"; shift
  local msg="$*"
  tmux -S "$SOCKET" send-keys -t "${SESSION}:${win}" "$msg" Enter
  echo "→ [${win}] $msg"
}

bmc-read() {
  local win="${1:-conductor}"
  local lines="${2:-40}"
  echo "━━━ ${SESSION}:${win} (últimas ${lines} líneas) ━━━"
  tmux -S "$SOCKET" capture-pane -t "${SESSION}:${win}" -p -S "-${lines}" 2>/dev/null
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

bmc-ask() {
  local win="$1"; shift
  local task="$*"
  bmc-send "$win" "TAREA DEL CONDUCTOR: $task"
}

bmc-list() {
  echo "Ventanas activas en sesión '${SESSION}':"
  tmux -S "$SOCKET" list-windows -t "$SESSION" \
    -F "  #{window_index}: #{window_name} (#{pane_current_command})" 2>/dev/null \
    || echo "  (sesión no iniciada)"
}

bmc-broadcast() {
  local msg="$*"
  echo "📢 Broadcast a todos los agentes: $msg"
  for win in calc server tests ops; do
    bmc-send "$win" "$msg"
  done
}

bmc-status() {
  echo ""
  echo "┌─────────────────────────────────────────────────────┐"
  echo "│  BMC Claude Workspace — estado                      │"
  echo "├──────────┬──────────────────────────────────────────┤"
  printf "│ %-8s │ %-40s │\n" "ventana" "proceso"
  echo "├──────────┼──────────────────────────────────────────┤"
  tmux -S "$SOCKET" list-windows -t "$SESSION" \
    -F "│ #{window_name} │ #{pane_current_command}" 2>/dev/null \
    | while IFS= read -r line; do printf "%-52s │\n" "$line"; done
  echo "└──────────┴──────────────────────────────────────────┘"
  echo ""
  echo "Puertos activos:"
  lsof -i :3001,:5173 -sTCP:LISTEN 2>/dev/null \
    | awk 'NR>1 {printf "  :%s → PID %s (%s)\n", $9, $2, $1}'
}

# ── Modo: cargar funciones en shell ──────────────────────────────────────────
if [[ "$1" == "env" ]]; then
  echo "✅ Helpers BMC cargados: bmc-send, bmc-read, bmc-ask, bmc-list, bmc-broadcast, bmc-status"
  echo "   Socket: $SOCKET  |  Sesión: $SESSION"
  return 0 2>/dev/null || exit 0
fi

# ── Modo: status ──────────────────────────────────────────────────────────────
if [[ "$1" == "status" ]]; then
  bmc-status
  exit 0
fi

# ── Modo: destruir sesión ─────────────────────────────────────────────────────
if [[ "$1" == "kill" ]]; then
  tmux -S "$SOCKET" kill-session -t "$SESSION" 2>/dev/null && echo "Sesión '$SESSION' destruida."
  exit 0
fi

# ── Modo: adjuntar ────────────────────────────────────────────────────────────
if [[ "$1" == "attach" ]]; then
  if tmux -S "$SOCKET" has-session -t "$SESSION" 2>/dev/null; then
    chmod 777 "$SOCKET"
    exec tmux -S "$SOCKET" attach -t "$SESSION"
  else
    echo "❌ Sesión '$SESSION' no existe. Corré sin argumentos para crearla."
    exit 1
  fi
fi

# ── Modo: crear workspace completo ───────────────────────────────────────────
if tmux -S "$SOCKET" has-session -t "$SESSION" 2>/dev/null; then
  echo "ℹ️  Sesión '$SESSION' ya existe."
  echo "   Adjuntar:  bash scripts/bmc-claude-workspace.sh attach"
  echo "   Destruir:  bash scripts/bmc-claude-workspace.sh kill"
  exit 0
fi

# Verificar que claude CLI esté disponible
if ! command -v "$CLAUDE_BIN" >/dev/null 2>&1; then
  echo "❌ Claude Code CLI no encontrado ('$CLAUDE_BIN')."
  echo "   Instalá con: npm i -g @anthropic-ai/claude-code"
  exit 1
fi

echo "🚀 Creando BMC Claude Workspace..."
echo "   Root: $ROOT"
echo "   Socket: $SOCKET"
echo ""

# ── Crear sesión con ventana conductor ───────────────────────────────────────
tmux -S "$SOCKET" new-session -d -s "$SESSION" -n "conductor" -c "$ROOT"

# Estilo global del status bar
tmux -S "$SOCKET" set -t "$SESSION" status-style "bg=colour235,fg=colour250"
tmux -S "$SOCKET" set -t "$SESSION" status-left "#[fg=${COLOR_CONDUCTOR},bold] ⚡ bmc #[default]│ "
tmux -S "$SOCKET" set -t "$SESSION" status-right " #[fg=colour245]%H:%M │ /bmc-claude-workspace #[default]"
tmux -S "$SOCKET" set -t "$SESSION" window-status-separator "  "

# Estilo ventana conductor
tmux -S "$SOCKET" set -wt "${SESSION}:conductor" \
  window-status-current-format "#[bg=${COLOR_CONDUCTOR},fg=black,bold] 🎯 conductor #[default]"
tmux -S "$SOCKET" set -wt "${SESSION}:conductor" \
  window-status-format "#[fg=${COLOR_CONDUCTOR}] 🎯 conductor#[default]"

# ── Función interna para crear una ventana de agente ─────────────────────────
_create_agent_window() {
  local name="$1"
  local color="$2"
  local emoji="$3"
  local role_var="$4"

  tmux -S "$SOCKET" new-window -t "$SESSION" -n "$name" -c "$ROOT"

  # Colores de la ventana
  tmux -S "$SOCKET" set -wt "${SESSION}:${name}" \
    window-status-current-format "#[bg=${color},fg=black,bold] ${emoji} ${name} #[default]"
  tmux -S "$SOCKET" set -wt "${SESSION}:${name}" \
    window-status-format "#[fg=${color}] ${emoji} ${name}#[default]"

  # Iniciar claude
  tmux -S "$SOCKET" send-keys -t "${SESSION}:${name}" "$CLAUDE_BIN" Enter

  # Esperar a que claude inicie (título cambia cuando está listo)
  local waited=0
  while [[ $waited -lt 15 ]]; do
    sleep 1
    waited=$((waited + 1))
    local pane_title
    pane_title=$(tmux -S "$SOCKET" display -p -t "${SESSION}:${name}" "#{pane_title}" 2>/dev/null || true)
    # Claude Code muestra "Claude" en el título cuando está listo
    if [[ "$pane_title" == *"Claude"* ]] || [[ $waited -ge 8 ]]; then
      break
    fi
  done

  # Enviar rol como primer mensaje
  local role="${!role_var}"
  tmux -S "$SOCKET" send-keys -t "${SESSION}:${name}" "$role" Enter
  echo "  ✅ $emoji ${name} — claude iniciado"
}

# ── Crear las 4 ventanas de agentes ──────────────────────────────────────────
echo "Iniciando agentes (esto tarda ~30s mientras claude arranca en cada uno)..."
echo ""

_create_agent_window "calc"   "$COLOR_CALC"   "🔵" "ROLE_CALC"
_create_agent_window "server" "$COLOR_SERVER" "🟢" "ROLE_SERVER"
_create_agent_window "tests"  "$COLOR_TESTS"  "🟡" "ROLE_TESTS"
_create_agent_window "ops"    "$COLOR_OPS"    "🟣" "ROLE_OPS"

# ── Configurar ventana conductor ─────────────────────────────────────────────
tmux -S "$SOCKET" select-window -t "${SESSION}:conductor"
tmux -S "$SOCKET" send-keys -t "${SESSION}:conductor" "source '$ROOT/scripts/bmc-claude-workspace.sh' env" Enter
tmux -S "$SOCKET" send-keys -t "${SESSION}:conductor" "bmc-list" Enter
tmux -S "$SOCKET" send-keys -t "${SESSION}:conductor" "echo ''" Enter
tmux -S "$SOCKET" send-keys -t "${SESSION}:conductor" "echo '  Comandos rápidos:'" Enter
tmux -S "$SOCKET" send-keys -t "${SESSION}:conductor" "echo '  bmc-send calc  \"<tarea>\"  → envia instrucción al agente calc'" Enter
tmux -S "$SOCKET" send-keys -t "${SESSION}:conductor" "echo '  bmc-read tests 40         → lee output del agente tests'" Enter
tmux -S "$SOCKET" send-keys -t "${SESSION}:conductor" "echo '  bmc-broadcast \"<msg>\"     → envia a todos los agentes'" Enter

# Permisos para otros terminales
chmod 777 "$SOCKET"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  BMC Claude Workspace — listo                               ║"
echo "╠═══════════╦══════════════════════════════════════════════════╣"
echo "║  ventana  ║  rol                                            ║"
echo "╠═══════════╬══════════════════════════════════════════════════╣"
echo "║ 🎯 0 conductor │ Shell + helpers (bmc-send / bmc-read)     ║"
echo "║ 🔵 1 calc      │ Calculadora BMC — BOM / pricing / cálculo ║"
echo "║ 🟢 2 server    │ API Express — rutas / config / integ.     ║"
echo "║ 🟡 3 tests     │ Gate / tests / lint / Playwright          ║"
echo "║ 🟣 4 ops       │ Git / Vercel / Cloud Run / docs           ║"
echo "╠═══════════╩══════════════════════════════════════════════════╣"
echo "║  Desde otra terminal:                                       ║"
echo "║    tmux -S $SOCKET attach -t $SESSION                      ║"
echo "║    bash scripts/bmc-claude-workspace.sh attach             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

exec tmux -S "$SOCKET" attach -t "${SESSION}:conductor"
