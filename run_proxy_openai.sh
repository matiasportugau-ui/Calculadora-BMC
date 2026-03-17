#!/bin/bash
# Levanta el proxy OpenAI para Panelin AI Chat (puerto 3848).
# Requiere OPENAI_API_KEY en .env o como variable de entorno.
# Uso: ./run_proxy_openai.sh

set -e
cd "$(dirname "$0")"

if [[ -f .env ]]; then
  set -a
  source .env 2>/dev/null || true
  set +a
fi

if [[ -z "$OPENAI_API_KEY" ]]; then
  echo "Error: OPENAI_API_KEY no está definido."
  echo "Agregá OPENAI_API_KEY=sk-xxx a .env o ejecutá:"
  echo "  OPENAI_API_KEY=sk-xxx ./run_proxy_openai.sh"
  exit 1
fi

PROXY_SCRIPT="$HOME/.panelin-evolution/proxy-openai.js"
if [[ ! -f "$PROXY_SCRIPT" ]]; then
  echo "Error: No existe $PROXY_SCRIPT"
  exit 1
fi

echo "→ Iniciando proxy OpenAI en http://localhost:3848"
exec node "$PROXY_SCRIPT"
