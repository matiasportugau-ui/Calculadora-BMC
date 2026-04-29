# Cloud Run Secrets Sync — `run_ml_cloud_run_setup.sh`

Sincroniza variables operativas desde `.env` (local) → Cloud Run (`panelin-calc`).
Reemplaza el flujo manual de `gcloud run services update --update-env-vars` para todos los grupos de configuración.

## Cuándo usarlo

- Después de agregar/rotar una clave en `.env` que tiene que llegar a producción.
- Después de cambiar un Sheet ID, token de Meta, ID de carpeta de Drive, etc.
- Como parte del checklist de deploy (ver `CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md`).

> **Importante:** este script no maneja secrets multilínea ni valores con comas — para esos casos usar Secret Manager + `--update-secrets`. Hoy todas las claves operativas son single-line.

## Prerrequisitos

1. `gcloud` instalado y autenticado: `gcloud auth login`.
2. Proyecto configurado: `gcloud config set project <PROJECT_ID>`.
3. `.env` presente en la raíz del repo con las claves esperadas (ver `.env.example`).
4. Permiso `roles/run.admin` sobre el servicio `panelin-calc`.

## Qué sincroniza (al 2026-04-29)

El script lee directamente de `.env` y publica como `--update-env-vars`. Grupos cubiertos:

| Grupo | Variables | Notas |
|-------|-----------|-------|
| MercadoLibre | `ML_*` (incluye `ML_TOKEN_GCS_BUCKET`), `PUBLIC_BASE_URL` | OAuth + token persistido en GCS |
| AI providers | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `GEMINI_API_KEY`, `GROK_API_KEY` | Chat + voz Realtime |
| Auth / webhooks | `API_AUTH_TOKEN`, `API_KEY`, `WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Bridge WhatsApp + bearer interno |
| Sheets | `BMC_SHEET_ID`, `BMC_SHEET_SCHEMA`, `BMC_PAGOS_SHEET_ID`, `BMC_CALENDARIO_SHEET_ID`, `BMC_VENTAS_SHEET_ID`, `BMC_STOCK_SHEET_ID`, `WOLFB_*` | CRM operativo + Wolfboard |
| Drive | `DRIVE_QUOTE_FOLDER_ID` | Mirror de cotizaciones HTML (commit 34a36b0) |

Para ver la lista exacta de claves cargadas, mirar las líneas `load_env_key …` del script. Las claves `GCS_QUOTES_BUCKET`, `TRANSPORTISTA_GCS_BUCKET`, `DATABASE_URL` **no están en este script** — sincronizarlas con `gcloud run services update` manualmente o ampliar el script si se vuelven recurrentes.

## Cómo ejecutarlo

```bash
cd /ruta/al/repo
./run_ml_cloud_run_setup.sh                    # service por defecto: panelin-calc
./run_ml_cloud_run_setup.sh otro-servicio      # otro service
```

El script imprime cada variable que va a aplicar (con value enmascarado para AI keys) antes de invocar `gcloud run services update`.

## Verificación post-sync

1. **Esperar el rollout** (~30 s):
   ```bash
   gcloud run services describe panelin-calc --region=us-central1 \
     --format='value(status.latestReadyRevisionName)'
   ```

2. **Confirmar variables en la revisión activa** (lista los KEYS, los VALUES no se exponen):
   ```bash
   gcloud run services describe panelin-calc --region=us-central1 --format=json \
     | jq -r '.spec.template.spec.containers[0].env[]?.name' | sort
   ```

3. **Smoke test contra el servicio**:
   ```bash
   curl -s "https://panelin-calc-<PROJECT>.us-central1.run.app/health" | jq
   curl -s -X POST -H "Content-Type: application/json" \
     -H "Authorization: Bearer $API_AUTH_TOKEN" \
     "https://panelin-calc-<PROJECT>.us-central1.run.app/api/agent/voice/session" \
     -d '{"calcState":{},"devMode":false}' | jq '.ok, .error // empty'
   ```
   - `/health` debe responder `ok: true`.
   - `/api/agent/voice/session` debe minar (o devolver el error real de OpenAI). Si devuelve `OpenAI API key not configured`, la sync no actualizó `OPENAI_API_KEY` — revisar `.env` y reintentar.

4. **Verificación específica para Drive** (si `DRIVE_QUOTE_FOLDER_ID` se cambió):
   ```bash
   curl -s -X POST -H "Content-Type: application/json" \
     "https://panelin-calc-<PROJECT>.us-central1.run.app/api/calc/cotizar/pdf" \
     -d '{...payload de prueba...}' | jq '.drive_url'
   ```
   Debe devolver una URL `https://drive.google.com/file/...`. Si devuelve `null` con `DRIVE_QUOTE_FOLDER_ID` set, revisar permisos de la service account sobre la carpeta.

## Troubleshooting

| Síntoma | Causa probable | Solución |
|--------|----------------|----------|
| `Error: No hay proyecto gcloud` | Proyecto no seteado | `gcloud config set project <PROJECT_ID>` |
| `Error: No existe .env` | CWD incorrecto | Ejecutar desde la raíz del repo |
| `gcloud: command not found` | gcloud SDK no instalado | Instalar Google Cloud SDK |
| `PERMISSION_DENIED` en update | Falta `roles/run.admin` | Pedir permiso al admin del proyecto |
| Variable nueva no aparece tras sync | No está cargada por `load_env_key` | Editar el script y agregar `load_env_key NUEVA_VAR` |
| Valor con coma rechazado | Limitación de `--update-env-vars` | Migrar a Secret Manager + `--update-secrets` |

## Rollback

`gcloud run services update` mantiene la revisión anterior. Para volver atrás:

```bash
gcloud run services update-traffic panelin-calc --region=us-central1 \
  --to-revisions=<revisión-previa>=100
```

## Referencias

- Script: `run_ml_cloud_run_setup.sh`
- Config consumidor: `server/config.js`
- Checklist de deploy completo: `docs/procedimientos/CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md`
- `.env.example` (canonical list of env vars)
