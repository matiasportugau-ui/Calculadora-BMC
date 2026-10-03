# HITL Dashboard Sync — Admin. ⇄ bmc-cola-hitl

Fecha de creación: 2026-10-02 · Autor: Cursor cloud agent · Owner: Matías Portugau

## 1. Problema

- **SoT de cotizaciones pendientes:** Google Sheet `1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0`, tab `Admin.` (punto final incluido).
- **Vista viva:** https://bmc-cola-hitl-matprompts-projects.vercel.app (proyecto Vercel `bmc-cola-hitl` / `prj_YA3nZO0jXt9i3Rt2MceJ4ekRh4Wg`).
- La vista viva venía alimentada por un `board.json` que solo cubría ~7 QIDs de los packs ML HITL. En la planilla hay ~47 filas accionables (Estado ∈ { Cotizable, Pendiente, Falta info, Asignado, Reclamo }). Las ediciones en el dashboard tampoco volvían a la planilla.
- Objetivo: unificar la planilla y la vista viva, con sincronía bidireccional near-real-time.

## 2. Arquitectura

```
                       Admin. sheet (SoT)
            1Ie0KCpg…   tab Admin.   A:M layout
                              │
       lectura service-account │ (GOOGLE_APPLICATION_CREDENTIALS)
                              ▼
   Calculadora-BMC API  ──  /api/hitl/*  (este repo, Cloud Run)
          ▲   │                 │
   token  │   │  escritura cell │
          │   ▼                 ▼
     bmc-cola-hitl (Vercel)  Admin. sheet
     poll GET /api/hitl/board (≤60s, ETag → 304)
     POST /api/hitl/row/update (write-back)
```

- La planilla sigue siendo book of record.
- `Calculadora-BMC` expone el bridge HTTP; `bmc-cola-hitl` lo consume (sin cambios de pipeline interna).
- Mapper puro en `server/lib/hitlAdminBoard.js`; router en `server/routes/hitlBoard.js`.

## 3. Endpoints

Todos bajo `/api/hitl/*`. Auth: `requireServiceOrUser({ role: "admin" })` — acepta Bearer `API_AUTH_TOKEN` o JWT de identity con rol `admin`.

| Método | Ruta | Qué hace |
|--------|------|----------|
| `GET`  | `/api/hitl/health` | Probe público — no lee planilla. Reporta sheet_id configurado, tab, origins allowlisted, dry-run. |
| `GET`  | `/api/hitl/board` | Snapshot JSON completo de filas accionables (Estado ≠ "Enviado"/blanco). Devuelve `ETag` sobre el payload accionable; respeta `If-None-Match` → `304 Not Modified`. `Cache-Control: private, max-age=15`. |
| `GET`  | `/api/hitl/board.json` | Proyección flat compatible con el `board.json` histórico (`qid`, `title`, `url`, `status`, …). Permite al dashboard reemplazar la fuente sin reescribir el UI. |
| `POST` | `/api/hitl/row/update` | Write-back a Admin. Body: `{ admin_row, estado?, respuesta?, link?, replay_snapshot_url? }`. Sanitiza y escribe en L/J/K/M. Respeta `WOLFB_DRY_RUN=1` + `?dry_run=1`. |

### Snapshot shape (`GET /api/hitl/board`)

```jsonc
{
  "ok": true,
  "generated_at": "2026-10-02T20:37:06.451Z",
  "etag": "W/\"a9903e8…\"",
  "sheet_id": "1Ie0KCpg…",
  "tab": "Admin.",
  "counts": {
    "sheet_rows": 3827,       // total rows A2:M in the live sheet
    "mapped": 3827,
    "actionable": 47,         // ← full pending set the dashboard needs
    "by_estado": { "cotizable": 17, "pendiente": 20, "falta info": 8, "reclamo": 1, "asignado": 1, "enviado": 7, "(blank)": 3773 }
  },
  "items": [
    {
      "admin_row": 34,
      "id": "Roger Pan De Azúcar",
      "fecha": "2026-09-08",
      "cliente": "Roger Pan De Azúcar",
      "canal": "WhatsApp",
      "zona": "Pan de Azúcar",
      "consulta": "WA: telegrama ANTEL…",
      "title": "WA: telegrama ANTEL…",
      "respuesta_ai": "",
      "link": "",
      "estado": "Reclamo",
      "estado_normalized": "reclamo",
      "actionable": true,
      "priority": 0,              // Reclamo first; Pendiente last
      "replay_snapshot_url": "",
      "ml_qid": "",               // extracted from "— Q:…" trailer when present
      "ml_mlu": "",
      "listing_url": "",
      "admin_sheet_url": "https://docs.google.com/spreadsheets/d/…/edit",
      "admin_tab": "Admin."
    }
  ]
}
```

### Row shape → write-back mapping

| Field in body        | Admin. col | Alias accepted           | Max chars |
|----------------------|-----------:|--------------------------|----------:|
| `estado`             | L          | —                        | 80        |
| `respuesta`          | J          | `respuesta_ai`           | 4000      |
| `link`               | K          | —                        | 2048      |
| `replay_snapshot_url`| M          | —                        | 2048      |

All values pass through `sanitizeCellValue` (`server/lib/sheetsCsvGuard.js`) so leading `=/+/-/@` are escaped — the write uses `USER_ENTERED`.

**`link` field provenance (service-auth, not GIS):** the string the dashboard
passes in `link` MUST come from the canonical server-side Drive archive path
(`POST /api/quotes/drive-archive` → `GOOGLE_DRIVE_REFRESH_TOKEN` +
`DRIVE_QUOTE_FOLDER_ID` shared folder) or from the public GCS
`bmc-cotizaciones` HTML/PDF. **No desktop OAuth / GIS popup / device-code
flow is supported for agents or the HITL dashboard.** See §11.

## 4. Sync latency

| Dirección | Mecanismo | Latencia típica |
|-----------|-----------|-----------------|
| Admin → dashboard | Dashboard **polls** `GET /api/hitl/board` cada 30–60 s. ETag + `max-age=15` corta payloads cuando no cambia nada. | ≤60 s |
| Dashboard → Admin | `POST /api/hitl/row/update` escribe inmediatamente (una `batchUpdate`). | <2 s |
| Push true desde Sheets | Opcional — Apps Script installable trigger `onEdit`/`onChange` que pegue a `/api/hitl/invalidate` (no implementado todavía; polling es suficiente para la cadencia operativa actual). | — |

Push verdadero desde la planilla no es obligatorio para el flujo actual; se puede capitalizar más tarde con un trigger Apps Script instalable que haga `UrlFetchApp.fetch` a un endpoint de invalidación. Documentado como extensión en §7.

## 5. Secrets / env vars

Variables requeridas (reutilizan las ya existentes de wolfboard):

| Var | Dónde se setea | Valor |
|-----|----------------|-------|
| `WOLFB_ADMIN_SHEET_ID` | Doppler / Cloud Run secret / `.env` | `1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0` |
| `WOLFB_ADMIN_TAB` | idem | `Admin.` (con el punto) |
| `GOOGLE_APPLICATION_CREDENTIALS` | idem | ruta o JSON inline de la service-account con scope `https://www.googleapis.com/auth/spreadsheets`. **La SA debe estar compartida como editor en el workbook.** |
| `API_AUTH_TOKEN` | idem | token Bearer que usa el dashboard para llamar al bridge |
| `HITL_DASHBOARD_ORIGINS` | **nueva** | CSV de orígenes browser permitidos. Ej: `https://bmc-cola-hitl-matprompts-projects.vercel.app` |
| `WOLFB_DRY_RUN` | opcional | `1` para forzar modo read-only (útil en staging) |

## 6. Habilitar el bridge

1. **Secrets ya configurados en Cloud Run.** Confirmar en el servicio `panelin-calc`:
   ```bash
   gcloud run services describe panelin-calc --region us-central1 \
     --format='value(spec.template.spec.containers[0].env)' | tr ',' '\n' \
     | grep -E 'WOLFB_ADMIN|GOOGLE_APPLICATION_CREDENTIALS|API_AUTH_TOKEN|HITL_DASHBOARD_ORIGINS'
   ```
2. **Agregar `HITL_DASHBOARD_ORIGINS`** si falta:
   ```bash
   gcloud run services update panelin-calc --region us-central1 \
     --update-env-vars HITL_DASHBOARD_ORIGINS=https://bmc-cola-hitl-matprompts-projects.vercel.app
   ```
3. **Verificar probe:**
   ```bash
   curl -s https://<panelin-calc-url>/api/hitl/health | jq
   ```
4. **Verificar lectura:**
   ```bash
   curl -s -H "Authorization: Bearer $API_AUTH_TOKEN" \
     https://<panelin-calc-url>/api/hitl/board | jq '.counts'
   ```
   Debe mostrar `actionable` cercano a la cuenta operativa (al 2026-10-02, 47).
5. **Verificar write (dry-run):**
   ```bash
   curl -s -X POST -H "Authorization: Bearer $API_AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     "https://<panelin-calc-url>/api/hitl/row/update?dry_run=1" \
     -d '{"admin_row": 42, "estado": "Cotizable"}'
   ```

## 7. Cómo lo consume `bmc-cola-hitl` (Vercel)

El repo de Vercel vive separado; propuesta mínima para integrarlo sin reescribirlo:

1. Agregar dos env vars al proyecto Vercel:
   - `HITL_API_BASE` = `https://<panelin-calc-url>` (prod Cloud Run)
   - `HITL_API_TOKEN` = valor de `API_AUTH_TOKEN`
2. En el handler que hoy sirve `board.json`, reemplazar la lectura local por:
   ```js
   const r = await fetch(`${process.env.HITL_API_BASE}/api/hitl/board.json`, {
     headers: { Authorization: `Bearer ${process.env.HITL_API_TOKEN}` },
     cache: "no-store",
   });
   const data = await r.json();
   ```
   El shape `items[]` es compatible con el consumer actual (`qid`, `title`, `url`, `status`, `cliente`, `canal`, `zona`, `consulta`, `respuesta_ai`, `link`).
3. Para write-back desde el UI (botón "Guardar estado"):
   ```js
   await fetch(`${process.env.HITL_API_BASE}/api/hitl/row/update`, {
     method: "POST",
     headers: {
       Authorization: `Bearer ${process.env.HITL_API_TOKEN}`,
       "Content-Type": "application/json",
     },
     body: JSON.stringify({ admin_row, estado, respuesta, link }),
   });
   ```
4. Para cola-vista cliente-side, usar el endpoint rico `GET /api/hitl/board` + `ETag` + `If-None-Match` para evitar re-render innecesarios.

## 8. Extensión opcional — push desde Sheets

Si en el futuro se quiere evitar polling:

1. En Admin., abrir Extensiones → Apps Script y pegar:
   ```js
   function onEditTrigger(e) {
     const payload = {
       sheet_id: e.source.getId(),
       sheet: e.range.getSheet().getName(),
       row: e.range.getRow(),
       col: e.range.getColumn(),
       ts: new Date().toISOString(),
     };
     UrlFetchApp.fetch(PropertiesService.getScriptProperties().getProperty("HITL_INVALIDATE_URL"), {
       method: "post",
       contentType: "application/json",
       payload: JSON.stringify(payload),
       headers: { Authorization: "Bearer " + PropertiesService.getScriptProperties().getProperty("HITL_INVALIDATE_TOKEN") },
       muteHttpExceptions: true,
     });
   }
   ```
2. Crear un installable trigger `onEdit` (Triggers → Add Trigger → `onEditTrigger` → Event source "From spreadsheet" → "On edit").
3. Guardar `HITL_INVALIDATE_URL` y `HITL_INVALIDATE_TOKEN` en Script Properties.
4. Agregar un endpoint liviano `POST /api/hitl/invalidate` que marque un cache miss para los próximos `/board` reads (fuera de scope de este PR; polling cada 30–60 s cubre el flujo actual).

## 9. Dry-run local

Para verificar la proyección sin tocar la planilla (ni correr el stack):

```bash
# contra el CSV live export (reproduce lo que verá bmc-cola-hitl):
node scripts/hitl-sync-dryrun.mjs \
  --csv uploads/admin-live-2026-10-02.csv --limit 10 --compat

# contra la planilla real (requiere GOOGLE_APPLICATION_CREDENTIALS + WOLFB_ADMIN_SHEET_ID):
WOLFB_ADMIN_SHEET_ID=1Ie0KCpg… \
GOOGLE_APPLICATION_CREDENTIALS=/secrets/sa.json \
node scripts/hitl-sync-dryrun.mjs --sheet
```

El CSV sample (admin-live-2026-10-02) proyecta **47 filas accionables**, consistente con el inventario manual de pendientes (`uploads/inventario-presupuestos-pendientes.md`).

## 10. Tests

- `tests/hitlAdminBoard.test.js` — mapper, filtro accionable, ETag estable, validación de patch.
- `tests/hitlBoardRoutes.test.js` — rutas: health abierto, auth 401, ENV_MISSING 503, dry-run write path, validación 400, CORS allowlist.
- Ambos están incluidos en `npm run test:api` (y por lo tanto en `gate:local`).

## 11. Drive integration — service-auth only (agents / dashboard / MCP)

**Guardrail (voice 2026-10-02):** the HITL dashboard, Panelin agents, and the
`bmc-grok-mcp` MCP server **MUST NOT** depend on desktop OAuth, device-code
flow, or the browser GIS popup for Drive. Every quote archive / Drive read
from automated or server-side callers goes through the service-auth endpoints
already shipped in this repo.

### Canonical path (don't invent a parallel one)

| Need | Endpoint | Auth | Backing secret |
|------|----------|------|----------------|
| Archive **PDF + `.bmc.json`** of a quote into the Panelin Drive folder | `POST /api/quotes/drive-archive` | `requireServiceOrUser({ authOnly: true })` → Bearer `API_AUTH_TOKEN` or admin JWT | `GOOGLE_DRIVE_CLIENT_ID` + `GOOGLE_DRIVE_CLIENT_SECRET` + `GOOGLE_DRIVE_REFRESH_TOKEN` + `DRIVE_QUOTE_FOLDER_ID` (shared folder "Panelin BMC Cotizaciones") |
| Read the `.bmc.json` behind an Admin.AO "🧮 openDrive" link | `GET /api/quotes/drive-project?folderId=…` | public-ish (folder id is the secret) — uses server OAuth under the hood | same four Drive env vars |
| Push PDFs into Drive from the Panelin chat / voice agent | agent tool `archivar_pdfs_drive` (wraps the endpoint above) | agent surface + `user_confirmed` gate | same four Drive env vars |

Why this is the only supported pattern:

- The Panelin BMC Cotizaciones folder is a **shared folder** owned by a human
  (not the SA). The server OAuth refresh token is scoped to a user that has
  edit access, so there is no "SA has no My Drive quota" problem and no need
  for Workspace-wide delegation.
- All agents (Cloud Run calls, MCP tools, HITL dashboard write-back) share
  the same Bearer secret pulled from Doppler / Secret Manager. No per-user
  OAuth state has to live in Vercel, in the MCP, or in the chat worker.
- Operators are explicitly out of the Drive OAuth loop; there is no "connect
  your Google account" ritual to onboard a new agent.

### How this plugs into the HITL bridge

`POST /api/hitl/row/update` writes a string into **column K** (`link`). That
string **must** be a URL produced by the canonical archive path above —
typically either:

- the Drive file URL returned by `POST /api/quotes/drive-archive`, or
- the public GCS `bmc-cotizaciones` URL for the HTML/PDF snapshot (already
  used across `wolfboard` + `adminQuoteLinks`).

The dashboard should NEVER:

- open a Google Sign-In popup / GIS flow to the operator before writing;
- call Drive directly from the browser;
- store any per-operator Drive OAuth token in the dashboard session.

If the dashboard needs to archive a PDF end-to-end on behalf of the operator,
it forwards the PDF to `POST /api/quotes/drive-archive` with the same Bearer
token it already uses for `/api/hitl/row/update`, then feeds the returned
URL back into `/api/hitl/row/update` with `{ admin_row, link }`. One secret,
one flow, zero popups.

### Env vars (Doppler / Cloud Run secrets)

| Var | Purpose |
|-----|---------|
| `GOOGLE_DRIVE_CLIENT_ID` | OAuth client that owns the refresh token |
| `GOOGLE_DRIVE_CLIENT_SECRET` | same |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | long-lived refresh token for the human account that has edit access to the shared folder |
| `DRIVE_QUOTE_FOLDER_ID` | shared folder "Panelin BMC Cotizaciones" |
| `API_AUTH_TOKEN` | Bearer used by all agent/dashboard callers |

These are **separate** from `GOOGLE_APPLICATION_CREDENTIALS` (service account
for Sheets). The two auth paths are intentional: Sheets uses the SA, Drive
uses the shared-folder OAuth refresh token.

### Verification

```bash
# 1. Confirm the Drive secret quartet is wired in Cloud Run
gcloud run services describe panelin-calc --region us-central1 \
  --format='value(spec.template.spec.containers[0].env)' | tr ',' '\n' \
  | grep -E 'GOOGLE_DRIVE_|DRIVE_QUOTE_FOLDER_ID'

# 2. Smoke the archive endpoint (service token)
curl -s -X POST "https://<api>/api/quotes/drive-archive" \
  -H "Authorization: Bearer $API_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pdfBase64":"<base64>","projectData":{"_meta":{"quotationCode":"TEST-R999"}},"quotationCode":"TEST-R999"}'

# 3. Read it back via the AO openDrive deep-link (no auth popup):
curl -s "https://<api>/api/quotes/drive-project?folderId=<returned-folder-id>" | jq
```

## 12. Qué queda abierto

- Un endpoint liviano `POST /api/hitl/invalidate` + trigger Apps Script si queremos matar el polling. No bloquea el objetivo actual.
- Opcional: emitir SSE desde `/api/hitl/stream` para dashboards con conexión persistente — también posterior.
- `bmc-cola-hitl` requiere la aplicación del cambio del lado Vercel (fetch del nuevo endpoint); documentado en §7.
