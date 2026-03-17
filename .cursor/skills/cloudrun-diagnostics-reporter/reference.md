# Cloud Run Diagnostics — Reference

## Defaults

| Variable | Valor |
|----------|--------|
| PROJECT | chatbot-bmc-live |
| REGION | us-central1 |
| SERVICE | panelin-calc |
| Bucket tokens ML | gs://panelin-calc-ml-tokens/ |

## Comandos para Cloud Shell

### Estado del servicio (REST v2 — evita crash de gcloud describe)

```bash
PROJECT=chatbot-bmc-live REGION=us-central1 SERVICE=panelin-calc
URL="https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/services/${SERVICE}"
JSON="$(curl -sS -H "Authorization: Bearer $(gcloud auth print-access-token)" "${URL}")"
echo "$JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
t=d.get('template') or {}
s=d.get('scaling') or {}
print('minInstanceCount:', s.get('minInstanceCount'), 'maxInstanceCount:', s.get('maxInstanceCount'))
print('timeout:', t.get('timeout'), 'serviceAccount:', t.get('serviceAccount'))
print('traffic:', d.get('traffic'))
print('uri:', d.get('uri'))
for i,c in enumerate(t.get('containers') or []):
  r=c.get('resources') or {}
  print('container:', c.get('image'), 'cpu:', r.get('cpu'), 'memory:', r.get('memoryLimit'))
"
```

### Logging — errores recientes

```bash
# Últimos 10 errores (severity >= ERROR)
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="panelin-calc" AND severity>=ERROR' \
  --project=chatbot-bmc-live --limit=10 --format="value(timestamp,jsonPayload.message)" --freshness=7d 2>/dev/null

# Conteo por status HTTP (últimas 24h)
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="panelin-calc" AND httpRequest.status>=400' \
  --project=chatbot-bmc-live --freshness=1d --limit=500 --format="value(httpRequest.status)" 2>/dev/null | sort | uniq -c | sort -rn
```

### Bucket tokens ML

```bash
gsutil ls -la gs://panelin-calc-ml-tokens/ 2>/dev/null || echo "Bucket vacío o sin acceso"
```

## Heurísticas de anomalía persistente

Considerar **anomalía persistente** y reportarla si:

| Patrón / Mensaje | Umbral | Acción sugerida |
|------------------|--------|------------------|
| "OAuth not initialized" / "Complete /auth/ml/start" | >3 en 7d | Completar flujo OAuth ML; revisar bucket y ML_CLIENT_SECRET |
| "Missing OAuth configuration: ML_CLIENT_SECRET" | ≥1 | Verificar env var en Cloud Run (valor correcto, sin truncar) |
| 500 en `/auth/ml/start` | >5 en 7d | Revisar servidor OAuth y configuración ML |
| 401 en `/ml/questions` | >10 en 7d | Verificar API_AUTH_TOKEN y cabeceras en cliente |
| 404 en `/auth/ml/callback`, `/favicon.ico`, `/`, `/robots.txt` | Conteo alto | Añadir handlers o ignorar (favicon/robots) |
| 400 en `/calc/cotizar` | Revisar payload y validación | Revisar body y documentación del endpoint |

## Plantilla de reporte

```markdown
# Reporte Diagnóstico Cloud Run — panelin-calc

**Proyecto:** chatbot-bmc-live | **Región:** us-central1 | **Fecha:** YYYY-MM-DD

## 1. Estado general del servicio
- Ready / Conditions (ConfigurationsReady, RoutesReady)
- Revisión activa y % tráfico
- URI del servicio

## 2. Configuración del contenedor
- Imagen, CPU, memoria, puerto
- Concurrencia, timeout
- Scaling min/max, service account

## 3. Errores HTTP (resumen)
- Tabla: status code, cuenta, ejemplo de ruta

## 4. Anomalías persistentes
| Mensaje / patrón | Conteo (ventana) | Último visto | Severidad | Acción |
|------------------|------------------|--------------|-----------|--------|
| ... | ... | ... | 🔴/🟡 | ... |

## 5. Seguridad / configuración
- Ingress, IAM (allUsers run.invoker), secretos en env
- Health checks, probes

## 6. Recomendaciones
- Urgentes
- Importantes
- Buenas prácticas
```

## URLs Cloud Console (para uso con browser)

- Run servicio: `https://console.cloud.google.com/run/detail/us-central1/panelin-calc?project=chatbot-bmc-live`
- Logging: `https://console.cloud.google.com/logs/query?project=chatbot-bmc-live` (filtrar por `resource.labels.service_name="panelin-calc"`)
- Storage bucket: `https://console.cloud.google.com/storage/browser/panelin-calc-ml-tokens?project=chatbot-bmc-live`
