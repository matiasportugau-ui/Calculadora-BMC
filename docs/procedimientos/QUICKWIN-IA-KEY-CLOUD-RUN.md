# Quick-win: "Sin proveedor IA configurado" (ANTHROPIC_API_KEY / GEMINI_API_KEY en Cloud Run)

**Lane exclusiva** — Resuelve el banner rojo en la calculadora:
> Sin proveedor IA configurado. Configurá ANTHROPIC_API_KEY o GEMINI_API_KEY.

Este error aparece cuando `POST /api/crm/suggest-response` devuelve 503 con `code: "IA_NOT_CONFIGURED"`.

**Regla estricta:** Nunca pegues secretos (API keys) en archivos del repo, `.env` (salvo local efímero no commiteado), issues, PRs ni Markdown. Usá siempre `printf '%s' 'valor'` + stdin (`--data-file=-`) o variables de shell efímeras.

**Responsable de la key:** Matias (la carga él con su valor fresco de Anthropic/Gemini console). Este documento solo tiene el procedimiento + placeholders.

## Prerrequisitos (una sola vez)
- `gcloud` CLI instalado y autenticado: `gcloud auth login`
- Proyecto activo: `gcloud config set project chatbot-bmc-live`
- Permisos: `roles/run.admin` y `roles/secretmanager.admin` (o suficientes para el servicio `panelin-calc`).

## Paso a paso (cargar UNA key — recomendado: Anthropic primero)

Anthropic (Claude) es la preferida por tono español rioplatense y calidad en el flujo de sugerencias CRM/ML.

### 1. Crear / rotar el secret en Google Secret Manager (GSM)

Matias ejecuta (reemplazando el placeholder por su key real — **nunca la escribas en chat ni archivos**):

```bash
# Crear nuevo secret (primera vez)
printf '%s' 'sk-ant-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' | \
  gcloud secrets create ANTHROPIC_API_KEY \
    --replication-policy=automatic \
    --project=chatbot-bmc-live \
    --data-file=-

# O agregar nueva versión (rotación / refresh de key)
printf '%s' 'sk-ant-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' | \
  gcloud secrets versions add ANTHROPIC_API_KEY \
    --project=chatbot-bmc-live \
    --data-file=-
```

**Alternativa Gemini** (si preferís o Anthropic sin créditos):
```bash
printf '%s' 'AIzaSy...' | gcloud secrets create GEMINI_API_KEY --replication-policy=automatic --project=chatbot-bmc-live --data-file=-
# o versions add para rotar
```

Verificar que existe:
```bash
gcloud secrets describe ANTHROPIC_API_KEY --project=chatbot-bmc-live
```

### 2. Otorgar permiso secretAccessor al runtime Service Account de Cloud Run (idempotente)

```bash
# Obtener el SA del servicio (o default compute)
SA=$(gcloud run services describe panelin-calc \
  --region=us-central1 --project=chatbot-bmc-live \
  --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)

if [[ -z "$SA" ]]; then
  PROJECT_NUMBER=$(gcloud projects describe chatbot-bmc-live --format='value(projectNumber)')
  SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
fi

echo "Runtime SA: $SA"

gcloud secrets add-iam-policy-binding ANTHROPIC_API_KEY \
  --member="serviceAccount:${SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=chatbot-bmc-live
```

(Repetir el binding para `GEMINI_API_KEY` si usás esa.)

### 3. Mapear el secret a Cloud Run (panelin-calc) con --update-secrets

Esto inyecta la key como variable de entorno en runtime sin exponerla en la config del servicio.

```bash
gcloud run services update panelin-calc \
  --region=us-central1 \
  --project=chatbot-bmc-live \
  --update-secrets="ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest" \
  --quiet
```

- Solo una key es suficiente (el endpoint tiene fallback chain).
- El comando crea una **nueva revisión** automáticamente y le da tráfico (merge con secrets/env previos).
- Si querés varias de una: separá por coma: `--update-secrets="ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest"`

Confirmar que la revisión nueva está lista:
```bash
gcloud run services describe panelin-calc --region=us-central1 \
  --format='value(status.latestReadyRevisionName)'
```

Opcional: ver que el secret aparece en la plantilla (los valores nunca se muestran):
```bash
gcloud run services describe panelin-calc --region=us-central1 --format=json | \
  jq -r '.spec.template.spec.containers[0].env[]? | select(.valueSource.secretKeyRef) | .name'
```

### 4. Verificación (el curl pedido)

**URL actual del servicio (puede variar tras deploys; siempre verificá con describe):**
```bash
gcloud run services describe panelin-calc --region=us-central1 --format='value(status.url)'
```

**Curl de verificación (POST, sin auth requerida para este endpoint):**

```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"consulta":"prueba rápida de disponibilidad de IA después de key"}' \
  "https://panelin-calc-q74zutv7dq-uc.a.run.app/api/crm/suggest-response" | cat
```

**Estado actual (antes de la key — para referencia):**
```json
{"ok":false,"code":"IA_NOT_CONFIGURED","error":"Ninguna clave IA configurada. Definí al menos una: ANTHROPIC_API_KEY, OPENAI_API_KEY, GROK_API_KEY, GEMINI_API_KEY (p. ej. Secret Manager en Cloud Run)."}
```

**Éxito esperado (después de mapear la key):**
```json
{
  "ok": true,
  "respuesta": "Respuesta breve y profesional generada por el modelo...",
  "provider": "claude",
  "model": "claude-3-5-haiku-20241022"
}
```

- Si ves `ok: true` + `respuesta` + `provider` → listo.
- Si sigue `IA_NOT_CONFIGURED` → revisar que la revisión nueva esté servida (puede tomar 10-30s), o que el secret name coincida exactamente.
- Si `All providers failed` → la key existe pero el proveedor rechaza (créditos, quota, modelo). Probar otra key o revisar billing en la consola del proveedor.

### 5. Verificación en UI (el banner)

- Abrir https://calculadora-bmc.vercel.app (o local con API que apunte a prod via BMC_API_BASE).
- Ir a un flujo que use sugerencias IA (ej. Admin de Cotizaciones → botón Sugerir, o wizard de calculadora si llama suggest internamente).
- El banner rojo **"Sin proveedor IA configurado..."** debe desaparecer.
- Una sugerencia real debe generarse y mostrarse.

### Recomendaciones
- **Una key basta** para el quick-win. Anthropic suele dar mejores resultados en español rioplatense para este dominio.
- Para rotación completa o agregar todas las keys (incluyendo Grok/OpenAI): preferí `./scripts/provision-secrets.sh` (lee de `.env` local efímero) + `./run_ml_cloud_run_setup.sh` (que ya maneja todos los AI providers vía GSM + `--update-secrets`).
- Nunca dejes la key como `--update-env-vars=ANTHROPIC_API_KEY=sk-...` (queda visible en la config del servicio y en logs).
- Después de este quick-win, el smoke `npm run smoke:prod` (o con `BMC_API_BASE=...`) debería pasar el chequeo de `POST /api/crm/suggest-response` (a menos que se saltee con `SMOKE_SKIP_SUGGEST=1`).
- Si la key es de Anthropic: asegurate que tenga créditos/billing activo.

### Comandos de una sola vez (resumen para Matias)

```bash
# 1. Key (pegá tu valor real aquí, solo en esta shell)
KEY='sk-ant-...'

# 2. Secret
printf '%s' "$KEY" | gcloud secrets create ANTHROPIC_API_KEY --replication-policy=automatic --project=chatbot-bmc-live --data-file=- || \
printf '%s' "$KEY" | gcloud secrets versions add ANTHROPIC_API_KEY --project=chatbot-bmc-live --data-file=-

# 3. IAM (idempotente)
SA=$(gcloud run services describe panelin-calc --region=us-central1 --project=chatbot-bmc-live --format='value(spec.template.spec.serviceAccountName)' || echo "$(gcloud projects describe chatbot-bmc-live --format='value(projectNumber)')-compute@developer.gserviceaccount.com")
gcloud secrets add-iam-policy-binding ANTHROPIC_API_KEY --member="serviceAccount:${SA}" --role="roles/secretmanager.secretAccessor" --project=chatbot-bmc-live

# 4. Map to Cloud Run
gcloud run services update panelin-calc --region=us-central1 --project=chatbot-bmc-live --update-secrets="ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest" --quiet

# 5. Verificar
BASE=$(gcloud run services describe panelin-calc --region=us-central1 --format='value(status.url)')
echo "Base: $BASE"
curl -s -X POST -H "Content-Type: application/json" -d '{"consulta":"test post key"}' "$BASE/api/crm/suggest-response" | cat

# (Alternativa estática conocida al momento de escribir — siempre preferí el describe arriba)
# curl -s -X POST -H "Content-Type: application/json" -d '{"consulta":"test"}' \
#   "https://panelin-calc-q74zutv7dq-uc.a.run.app/api/crm/suggest-response" | cat
```

Listo. Una vez que Matias ejecute y el curl devuelva `ok: true`, el banner desaparece y las sugerencias IA vuelven a funcionar en prod.

**No modificar BUG-TRIAGE-RAMIRO.md** (lo maneja otro agente). Este quick-win es independiente.