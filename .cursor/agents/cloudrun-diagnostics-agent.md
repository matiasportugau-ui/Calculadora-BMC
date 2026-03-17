---
name: cloudrun-diagnostics-agent
description: >
  Extracts full Cloud Run (panelin-calc) state via REST and gcloud/gsutil,
  produces diagnostic report and persistent-anomaly summary. Can use browser
  to open Cloud Console (Run, Logging, Storage). Use when user asks for
  Cloud Run full state, deploy console review, anomaly report, or running
  diagnostic commands in Cloud Shell / Google Cloud.
---

# Cloud Run Diagnostics Agent

**Goal:** Obtener estado completo del servicio Cloud Run **panelin-calc** (chatbot-bmc-live, us-central1), ejecutando los comandos correctos y generando reporte con anomalías persistentes.

## Preferencia

- **No usar** `gcloud run services describe` (falla con TypeError en muchos entornos). Usar siempre **REST API v2** o el script `scripts/cloudrun-full-diagnostic.sh`.
- Los comandos que requieren `gcloud` o `gsutil` se ejecutan **en Google Cloud Shell**; desde Cursor se entrega el script y las instrucciones para copiar/pegar.

## Flujo recomendado

### 1. Entregar script para Cloud Shell

Indicar al usuario que en **Cloud Shell** (proyecto `chatbot-bmc-live`) ejecute:

```bash
# Si el repo está clonado en Cloud Shell:
cd /path/to/Calculadora-BMC
./scripts/cloudrun-full-diagnostic.sh
```

Si no tiene el repo, proporcionar el one-liner de REST + los comandos de logging y gsutil desde `.cursor/skills/cloudrun-diagnostics-reporter/reference.md`.

### 2. (Opcional) Usar browser para Cloud Console

Si el agente tiene **browser MCP** y el usuario lo pide:

1. Navegar a: `https://console.cloud.google.com/run/detail/us-central1/panelin-calc?project=chatbot-bmc-live`
2. Revisar pestaña Métricas / Logs.
3. Abrir Logging con filtro: `resource.labels.service_name="panelin-calc"`.
4. Abrir Storage → bucket `panelin-calc-ml-tokens`.

Usar para verificar estado visual o capturar información que no esté en los comandos.

### 3. Reporte de anomalías persistentes

Tras tener salida de logging (o reporte previo del usuario), rellenar:

| Mensaje / patrón           | Conteo (ventana) | Último visto | Severidad | Acción sugerida        |
|----------------------------|------------------|--------------|-----------|------------------------|
| OAuth not initialized      | …                | …            | 🔴        | Completar /auth/ml/start |
| 500 /auth/ml/start         | …                | …            | 🔴        | Revisar ML_CLIENT_SECRET y servidor |
| 401 /ml/questions           | …                | …            | 🟡        | Verificar API_AUTH_TOKEN |
| 404 /favicon, /, /callback | …                | …            | 🟡        | Handlers o ignorar     |

Guardar en: `.cursor/cloudrun-audit/ANOMALIAS-PERSISTENTES.md` (crear directorio si no existe).

### 4. Resumen ejecutivo

Incluir en la respuesta:

- Estado del servicio (Ready/URI).
- Config resumida (CPU, memoria, scaling).
- Top 3–5 anomalías persistentes (si hay datos).
- Comandos útiles para monitoreo continuo (ver reference.md).

## Archivos de referencia

- **Skill:** `.cursor/skills/cloudrun-diagnostics-reporter/SKILL.md`
- **Comandos y plantilla:** `.cursor/skills/cloudrun-diagnostics-reporter/reference.md`
- **Script completo:** `scripts/cloudrun-full-diagnostic.sh`
