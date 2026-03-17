# Anomalías persistentes — panelin-calc (Cloud Run)

**Proyecto:** chatbot-bmc-live | **Servicio:** panelin-calc | **Última actualización:** (fecha)

Rellena este archivo tras ejecutar el diagnóstico (script o comandos de Cloud Shell) y analizar logs.

## Plantilla

| Mensaje / patrón | Conteo (ventana) | Último visto | Severidad | Acción sugerida |
|------------------|------------------|--------------|-----------|-----------------|
| OAuth not initialized. Complete /auth/ml/start | 26 en 7d | (timestamp) | 🔴 | Completar flujo OAuth ML; revisar bucket y ML_CLIENT_SECRET |
| Missing OAuth configuration: ML_CLIENT_SECRET | — | — | 🔴 | Verificar variable de entorno en Cloud Run |
| 500 en /auth/ml/start | 20 en 7d | — | 🔴 | Revisar servidor OAuth y configuración ML |
| 401 en /ml/questions | 23 en 7d | — | 🟡 | Verificar API_AUTH_TOKEN y cabeceras |
| 404 /auth/ml/callback, /favicon.ico, /, /robots.txt | — | — | 🟡 | Añadir handlers o ignorar |

## Comando para actualizar conteos (ejecutar en Cloud Shell)

```bash
gcloud logging read 'resource.labels.service_name="panelin-calc" AND severity>=ERROR' \
  --project=chatbot-bmc-live --freshness=7d --limit=200 --format=json \
  | python3 -c "
import json,sys
from collections import Counter
logs=json.load(sys.stdin)
msgs=[l.get('jsonPayload',{}).get('message','') or str(l.get('jsonPayload',{})) for l in logs]
for msg,c in Counter(msgs).most_common(15):
  print(c, msg[:80])
"
```
