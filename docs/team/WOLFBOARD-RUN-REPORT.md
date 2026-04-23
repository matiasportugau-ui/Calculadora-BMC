# WOLFBOARD-RUN-REPORT

**Fecha:** 2026-04-23  
**Branch:** `feature/wolfboard-crm`  
**Run orientado a:** Claude Code Terminal  
**Estado:** Fases 0–2 + 4 completas · Fase 3 (Drive wiring) pendiente

---

## Fases completadas

| # | Fase | Estado | Artefacto |
|---|------|--------|-----------|
| 0 | Pre-work: branch + env vars | ✅ | `.env.example`, `server/config.js` |
| 1a | `GET /api/wolfboard/pendientes` | ✅ | `sheets-api-server.js` |
| 1b | `POST /api/wolfboard/sync` | ✅ | `sheets-api-server.js` |
| 1c | `POST /api/wolfboard/row` | ✅ | `sheets-api-server.js` |
| 1d | `GET /api/wolfboard/export` (CSV) | ✅ | `sheets-api-server.js` |
| 1e | `POST /api/wolfboard/enviados` | ✅ | `sheets-api-server.js` |
| 2 | UI Wolfboard en dashboard | ✅ | `index.html`, `app.js`, `styles.css` |
| 3 | Drive link wiring (calc → J) | ⏳ TBD | Pendiente (ver abajo) |
| 4 | Este report | ✅ | `docs/team/WOLFBOARD-RUN-REPORT.md` |

---

## Mapa de código (Phase 1 inventory)

### Archivos existentes reutilizados

| Archivo | Uso en Wolfboard |
|---------|-----------------|
| `docs/bmc-dashboard-modernization/sheets-api-server.js` | Extendido con 5 endpoints + 6 helpers nuevos |
| `docs/bmc-dashboard-modernization/dashboard/index.html` | Sección `#wolfboard` + nav link + footer |
| `docs/bmc-dashboard-modernization/dashboard/app.js` | Módulo JS Wolfboard (~200 líneas) |
| `docs/bmc-dashboard-modernization/dashboard/styles.css` | Estilos Wolfboard (~80 líneas) |
| `server/lib/crmOperativoLayout.js` | Referencia para columnas AF/AH/AI/AK |
| `server/lib/crmRowParse.js` | Referencia para mapping de índices de columna |
| `server/ml-crm-sync.js` | Referencia para patrón de escritura CRM |
| `scripts/integrate-admin-cotizaciones.js` | Referencia para ID Admin 2.0 y tab name |

### Archivos nuevos/modificados en esta rama

| Archivo | Cambio |
|---------|--------|
| `.env.example` | +5 vars `WOLFB_*` |
| `server/config.js` | +6 keys wolfboard |
| `sheets-api-server.js` | +~260 líneas (helpers + 5 endpoints) |
| `dashboard/index.html` | +sección wolfboard + nav link |
| `dashboard/app.js` | +~200 líneas módulo JS |
| `dashboard/styles.css` | +~80 líneas estilos |
| `docs/team/WOLFBOARD-RUN-REPORT.md` | Nuevo (este archivo) |

---

## API Wolfboard — endpoints nuevos

Servidor: `npm run bmc-dashboard` → `http://localhost:3849`

| Método | Ruta | Body / Params | Respuesta |
|--------|------|--------------|-----------|
| `GET` | `/api/wolfboard/pendientes` | — | `{ ok, data: [{rowNum, H, I, J, K, sheetUrl}], total, pending }` |
| `POST` | `/api/wolfboard/sync` | `{ direction: "both"\|"admin_to_crm"\|"crm_to_admin" }` | `{ ok, dryRun, updatedAdmin, updatedCrm, skipped }` |
| `POST` | `/api/wolfboard/row` | `{ adminRow, respuesta?, link?, aprobado? }` | `{ ok, dryRun, adminRow, crmRow }` |
| `GET` | `/api/wolfboard/export` | — | CSV: `rowNum,H,I,J,K,sheetUrl` |
| `POST` | `/api/wolfboard/enviados` | `{ adminRow, force: true }` | `{ ok, dryRun, adminRow, movedToCrm }` |

**Sin config:** todos devuelven `503 { ok:false, error:"Wolfboard Sheets not configured..." }`.  
**Dry-run:** con `WOLFB_DRY_RUN=1`, sync y row devuelven diff sin escribir en Sheets.

---

## Variables de entorno requeridas

| Variable | Default en código | Descripción |
|----------|------------------|-------------|
| `WOLFB_ADMIN_SHEET_ID` | `1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0` | 2.0 Administrador de Cotizaciones |
| `WOLFB_ADMIN_TAB` | `Admin.` | Nombre de pestaña dentro del libro Admin 2.0 |
| `WOLFB_CRM_MAIN_TAB` | `CRM_Operativo` | Tab operativa en CRM (mismo libro que `BMC_SHEET_ID`) |
| `WOLFB_CRM_ENVIADOS_TAB` | `Enviados` | Tab de archivo en CRM |
| `WOLFB_DRY_RUN` | `` (off) | `"1"` = modo lectura, no escribe |
| `BMC_SHEET_ID` | (existente) | crm_automatizado (`1N-4ky...`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | (existente) | Path a service-account.json |

La cuenta de servicio debe tener acceso **Editor** en ambos libros:
- `1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0` (Admin 2.0)
- `BMC_SHEET_ID` (crm_automatizado)

---

## Auditoría ML ↔ CRM — veredicto

**Estado: `parcial`**

El flujo ML→CRM **ya existe** y está activo:
- `server/index.js:410-416` — webhook handler dispara `syncMLCRM` al recibir pregunta ML
- `server/ml-crm-sync.js` — escribe en tab `CRM_Operativo` (dentro de `BMC_SHEET_ID = 1N-4ky...`) columnas B-AK
- Deduplicación por `Q:{id}` en columna W (Observaciones)

Lo que **no está** conectado automáticamente:
- Admin 2.0 (`1Ie0K...`) ↔ CRM — solo existe el script CLI `scripts/integrate-admin-cotizaciones.js` (manual)
- Wolfboard añade el sync live bidireccional que faltaba

**Archivos a tocar para mejora futura:**
- `server/index.js:449` — webhook WA que ya escribe a `CRM_Operativo`; podría also sync Admin
- `scripts/integrate-admin-cotizaciones.js` — reemplazable por `/api/wolfboard/sync`

---

## Mapping de columnas Admin 2.0 ↔ CRM

```
Admin 2.0 (1Ie0K...)               CRM_Operativo (BMC_SHEET_ID, tab CRM_Operativo)
──────────────────────────────────  ──────────────────────────────────────────────
H  = consulta cliente        ←──→  G  = consulta text (pregunta, row[6])
I  = respuesta AI            ←──→  AF = respuestaSugerida (row[31])
J  = link presupuesto Drive  ←──→  AH = LINK_PRESUPUESTO (row[33])
K  = enviado (checkbox)             AI = APROBADO_ENVIAR (row[34])
```

**Clave de match en sync v1:** `normalizeText(H) === normalizeText(G)` (primeros 150 chars, lowercase).  
**Limitación:** si el texto fue editado entre libros, el match puede fallar → skipped++ en la respuesta del sync.

**Nota datos Admin 2.0:**
- Título merged en fila 1, headers en fila 2, datos desde fila 3 (`WOLFB_ADMIN_DATA_ROW=3` hardcodeado)
- Confirmar con Matias si el offset es correcto al hacer primer sync real

---

## Diseño arquitectura (diagrama)

```
Admin 2.0 (1Ie0K)           CRM crm_automatizado (BMC_SHEET_ID)
──────────────────          ──────────────────────────────────
H (consulta)    ←── sync ──→  G  (consulta text — read only)
I (respuesta)   ←── sync ──→  AF (respuestaSugerida)
J (link)        ←── sync ──→  AH (LINK_PRESUPUESTO)
K (enviado)     ──────────→   tab Enviados (on force=true)

Wolfboard UI (:3849/dashboard #wolfboard)
 ↕ fetch/POST
sheets-api-server.js (:3849)
 ├── GET  /api/wolfboard/pendientes
 ├── POST /api/wolfboard/sync
 ├── POST /api/wolfboard/row
 ├── GET  /api/wolfboard/export
 └── POST /api/wolfboard/enviados

ML (MercadoLibre)
 → server/index.js webhook
 → ml-crm-sync.js
 → CRM_Operativo (G+B-AK) — ya funciona, independiente del Wolfboard
```

---

## Fase 3: Drive link wiring (pendiente)

El guardado en Drive es **client-side** en la calculadora React (`src/utils/googleDrive.js` → `saveQuotation()` → retorna `folderUrl`).

**Integración propuesta (v2):**
1. Wolfboard UI establece `window._wolfboardActiveRow = rowNum` al abrir detalle
2. Al completar `handleDriveSave()` en `PanelinCalculadoraV3_backup.jsx:~4120`, si `window._wolfboardActiveRow` está seteado, auto-POST a `/api/wolfboard/row` con el `folderUrl`
3. Link queda en J (Admin) y AH (CRM) automáticamente

**Alternativa v1 (ya disponible):** el panel de detalle tiene campo "Link presupuesto Drive (J)" — el operador puede pegar manualmente la URL y guardar.

**Owner:** bmc-calc-specialist (integración en calculadora React)

---

## Seguridad — nota pre-existente

`docs/bmc-dashboard-modernization/service-account.json` está committed en el repo.  
**Acción requerida (PR separado):**
1. Agregar `docs/bmc-dashboard-modernization/service-account.json` a `.gitignore`
2. Revocar y regenerar la clave en Google Cloud Console
3. Mover el archivo a path local fuera del repo o usar GCS secrets en Cloud Run
4. Actualizar `GOOGLE_APPLICATION_CREDENTIALS` a la nueva ruta

---

## Puertas humanas abiertas (Human Gates)

| # | Pregunta | Impacto |
|---|----------|---------|
| HG-1 | ¿El nombre exacto de la pestaña "Enviados" en el CRM (`1N-4ky...`)? Default: `"Enviados"` | Endpoint `/enviados` fallará si el nombre es distinto |
| HG-2 | ¿Los datos en Admin 2.0 empiezan en fila 3 (default)? | Si empieza en fila 4, cambiar `WOLFB_ADMIN_DATA_ROW=4` en `.env` |
| HG-3 | ¿La cuenta de servicio ya tiene acceso Editor en Admin 2.0 (`1Ie0K...`)? | Requerido para sync y row writes |
| HG-4 | ¿El campo H en Admin 2.0 contiene el mismo texto que G en CRM? | Si hay divergencia, sync match fallará (skipped++) |

---

## Cómo probar en terminal (ritual día de trabajo)

```bash
# 1. Levantar servidor
npm run bmc-dashboard

# 2. Smoke test sin config
curl http://localhost:3849/api/wolfboard/pendientes
# → 503 {"ok":false,"error":"Wolfboard Sheets not configured..."}

# 3. Con vars configuradas en .env:
# WOLFB_ADMIN_SHEET_ID=1Ie0K...
# BMC_SHEET_ID=1N-4ky...
# GOOGLE_APPLICATION_CREDENTIALS=docs/bmc-dashboard-modernization/service-account.json
# WOLFB_DRY_RUN=1

# 4. Test pendientes
curl http://localhost:3849/api/wolfboard/pendientes
# → {"ok":true,"data":[...],"total":N,"pending":M}

# 5. Test sync (dry-run)
curl -X POST http://localhost:3849/api/wolfboard/sync \
  -H "Content-Type: application/json" \
  -d '{"direction":"both"}'
# → {"ok":true,"dryRun":true,"updatedAdmin":N,"updatedCrm":M,"skipped":K}

# 6. Export CSV
curl http://localhost:3849/api/wolfboard/export -o wolfboard-test.csv
# → CSV con rowNum,H,I,J,K,sheetUrl

# 7. UI en browser
open http://localhost:3849
# → Sección Wolfboard visible, tabla de pendientes, botón Sincronizar
```

---

## Próximos pasos

1. **Resolver HG-1 a HG-4** (Matias confirma tab names, offset, permisos)
2. **Primer sync dry-run real** con las vars configuradas en .env
3. **Primer sync real** (quitar `WOLFB_DRY_RUN`) sobre una copia/staging de las hojas
4. **Fase 3** Drive link wiring (bmc-calc-specialist, integración en calculadora)
5. **PR de seguridad** para remover service-account.json del repo
6. **Canales adicionales** (IG, FB, Email blocks en UI Wolfboard) — siguientes sprints

---

*Generado por Claude Code Terminal · branch `feature/wolfboard-crm` · 2026-04-23*
