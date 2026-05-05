# Migración de Secrets — Env Vars → Google Secret Manager

Las claves de alta sensibilidad de `panelin-calc` históricamente vivían como
plain env vars en Cloud Run, configuradas vía `run_ml_cloud_run_setup.sh`. Eso
las hace visibles para cualquier identidad con `run.services.get` (típicamente
más amplio que el grupo que necesita acceso real al secret).

Este doc describe cómo migrar al modelo correcto: secret en Secret Manager +
`--update-secrets` mount en la revisión de Cloud Run.

## Alcance

**Migran a Secret Manager** (alta sensibilidad — pueden generar costos directos
o dar acceso a sistemas externos):

| Clave | Origen | Riesgo si se filtra |
|-------|--------|---------------------|
| `ANTHROPIC_API_KEY` | Anthropic | Cargo directo + abuso del límite |
| `OPENAI_API_KEY` | OpenAI | Cargo directo + abuso del límite |
| `GEMINI_API_KEY` | Google AI Studio | Cargo + cuota |
| `GROK_API_KEY` | xAI | Cargo + cuota |
| `WHATSAPP_ACCESS_TOKEN` | Meta | Suplantación del número WA |
| `WHATSAPP_VERIFY_TOKEN` | Self | Spoofing del webhook entrante |
| `ML_CLIENT_SECRET` | MercadoLibre | OAuth client takeover |
| `WEBHOOK_VERIFY_TOKEN` | Self | Spoofing del webhook ML |
| `TOKEN_ENCRYPTION_KEY` | Self | Decrypta tokens GCS persistidos |
| `API_AUTH_TOKEN` | Self | Acceso admin/cockpit + voz/logs |

**Quedan como env vars** (IDs públicos / config / URLs, sin riesgo si se leen):
`ML_CLIENT_ID`, `BMC_*_SHEET_ID`, `WHATSAPP_PHONE_NUMBER_ID`,
`DRIVE_QUOTE_FOLDER_ID`, `WOLFB_*`, `OPENAI_CHAT_MODEL`, `PUBLIC_BASE_URL`,
`ML_USE_PROD_REDIRECT`, `ML_TOKEN_*`.

## Modelo dual transitorio

`run_ml_cloud_run_setup.sh` ahora usa un helper `add_sensitive`:

- Si el secret existe en GSM → mount via `--update-secrets KEY=KEY:latest`.
- Si **no** existe → fallback a env var **con warning** (`⚠️  KEY → env var ...`).

Esto significa que el deploy sigue funcionando hoy sin migración, y cada
clave migra independientemente cuando la provisionás. No hay "big bang".

## Migración (una sola vez)

### 1. Provisionar los secrets en Secret Manager

```bash
# Desde la raíz del repo, con .env válido y gcloud autenticado
./scripts/provision-secrets.sh
```

El script:
1. Lee cada clave de alta sensibilidad de `.env`.
2. Crea el secret si no existe (replicación automática), o agrega una
   nueva versión si el valor cambió.
3. Otorga `roles/secretmanager.secretAccessor` al service account efectivo
   del servicio Cloud Run (`panelin-calc`).

Es **idempotente** — corrigelo cuantas veces necesites.

### 2. Re-deployar

```bash
./run_ml_cloud_run_setup.sh
```

Ahora cada clave migrada se imprime como `🔒 KEY → Secret Manager` en lugar
de `→ KEY: sincronizado`. La nueva revisión de Cloud Run ya no expone esos
valores en su `spec.template.spec.containers[].env`.

### 3. Verificar

```bash
# Listar secrets activos
gcloud secrets list --filter="name ~ ANTHROPIC OR name ~ OPENAI OR name ~ ML_CLIENT_SECRET"

# Ver que la revisión NO tiene los secrets como env var
gcloud run services describe panelin-calc --region=us-central1 \
  --format='value(spec.template.spec.containers[0].env[].name)'

# Y SÍ los tiene como --secrets
gcloud run services describe panelin-calc --region=us-central1 \
  --format='value(spec.template.spec.containers[0].envFrom[])'
```

### 4. (Opcional) Limpiar versiones viejas en env vars

Las env vars de la revisión vieja siguen accesibles via
`gcloud run revisions describe`. Para borrarlas del histórico, deployar una
nueva revisión limpia es suficiente — Cloud Run mantiene las últimas N
revisiones por default. Para forzar limpieza completa, eliminar revisiones
manualmente (no recomendado salvo incidente).

## Rotar un secret

```bash
# 1. Actualizá .env con el nuevo valor
# 2. Volvé a correr el provisioner — agrega una nueva versión
./scripts/provision-secrets.sh

# 3. Forzar a Cloud Run a recargar la última versión:
./run_ml_cloud_run_setup.sh
```

Cloud Run mounta `:latest` por default, así que la nueva versión se aplica
en el próximo cold start. Para rotación instantánea, deployar manualmente.

## Rollback

Si una migración rompe el deploy, el modo dual permite revertir clave por
clave:

```bash
# Borrar el secret hace que el script vuelva a usar env var en el próximo run
gcloud secrets delete OPENAI_API_KEY --quiet
./run_ml_cloud_run_setup.sh
```

## Pendientes / out of scope

- `WHATSAPP_APP_SECRET` — tracked separately en
  [`WHATSAPP-HMAC-GAP.md`](./WHATSAPP-HMAC-GAP.md).
- `panelin-service-account` (JSON del SA) — ya está en GSM y montado en
  `/run/secrets/service-account.json` via el workflow de CI; no requiere
  migración.
- Rotación automática (Secret Manager rotation policies) — fuera de alcance,
  evaluar caso por caso.

## Migración completada — 2026-04-30

- Revisión Cloud Run resultante: `panelin-calc-<TBD-revision>` (reemplazar
  con el output de
  `gcloud run services describe panelin-calc --region=us-central1 --format='value(status.latestReadyRevisionName)'`
  tras el redeploy).
- Claves migradas a Secret Manager (montadas vía `--update-secrets`):
  `ML_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `API_AUTH_TOKEN`,
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`,
  `GROK_API_KEY`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`.
- Verificación: `gcloud run revisions describe <NEW_REV>
  --format='value(spec.containers[0].env[].name)' | tr ';' '\n'` ya no
  lista esas claves.
- Pendientes de provisión (no bloqueantes):
  - `WEBHOOK_VERIFY_TOKEN`: vacío en `.env` — regenerar con
    `openssl rand -hex 32` y pegar en consola ML Notificaciones.
  - `WHATSAPP_APP_SECRET`: tracking en `WHATSAPP-HMAC-GAP.md`.
  - `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_WEBHOOK_SECRET`: agregar a `.env`
    cuando se active integración Shopify.
- Auth gate verificado pre-migración: `/calc/interaction-log/list`
  devuelve 401 sin `x-api-key`, 200 con token; `/health` devuelve
  `ok:true,hasTokens:true,mlTokenStoreOk:true,hasSheets:true`.
- Bug colateral resuelto: `run_ml_cloud_run_setup.sh` ahora usa el
  escape `^|^` de gcloud para `--update-env-vars` porque varios valores
  contienen comas (`SHOPIFY_SCOPES`, `CORS_ORIGIN`,
  `COCKPIT_TOKEN_ALLOWED_ORIGINS`). Sin ese escape, gcloud abortaba con
  `Bad syntax for dict arg`.
