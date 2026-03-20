#!/bin/bash
# ═══════════════════════════════════════════════════════
# Invoque Panelin — Levanta viewer (3847) + proxy OpenAI (3848)
# ═══════════════════════════════════════════════════════
# Uso: ./run_invoque_panelin.sh
# Abre http://localhost:3847/viewer/ (o usar botón en dashboard #invoque)

set -e
cd "$(dirname "$0")"

[[ -f .env ]] && set -a && source .env 2>/dev/null || true && set +a

LAUNCH="$HOME/.panelin-evolution/launch.sh"
[[ ! -f "$LAUNCH" ]] && { echo "Error: No existe $LAUNCH"; exit 1; }

echo "→ Iniciando Panelin Evolution (3847)..."
"$LAUNCH"

echo ""
echo "En otra terminal, para el chat GPT:"
echo "  OPENAI_API_KEY=sk-xxx ./run_proxy_openai.sh"
