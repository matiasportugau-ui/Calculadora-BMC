#!/usr/bin/env bash
# Desde la raíz de Calculadora-BMC: sincroniza IMAP + reporte PANELSIM en el repo hermano.
# Uso: npm run panelsim:email-ready -- [--days N]
# Requiere: .env del repo de correo con contraseñas IMAP (ver npm run open:email-env).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
EMAIL_REPO="$("$SCRIPT_DIR/resolve-email-inbox-repo.sh")"

if [[ ! -f "$EMAIL_REPO/package.json" ]]; then
  echo "No es un repo npm válido: $EMAIL_REPO/package.json no existe." >&2
  exit 1
fi

cd "$EMAIL_REPO"
if [[ ! -d node_modules ]]; then
  echo ">>> Instalando dependencias en $EMAIL_REPO …" >&2
  npm install
fi

echo ">>> PANELSIM email — repo: $EMAIL_REPO" >&2
echo ">>> Ejecutando: npm run panelsim-update $*" >&2
npm run panelsim-update -- "$@"

REPORT="$EMAIL_REPO/data/reports/PANELSIM-ULTIMO-REPORTE.md"
STATUS="$EMAIL_REPO/data/reports/PANELSIM-STATUS.json"
echo "" >&2
echo "Listo. Artefactos:" >&2
echo "  - $REPORT" >&2
echo "  - $STATUS" >&2
