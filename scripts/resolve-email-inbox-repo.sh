#!/usr/bin/env bash
# Imprime la ruta absoluta al repo conexion-cuentas-email-agentes-bmc.
# Orden: $BMC_EMAIL_INBOX_REPO → Calculadora-BMC/.env → carpeta hermana del repo.
# Exit 1 si el directorio no existe.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -n "${BMC_EMAIL_INBOX_REPO:-}" ]]; then
  EMAIL_REPO="${BMC_EMAIL_INBOX_REPO}"
elif [[ -f "$REPO_ROOT/.env" ]]; then
  line="$(grep -E '^[[:space:]]*BMC_EMAIL_INBOX_REPO=' "$REPO_ROOT/.env" | head -1 || true)"
  if [[ -n "$line" ]]; then
    line="${line#*=}"
    line="${line%$'\r'}"
    line="${line#\"}"
    line="${line%\"}"
    line="${line#\'}"
    line="${line%\'}"
    EMAIL_REPO="$line"
  fi
fi

if [[ -z "${EMAIL_REPO:-}" ]]; then
  EMAIL_REPO="$(dirname "$REPO_ROOT")/conexion-cuentas-email-agentes-bmc"
fi

if [[ ! -d "$EMAIL_REPO" ]]; then
  echo "No existe el repo de correo: $EMAIL_REPO" >&2
  echo "Definí BMC_EMAIL_INBOX_REPO o agregá la carpeta como hermana de Calculadora-BMC (ver .env.example)." >&2
  exit 1
fi

echo "$EMAIL_REPO"
