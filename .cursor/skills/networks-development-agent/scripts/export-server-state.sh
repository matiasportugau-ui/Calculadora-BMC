#!/usr/bin/env bash
# Exporta estado del BMC Dashboard (endpoints, env, features) sin secretos.
# Requiere que el servidor esté corriendo en localhost:3849 o localhost:3001.
#
# Uso: ./export-server-state.sh [puerto] [archivo_salida]
# Ejemplo: ./export-server-state.sh 3849 bmc-state.json

PORT="${1:-3849}"
OUTPUT="${2:-bmc-dashboard-export-$(date +%Y%m%d-%H%M%S).json}"
URL="http://localhost:${PORT}/api/server-export"

# El standalone (3849) tiene server-export; Express (3001) puede no tenerlo
if [[ "$PORT" == "3001" ]]; then
  echo "Nota: Express en 3001 puede no tener /api/server-export. Usar 3849 para dashboard standalone."
fi

echo "Exportando desde $URL..."
if curl -sS -f "$URL" -o "$OUTPUT" 2>/dev/null; then
  echo "OK → $OUTPUT"
  head -c 500 "$OUTPUT"
  echo ""
  echo "..."
else
  echo "Error: no se pudo conectar. ¿El servidor está en puerto $PORT?"
  echo "  npm run bmc-dashboard  # puerto 3849"
  exit 1
fi
