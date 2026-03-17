#!/usr/bin/env bash
# Valida configuración mínima para el BMC Dashboard.
# Ejecutar desde la raíz del proyecto o desde cualquier lugar.
#
# Uso: ./validate-config.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../" && pwd)"
cd "$PROJECT_ROOT" || exit 1

echo "=== Validación BMC Dashboard ==="

# .env
if [[ -f .env ]]; then
  echo "✓ .env existe"
  for var in BMC_SHEET_ID GOOGLE_APPLICATION_CREDENTIALS; do
    if grep -q "^${var}=" .env 2>/dev/null; then
      echo "  ✓ $var definido"
    else
      echo "  ✗ $var faltante"
    fi
  done
else
  echo "✗ .env no existe"
fi

# service-account
SA_PATH="docs/bmc-dashboard-modernization/service-account.json"
if [[ -f "$SA_PATH" ]]; then
  if python3 -c "import json; json.load(open('$SA_PATH'))" 2>/dev/null; then
    echo "✓ service-account.json válido ($SA_PATH)"
  else
    echo "✗ service-account.json inválido"
  fi
else
  echo "? service-account no encontrado en $SA_PATH (puede venir de .env)"
fi

# Puertos
for port in 3001 3849; do
  if lsof -i ":$port" >/dev/null 2>&1; then
    echo "✓ Puerto $port en uso (servidor activo)"
  else
    echo "  Puerto $port libre"
  fi
done

echo "=== Fin ==="
