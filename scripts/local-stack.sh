#!/usr/bin/env bash
# ==============================================================================
# local-stack.sh — Control Unificado del Stack Local BMC en macOS
#
# Servicios gestionados:
#   1. IAlfred Desk API & Web     :3857  (~/Projects/personal-agent)
#   2. Enviar Desk (Responder)    :8787  (~/bmc-sheet-quote-pipeline)
#   3. Calculadora BMC API        :3001  (~/calculadora-bmc)
#   4. Calculadora BMC Vite UI    :5173  (~/calculadora-bmc)
#
# Uso:
#   ./scripts/local-stack.sh start    # Inicia los servicios que no estén corriendo
#   ./scripts/local-stack.sh stop     # Detiene los servicios del stack
#   ./scripts/local-stack.sh restart  # Reinicia todos los servicios
#   ./scripts/local-stack.sh status   # Muestra el estado y health de cada servicio
# ==============================================================================

set -euo pipefail

CALC_DIR="$HOME/calculadora-bmc"
PIPELINE_DIR="$HOME/bmc-sheet-quote-pipeline"
AGENT_DIR="$HOME/Projects/personal-agent"
RUNTIME_DIR="$CALC_DIR/.runtime"

mkdir -p "$RUNTIME_DIR"

PID_AGENT="$RUNTIME_DIR/personal-agent.pid"
PID_DESK="$RUNTIME_DIR/enviar-desk.pid"
PID_API="$RUNTIME_DIR/calculadora-api.pid"
PID_VITE="$RUNTIME_DIR/calculadora-vite.pid"

LOG_AGENT="$RUNTIME_DIR/personal-agent.log"
LOG_DESK="$RUNTIME_DIR/enviar-desk.log"
LOG_API="$RUNTIME_DIR/calculadora-api.log"
LOG_VITE="$RUNTIME_DIR/calculadora-vite.log"

is_port_listening() {
  local port="$1"
  lsof -iTCP:"$port" -sTCP:LISTEN -n -P >/dev/null 2>&1
}

port_pid() {
  local port="$1"
  lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -n 1 || true
}

check_health() {
  local url="$1"
  local code
  code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$url" 2>/dev/null || echo "000")"
  if [[ "$code" =~ ^(200|302|304)$ ]]; then
    echo "OK ($code)"
  else
    echo "DOWN ($code)"
  fi
}

status_service() {
  local name="$1"
  local port="$2"
  local health_url="$3"

  local pid
  pid="$(port_pid "$port")"

  if [[ -n "$pid" ]]; then
    local health
    health="$(check_health "$health_url")"
    printf "  • %-26s [Port :%s]  PID %-6s  HTTP %s\n" "$name" "$port" "$pid" "$health"
  else
    printf "  • %-26s [Port :%s]  INACTIVO\n" "$name" "$port"
  fi
}

start_service() {
  local name="$1"
  local port="$2"
  local dir="$3"
  local cmd="$4"
  local pid_file="$5"
  local log_file="$6"
  local health_url="$7"

  if is_port_listening "$port"; then
    local existing_pid
    existing_pid="$(port_pid "$port")"
    echo "  ✔ $name ya está corriendo en el puerto :$port (PID $existing_pid)"
    return 0
  fi

  echo "  ▶ Iniciando $name en el puerto :$port..."
  python3 -c "
import subprocess, sys
p = subprocess.Popen(
    ['bash', '-c', sys.argv[1]],
    cwd=sys.argv[2],
    start_new_session=True,
    stdout=open(sys.argv[3], 'a'),
    stderr=subprocess.STDOUT,
    stdin=subprocess.DEVNULL
)
with open(sys.argv[4], 'w') as f:
    f.write(str(p.pid))
" "$cmd" "$dir" "$log_file" "$pid_file"

  # Esperar hasta 10 segundos a que escuche
  local tries=20
  while (( tries > 0 )); do
    if is_port_listening "$port"; then
      local pid
      pid="$(port_pid "$port")"
      echo "    ✔ $name activo (PID $pid)"
      return 0
    fi
    sleep 0.5
    tries=$((tries - 1))
  done

  echo "    ⚠ $name tardó en responder. Revisá el log en: $log_file"
}

stop_service() {
  local name="$1"
  local port="$2"
  local pid_file="$3"

  local pid
  pid="$(port_pid "$port")"

  if [[ -n "$pid" ]]; then
    echo "  ⏹ Deteniendo $name (PID $pid)..."
    kill "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    echo "    ✔ $name detenido."
  else
    echo "  • $name no estaba corriendo en :$port."
  fi
  rm -f "$pid_file"
}

cmd_status() {
  echo "========================================================"
  echo " Estado del Stack Local BMC (127.0.0.1)"
  echo "========================================================"
  status_service "IAlfred Desk" "3857" "http://127.0.0.1:3857/health"
  status_service "Enviar Desk" "8787" "http://127.0.0.1:8787/"
  status_service "Calculadora API" "3001" "http://127.0.0.1:3001/health"
  status_service "Calculadora Vite UI" "5173" "http://127.0.0.1:5173"
  echo "========================================================"
}

cmd_start() {
  echo "========================================================"
  echo " Iniciando Stack Local BMC..."
  echo "========================================================"

  # 1. IAlfred Desk (:3857)
  start_service "IAlfred Desk" "3857" "$AGENT_DIR" \
    "doppler run --project=personal-agent --config=prd -- node apps/api/src/server.mjs" \
    "$PID_AGENT" "$LOG_AGENT" "http://127.0.0.1:3857/health"

  # 2. Enviar Desk (:8787)
  start_service "Enviar Desk" "8787" "$PIPELINE_DIR" \
    "doppler run --project=bmc-backend --config=prd -- node scripts/enviar-desk.mjs" \
    "$PID_DESK" "$LOG_DESK" "http://127.0.0.1:8787/"

  # 3. Calculadora BMC API (:3001)
  start_service "Calculadora API" "3001" "$CALC_DIR" \
    "doppler run --project=bmc-backend --config=prd -- npm run start:api" \
    "$PID_API" "$LOG_API" "http://127.0.0.1:3001/health"

  # 4. Calculadora BMC Vite UI (:5173)
  start_service "Calculadora Vite UI" "5173" "$CALC_DIR" \
    "npm run dev" \
    "$PID_VITE" "$LOG_VITE" "http://127.0.0.1:5173"

  echo ""
  cmd_status
}

cmd_stop() {
  echo "========================================================"
  echo " Deteniendo Stack Local BMC..."
  echo "========================================================"
  stop_service "Calculadora Vite UI" "5173" "$PID_VITE"
  stop_service "Calculadora API" "3001" "$PID_API"
  stop_service "Enviar Desk" "8787" "$PID_DESK"
  stop_service "IAlfred Desk" "3857" "$PID_AGENT"
  echo "========================================================"
}

case "${1:-status}" in
  start)
    cmd_start
    ;;
  stop)
    cmd_stop
    ;;
  restart)
    cmd_stop
    sleep 1
    cmd_start
    ;;
  status)
    cmd_status
    ;;
  *)
    echo "Uso: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac
