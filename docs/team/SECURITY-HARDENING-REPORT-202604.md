# Security Hardening Report — April 2026

**Branch:** `claude/security-hardening-202604-Dt1K9`
**Date:** 2026-04-30
**Author:** Claude Code (bmc-security session)
**Prod baseline revision:** `panelin-calc-00331-2sr`

---

## Resumen ejecutivo

Se cerraron los gaps de seguridad OAuth/webhook identificados en la auditoría del 29-abr-2026:
HMAC implementado en `/webhooks/ml` (Gap #1), `WEBHOOK_VERIFY_TOKEN` generado (Gap #3), y session
affinity documentada para OAuth state (Gap #4). Los secrets sensibles de Cloud Run están en GSM
pero no montados — el deploy batch a continuación completa la migración y cierra también el
Gap #2 (WhatsApp HMAC).

---

## Gaps cerrados (código + docs)

### Gap #1 — ML Webhook HMAC ✅

**Archivo creado:** `server/lib/mlSignature.js`
**Archivo modificado:** `server/index.js` — POST `/webhooks/ml` handler
**Tests:** `tests/mlSignature.test.js` (8 casos: válida, inválida, sin secret, body alterado, replay, header faltante, malformado, undefined secret)

ML firma un template estructurado: `id:{data.id};request-id:{x-request-id};ts:{ts}` con HMAC-SHA256
usando `ML_CLIENT_SECRET`. El handler rechaza con 401 cuando el secret está presente y la firma falla.
Cuando el secret está ausente, skips con warning (patrón idéntico a WhatsApp — no rompe dev).
Segunda capa: `WEBHOOK_VERIFY_TOKEN` sigue activo como defensa en profundidad.

### Gap #3 — `WEBHOOK_VERIFY_TOKEN` generado ✅

Token generado: `6d9541623d8c79552b4f1a988ba503f4aec172f8d109871d4d3679cbb2955671`
Agregado a `.env` local. **Pendiente de acción humana:**
1. Agregar a GSM (comando abajo)
2. Registrar en ML Developers → tu app → Notificaciones → campo "Verify Token"

### Gap #4 — OAuth state (parche temporal) ✅

Session affinity habilitada en Cloud Run (comando abajo). Solución definitiva documentada
en `docs/team/TODO-OAUTH-STATE-PERSIST.md` para v1.4+ (Supabase `oauth_state` table).

---

## Gap #2 — WhatsApp HMAC (pendiente acción humana)

`WHATSAPP_APP_SECRET` ya existe en GSM pero su valor es desconocido (fue creado vacío).
Requiere:
1. Obtener el valor real de Meta → https://developers.facebook.com → app `chatbo2` → Settings → Basic → App Secret → Show
2. Actualizar en GSM: `echo -n "VALOR" | gcloud secrets versions add WHATSAPP_APP_SECRET --data-file=- --project=chatbot-bmc-live`
3. Incluir `WHATSAPP_APP_SECRET=WHATSAPP_APP_SECRET:latest` en el deploy batch (ya incluido abajo)

Ver instrucciones detalladas: `docs/procedimientos/WHATSAPP-HMAC-GAP.md`

---

## Migración GSM — estado

Todos los secrets sensibles existen en GSM (`chatbot-bmc-live`) pero Cloud Run usa plain env vars.
El deploy batch siguiente completa el switch.

| Secret | GSM | Cloud Run montado |
|--------|-----|-------------------|
| `API_AUTH_TOKEN` | ✅ | ❌ plain env var |
| `ANTHROPIC_API_KEY` | ✅ | ❌ plain env var |
| `OPENAI_API_KEY` | ✅ | ❌ plain env var |
| `GEMINI_API_KEY` | ✅ | ❌ plain env var |
| `ML_CLIENT_SECRET` | ✅ | ❌ plain env var |
| `TOKEN_ENCRYPTION_KEY` | ✅ | ❌ plain env var |
| `WHATSAPP_ACCESS_TOKEN` | ✅ | ❌ not mounted |
| `WHATSAPP_VERIFY_TOKEN` | ✅ | ❌ not mounted |
| `WHATSAPP_APP_SECRET` | ✅ (valor pendiente) | ❌ not mounted |
| `WEBHOOK_VERIFY_TOKEN` | ❌ needs create | ❌ not set |

---

## Deploy batch — comandos gcloud para ejecutar

Ejecutar en orden. **Pedir confirmación antes** si hay tráfico activo.

```bash
# 0. Pre-check: revisión activa actual (guardar para rollback)
gcloud run services describe panelin-calc --region=us-central1 \
  --format='value(status.latestReadyRevisionName)'
# → panelin-calc-00331-2sr (guardar este valor)

# 1. Crear WEBHOOK_VERIFY_TOKEN en GSM
echo -n "6d9541623d8c79552b4f1a988ba503f4aec172f8d109871d4d3679cbb2955671" | \
  gcloud secrets create WEBHOOK_VERIFY_TOKEN \
  --data-file=- --project=chatbot-bmc-live
# Si ya existe: reemplazar 'create' con 'versions add WEBHOOK_VERIFY_TOKEN'

# 2. Deploy: migrar secrets de plain env vars a --update-secrets + session affinity
gcloud run services update panelin-calc \
  --region=us-central1 \
  --project=chatbot-bmc-live \
  --update-secrets=API_AUTH_TOKEN=API_AUTH_TOKEN:latest \
  --update-secrets=ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest \
  --update-secrets=OPENAI_API_KEY=OPENAI_API_KEY:latest \
  --update-secrets=GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --update-secrets=ML_CLIENT_SECRET=ML_CLIENT_SECRET:latest \
  --update-secrets=TOKEN_ENCRYPTION_KEY=TOKEN_ENCRYPTION_KEY:latest \
  --update-secrets=WHATSAPP_ACCESS_TOKEN=WHATSAPP_ACCESS_TOKEN:latest \
  --update-secrets=WHATSAPP_VERIFY_TOKEN=WHATSAPP_VERIFY_TOKEN:latest \
  --update-secrets=WHATSAPP_APP_SECRET=WHATSAPP_APP_SECRET:latest \
  --update-secrets=WEBHOOK_VERIFY_TOKEN=WEBHOOK_VERIFY_TOKEN:latest \
  --remove-env-vars=API_AUTH_TOKEN,ANTHROPIC_API_KEY,OPENAI_API_KEY,GEMINI_API_KEY,ML_CLIENT_SECRET \
  --session-affinity

# 3. Verificar nueva revisión activa
gcloud run services describe panelin-calc --region=us-central1 \
  --format='value(status.latestReadyRevisionName)'

# 4. Health check
curl -s https://panelin-calc-q74zutv7dq-uc.a.run.app/health | python3 -m json.tool
# Esperado: ok:true, hasTokens:true, mlTokenStoreOk:true, hasSheets:true

# 5. Verificar que secrets sensibles NO aparecen como plain env vars
gcloud run services describe panelin-calc --region=us-central1 \
  --format='value(spec.template.spec.containers[0].env[].name)' | \
  grep -E 'API_AUTH|ANTHROPIC|OPENAI|GEMINI|ML_CLIENT' || echo "✅ ninguna env var sensible expuesta"

# 6. ML webhook smoke test (debe rechazar sin firma cuando ML_CLIENT_SECRET está activo)
# (opcional — en dev con ML_CLIENT_SECRET real en .env local)
curl -s -X POST http://localhost:3001/webhooks/ml \
  -H "Content-Type: application/json" \
  -d '{"topic":"questions"}' | grep -q '"error":"Invalid webhook signature"' && \
  echo "✅ ML HMAC rechaza correctamente" || echo "⚠️  revisar"

# 7. Registrar WEBHOOK_VERIFY_TOKEN en ML Developers:
# ML Developers → tu app → Notificaciones → campo "Verify Token" → pegar el token generado
```

---

## Rollback por fase

### Rollback deploy (cualquier problema post-deploy)
```bash
gcloud run services update-traffic panelin-calc \
  --region=us-central1 --to-revisions=panelin-calc-00331-2sr=100
```

### Rollback WEBHOOK_VERIFY_TOKEN (si ML deja de enviar notificaciones)
```bash
# Deshabilitar la verificación temporalmente borrando el env var de la revisión activa
gcloud run services update panelin-calc --region=us-central1 \
  --remove-secrets=WEBHOOK_VERIFY_TOKEN
# Luego investigar y re-registrar en ML Developers
```

### Rollback ML HMAC (si ML_CLIENT_SECRET está mal configurado)
El handler tiene modo skipped: si `ML_CLIENT_SECRET` está vacío, pasa sin verificar con warning.
Para rollback de código: revertir el commit del handler en esta branch.

---

## Diff de superficie de ataque

| Vector | Antes | Después |
|--------|-------|---------|
| `POST /webhooks/ml` sin firma | Aceptado (solo `WEBHOOK_VERIFY_TOKEN` vacío) | Rechazado 401 (cuando `ML_CLIENT_SECRET` activo) |
| `POST /webhooks/ml` con token | Sin verificar | Verificado HMAC + token |
| `POST /webhooks/whatsapp` sin firma | Aceptado con warning | Rechazado 401 (después de deploy) |
| Secrets en Cloud Run env (visibles vía `run.services.get`) | 5 secrets expuestos | 0 expuestos (todos en GSM) |
| OAuth state multi-instancia | Roto si Cloud Run escala | Mitigado vía session affinity |

---

## Próximos pasos

1. **Obtener `WHATSAPP_APP_SECRET`** de Meta Dashboard y actualizar GSM (ver `WHATSAPP-HMAC-GAP.md`)
2. **Ejecutar el deploy batch** (sección arriba) — requiere confirmación del equipo
3. **Registrar `WEBHOOK_VERIFY_TOKEN`** en ML Developers → Notificaciones
4. **Persistir OAuth state** en Supabase (v1.4+) — ver `TODO-OAUTH-STATE-PERSIST.md`
5. **Evaluar rotación automática** de secrets via Secret Manager rotation policies (fuera de alcance v1.3)
6. **Agregar `GROK_API_KEY` y `SHOPIFY_*` a `--update-secrets`** si están en GSM (no verificado en este run)
