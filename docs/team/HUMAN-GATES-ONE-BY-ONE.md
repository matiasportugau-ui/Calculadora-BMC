# Human gates — un paso por vez (Matias + agentes)

**Propósito:** máxima automatización en CLI/CI; cuando haga falta **tu** intervención, abrís **solo** la sección del bloqueo (`cm-0`, `cm-1` o `cm-2`) y seguís los pasos **en orden** (cada uno con **página/enlace** y **qué clicar**).

**Leyenda (igual que el runbook):** [`orientation/ASYNC-RUNBOOK-UNATTENDED.md`](./orientation/ASYNC-RUNBOOK-UNATTENDED.md) — **[H0]** una vez, **[H]** ocasional, **[A]** máquina.

**URL base canónica del API (smoke / prod):** la que devuelve `npm run smoke:prod -- --json` en `base`, o por defecto:

`https://panelin-calc-q74zutv7dq-uc.a.run.app`

*(Si en el futuro cambia, todo lo que sigue usa `TU_BASE` = esa URL sin barra final.)*

---

## Mapa rápido — enlaces directos (1 clic)

**Proyecto GCP (canónico en repo):** `chatbot-bmc-live` · **Región:** `us-central1` · **Servicio Cloud Run:** `panelin-calc` · **App Meta (nombre interno):** `chatbo2` · **App ID:** `4144439239205293` · **Phone Number ID (histórico en PROJECT-STATE):** `857133467479731` *(confirmar en Meta si Meta lo cambió).*

| Qué querés abrir | Enlace (pegá en el navegador) |
|------------------|--------------------------------|
| **Cloud Run — servicio `panelin-calc` (variables / revisiones)** | [Abrir panel del servicio](https://console.cloud.google.com/run/detail/us-central1/panelin-calc?project=chatbot-bmc-live) |
| **Cloud Run — lista (por si el servicio tiene otro nombre)** | [Lista Cloud Run](https://console.cloud.google.com/run?project=chatbot-bmc-live) |
| **Meta — dashboard de la app** | [App 4144439239205293](https://developers.facebook.com/apps/4144439239205293/) |
| **Meta — WhatsApp (configuración / webhook; UI puede decir Configuration o API Setup)** | [WhatsApp en la app](https://developers.facebook.com/apps/4144439239205293/whatsapp-business/wa-settings/) |
| **Meta — lista de apps (si el link directo falla)** | [Mis apps](https://developers.facebook.com/apps/) |
| **API público — health** | [GET /health](https://panelin-calc-q74zutv7dq-uc.a.run.app/health) |
| **OAuth ML — inicio (cuando toque cm-1)** | [GET /auth/ml/start](https://panelin-calc-q74zutv7dq-uc.a.run.app/auth/ml/start) |

**Cómo editar variables en Cloud Run (clics):** en la página del servicio → botón **EDITAR Y DESPLEGAR NUEVA REVISIÓN** (o **EDIT & DEPLOY NEW REVISION**) → pestaña **Variables y secretos** / **Variables & Secrets** → agregá o cambiá filas → **DESPLEGAR** / **DEPLOY** → esperá a que termine (1–3 min).

**Cómo pegar webhook en Meta (clics):** en WhatsApp del menú izquierdo → **Configuration** (o **API Setup**) → sección **Webhook** → **Callback URL** + **Verify token** → **Verify and save** → en **Webhook fields** activá **`messages`**.

---

## Cómo encajar esto en el día a día (rápido)

1. **Máquina primero:** `npm run channels:automated` (o `-- --write` para `.channels/last-pipeline.json`).
2. Mirá en el JSON: `humanGate.firstBlockingTask.id` → **cm-0**, **cm-1** o **cm-2**.
3. Abajo, **solo** esa sección. **No** marques tareas `done` en el programa maestro hasta cumplir el **“Listo cuando”** (evidencia).

---

## Bloque **cm-0** — WhatsApp (Meta) + teléfono + planilla

**Humano:** Meta (webhook + token) + un mensaje desde WhatsApp; **máquina:** curl, logs, smoke.

**Docs largos:** [`WHATSAPP-META-E2E.md`](./WHATSAPP-META-E2E.md).

### Paso 1 — Entrar al panel de la app (Meta)

1. **Clic directo:** [App Meta 4144439239205293](https://developers.facebook.com/apps/4144439239205293/) (si no abre: [lista de apps](https://developers.facebook.com/apps/) → buscá **chatbo2** o el nombre actual).
2. Iniciá sesión con la cuenta que administra la app (Business / Meta).

### Paso 2 — Producto WhatsApp

1. **Clic directo:** [WhatsApp en esta app](https://developers.facebook.com/apps/4144439239205293/whatsapp-business/wa-settings/).
2. Si no ves WhatsApp en el menú: **Add product** → **WhatsApp** → seguir asistente.

### Paso 3 — Webhook

1. En la pantalla de WhatsApp, menú izquierdo o pestañas: **Configuration** o **API Setup** (según versión de Meta).
2. Sección **Webhook**:
   - **Callback URL:** `https://panelin-calc-q74zutv7dq-uc.a.run.app/webhooks/whatsapp`  
     (sustituí `TU_BASE` si tu smoke usa otra base).
   - **Verify token:** el **mismo** string que `WHATSAPP_VERIFY_TOKEN` en Cloud Run (o `.env` del servicio que recibe el webhook).
3. **Verify and save**. Si falla: token distinto entre Meta y Cloud Run → corregir uno de los dos lados **antes** de reintentar (orden recomendado: **primero** Cloud Run, **después** Meta).

### Paso 4 — Suscripción `messages`

1. En la misma zona de webhook o **Webhook fields**, activá / suscribí el campo **`messages`** (mensajes entrantes).

### Paso 5 — Variables en Cloud Run (si aún no coinciden)

1. **Clic directo:** [Servicio `panelin-calc` en Cloud Run](https://console.cloud.google.com/run/detail/us-central1/panelin-calc?project=chatbot-bmc-live).
2. Arriba: **EDITAR Y DESPLEGAR NUEVA REVISIÓN** → **Variables y secretos** → revisá o agregá filas.
3. Confirmá al menos: `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `BMC_SHEET_ID`, credenciales Google, claves IA.
4. **Desplegá** y esperá a verde.

### Paso 6 — Verificación GET (sin teléfono)

En terminal (reemplazá `TU_TOKEN` por el verify token real):

```bash
curl -sS "https://panelin-calc-q74zutv7dq-uc.a.run.app/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=TU_TOKEN&hub.challenge=OK_META"
```

**Listo cuando:** respuesta HTTP **200** y cuerpo exactamente `OK_META`.

### Paso 7 — Teléfono (cliente → número API)

1. Desde un WhatsApp de prueba, escribí al **número conectado a la API** (Phone Number ID configurado).
2. O bien esperá **~5 min** sin nuevos mensajes (disparo por inactividad), o mandá **🚀** en el texto si querés disparo inmediato (según comportamiento desplegado).

### Paso 8 — Planilla Google

1. Abrí la planilla **2.0 Administrador** (ID desde `BMC_SHEET_ID`, no pegar en chat).
2. Revisá **Form responses 1** y **CRM_Operativo**: fila nueva con origen **WA-Auto** (o equivalente) y diálogo coherente.

**Listo cuando:** una fila verificada con **WA-Auto** (o fallo documentado con enlace a logs Cloud Run).

**Cierre:** marcar **cm-0** `done` en [`orientation/programs/bmc-panelin-master.json`](./orientation/programs/bmc-panelin-master.json) + una línea en [`SESSION-WORKSPACE-CRM.md`](./SESSION-WORKSPACE-CRM.md).

---

## Bloque **cm-1** — Mercado Libre OAuth (navegador) + tokens en prod

**Humano:** autorizar en Mercado Libre una vez (o hasta que `GET /auth/ml/status` sea coherente); **máquina:** `npm run ml:verify`, scripts.

**Docs largos:** [`docs/ML-OAUTH-SETUP.md`](../ML-OAUTH-SETUP.md).

### Paso 1 — Portal Developers ML

1. Abrí: **https://developers.mercadolibre.com.uy**
2. **Iniciar sesión** con la cuenta de vendedor.
3. **Mis aplicaciones** → elegí la app BMC (o creala según §1 del doc ML).

### Paso 2 — Redirect URI (debe coincidir con Cloud Run)

1. En la app, editá **URLs de redirección** (o equivalente).
2. Incluí **exactamente** (sin barra extra al final):

`https://panelin-calc-q74zutv7dq-uc.a.run.app/auth/ml/callback`

   Si tu servicio real es otro host, usá `TU_BASE/auth/ml/callback` (mismo host que `smoke:prod`).

3. Guardá. Copiá **App ID** y **Secret** → deben estar en Cloud Run como `ML_CLIENT_ID` y `ML_CLIENT_SECRET`.

### Paso 3 — Variables en Cloud Run

1. **Clic directo:** [panelin-calc — variables](https://console.cloud.google.com/run/detail/us-central1/panelin-calc?project=chatbot-bmc-live) → **EDITAR Y DESPLEGAR NUEVA REVISIÓN** → **Variables y secretos**: `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, y si usás bucket de tokens: `ML_TOKEN_GCS_BUCKET`, `TOKEN_ENCRYPTION_KEY`, `ML_TOKEN_STORAGE=gcs` (ver [`ML-OAUTH-SETUP.md`](../ML-OAUTH-SETUP.md) §6–7).

### Paso 4 — Iniciar OAuth en el navegador (producción)

1. Abrí **una sola pestaña** y pegá:

`https://panelin-calc-q74zutv7dq-uc.a.run.app/auth/ml/start`

2. Aceptá permisos en Mercado Libre (2FA / Mercado Pago si pide).
3. Deberías terminar en callback con JSON tipo `ok: true` (o pantalla de éxito según versión).

### Paso 5 — Verificación (CLI)

Con API apuntando a prod (o local si estás probando local):

```bash
npm run ml:verify
```

O manual: `GET https://panelin-calc-q74zutv7dq-uc.a.run.app/auth/ml/status` → **200** con token presente (no **404** “sin token”).

**Listo cuando:** `GET /auth/ml/status` en **prod** refleja sesión válida **y** `GET /ml/questions` (o el endpoint que el equipo definió) no falla por OAuth.

**Cierre:** `cm-1` en JSON maestro + SESSION.

---

## Bloque **cm-2** — Correo (snapshot) → ingest → CRM

**Humano:** revisar **una** ingesta real y la fila en CRM; **máquina:** sync IMAP, dry-run, dedupe.

**Docs:** [`PROCEDIMIENTO-CANALES-WA-ML-CORREO.md`](./PROCEDIMIENTO-CANALES-WA-ML-CORREO.md) Fase 3; skill correo: `.cursor/skills/panelsim-email-inbox/SKILL.md`.

### Paso 1 — Snapshot en disco

1. Desde este repo: `npm run panelsim:email-ready` **o** el flujo del repo hermano de correo hasta existir `data/snapshot-latest.json` (o la ruta en `BMC_EMAIL_SNAPSHOT_PATH`).

### Paso 2 — API local con `.env`

1. `npm run start:api` con IA + `GOOGLE_APPLICATION_CREDENTIALS` + `BMC_SHEET_ID`.

### Paso 3 — Dry-run (obligatorio antes de real)

```bash
npm run email:ingest-snapshot -- --dry-run --limit 5
```

### Paso 4 — Una fila real

```bash
npm run email:ingest-snapshot -- --limit 1
```

### Paso 5 — Planilla

1. Abrí **CRM_Operativo** en Google Sheets y revisá la fila creada/actualizada.

**Listo cuando:** al menos **una** ingesta real revisada y aceptada (o error documentado con causa).

**Cierre:** `cm-2` en JSON maestro + SESSION + `PROJECT-STATE` si aplica.

---

## Agente en navegador (Cursor)

Para **OAuth** o **Meta**: podés usar el **browser MCP** de Cursor para abrir las URLs de arriba y navegar; **vos** completás login, 2FA y permisos. El agente no reemplaza **[H0]** en secretos; solo reduce clics erróneos.

---

## Referencias cruzadas

| Recurso | Archivo |
|---------|---------|
| Orden WA → ML → Correo | [`PROCEDIMIENTO-CANALES-WA-ML-CORREO.md`](./PROCEDIMIENTO-CANALES-WA-ML-CORREO.md) |
| Leyenda [A]/[H] | [`orientation/ASYNC-RUNBOOK-UNATTENDED.md`](./orientation/ASYNC-RUNBOOK-UNATTENDED.md) |
| Programa maestro | [`orientation/programs/bmc-panelin-master.json`](./orientation/programs/bmc-panelin-master.json) |
| Regla Cursor (agentes) | [`../../.cursor/rules/human-gates-bmc.mdc`](../../.cursor/rules/human-gates-bmc.mdc) |
