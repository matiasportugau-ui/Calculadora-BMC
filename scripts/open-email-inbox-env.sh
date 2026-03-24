#!/usr/bin/env bash
# Abre el .env del repo conexion-cuentas-email-agentes-bmc (IMAP + OPENAI_API_KEY para npm run summary).
# Resolución de ruta: scripts/resolve-email-inbox-repo.sh (misma que panelsim:email-ready).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

EMAIL_REPO="$("$SCRIPT_DIR/resolve-email-inbox-repo.sh")"
ENV_FILE="$EMAIL_REPO/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No existe $ENV_FILE" >&2
  echo "En ese repo: cp .env.example .env y completá IMAP + OPENAI_API_KEY para resumen LLM." >&2
  exit 1
fi

if command -v cursor >/dev/null 2>&1; then
  cursor "$ENV_FILE"
elif command -v code >/dev/null 2>&1; then
  code "$ENV_FILE"
else
  open -e "$ENV_FILE"
fi
echo "Abierto: $ENV_FILE"
