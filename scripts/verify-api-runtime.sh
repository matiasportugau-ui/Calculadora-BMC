#!/bin/bash

# Colores para la salida
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

API_URL="http://localhost:3001"
LOG_FILE="/tmp/api_runtime_test.log"

# Función para limpiar y salir
cleanup() {
  echo "Limpiando..."
  if [ ! -z "$API_PID" ]; then
    kill $API_PID
  fi
  rm -f $LOG_FILE
  exit
}

trap cleanup INT TERM

echo "Iniciando el servidor de la API en segundo plano..."
# Iniciar la API y guardar su PID
npm run start:api > $LOG_FILE 2>&1 &
API_PID=$!

echo "Servidor de API iniciado con PID: $API_PID. Esperando a que esté listo..."
sleep 5 # Esperar 5 segundos a que el servidor se levante

# Verificar el endpoint /health
echo -n "Verificando GET /health... "
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/health)
if [ "$HEALTH_STATUS" -eq 200 ]; then
  echo -e "${GREEN}OK (Código: $HEALTH_STATUS)${NC}"
else
  echo -e "${RED}FALLÓ (Código: $HEALTH_STATUS)${NC}"
  cat $LOG_FILE
  cleanup
fi

# Array de endpoints a verificar
endpoints=("/api/kpi-report" "/api/kpi-financiero" "/api/cotizaciones")
all_ok=true

for endpoint in "${endpoints[@]}"; do
  echo -n "Verificando GET $endpoint... "
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$endpoint")
  # Aceptamos 200 (OK) o 503 (Servicio no disponible, p.ej. sheets no conectadas)
  if [ "$STATUS" -eq 200 ] || [ "$STATUS" -eq 503 ]; then
    echo -e "${GREEN}OK (Código: $STATUS)${NC}"
  else
    echo -e "${RED}FALLÓ (Código: $STATUS)${NC}"
    all_ok=false
  fi
done

echo "Deteniendo el servidor de la API..."
kill $API_PID
wait $API_PID 2>/dev/null

echo "Limpieza final..."
rm -f $LOG_FILE

if [ "$all_ok" = true ]; then
  echo -e "\n${GREEN}Resumen: Todas las verificaciones de runtime de la API pasaron con éxito.${NC}"
  exit 0
else
  echo -e "\n${RED}Resumen: Fallaron una o más verificaciones de runtime de la API.${NC}"
  exit 1
fi
