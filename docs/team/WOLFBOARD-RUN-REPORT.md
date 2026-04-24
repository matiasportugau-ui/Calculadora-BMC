# WOLFBOARD-RUN-REPORT

**Fecha:** 2026-04-23 (actualización implementación H–K + CRM libro opcional + P0 presupuesto)  
**Estado:** Fases 0–4 + pipeline + endpoint presupuesto · columnas Admin alineadas a plan (H–K)

---

## Fases completadas

| # | Fase | Estado | Artefacto |
|---|------|--------|-----------|
| 0 | Pre-work: branch + env vars | ✅ | `.env.example`, `server/config.js` |
| 1a | `GET /api/wolfboard/pendientes` | ✅ | `sheets-api-server.js` |
| 1b | `POST /api/wolfboard/sync` | ✅ | Incluye CRM **G** compuesto (consulta + respuesta + link) salvo `WOLFB_SKIP_COMPOSED_G=1` |
| 1c | `POST /api/wolfboard/row` | ✅ | Admin **I/J** + CRM **AF/AH/AI** + **G** compuesto |
| 1d | `GET /api/wolfboard/export` (CSV) | ✅ | Cabecera `H_consulta,I_respuesta,J_link,K_enviado` |
| 1e | `POST /api/wolfboard/enviados` | ✅ | Marca **K=TRUE**, append pestaña **Enviados** en libro CRM, borra fila Admin |
| 1f | `GET /api/wolfboard/pipeline` | ✅ | Estado de env, tabs, IDs enmascarados, auditoría ML↔CRM resumida |
| 1g | `POST /api/wolfboard/presupuesto` | ✅ | P0: `{ adminRow, driveUrl \| link, respuestaText? }` → reutiliza `row` (J + CRM) |
| 2 | UI Wolfboard | ✅ | Tabla H–K, filtro **Canal** (Origen CRM F), sync al abrir sección |
| 2b | Aprobar respuesta | ✅ | `AI` en CRM |
| 3 | Drive → J (P0 mínimo) | ✅ v1 API | Calculadora puede `POST` presupuesto; pegado manual sigue válido |
| 4 | Este report | ✅ | `docs/team/WOLFBOARD-RUN-REPORT.md` |

---

## Mapa de código

| Archivo | Uso |
|---------|-----|
| `docs/bmc-dashboard-modernization/sheets-api-server.js` | Wolfboard: lectura `H:K`, CRM con `WOLFB_CRM_SHEET_ID` opcional, `pipeline`, `presupuesto` |
| `docs/bmc-dashboard-modernization/dashboard/index.html` | Sección Wolfboard + filtro canal |
| `docs/bmc-dashboard-modernization/dashboard/app.js` | Render filtrado, Invoque API list |
| `docs/bmc-dashboard-modernization/dashboard/styles.css` | Toolbar wrap + filtro |
| `server/config.js` | `wolfbCrmSheetId`, `wolfbAdminFirstDataRow` |

---

## API Wolfboard

Servidor: `npm run bmc-dashboard` → `http://localhost:3849`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/wolfboard/pendientes` | Pendientes (`K` ≠ TRUE), enriquecido con **Origen** (CRM F) |
| `GET` | `/api/wolfboard/pipeline` | JSON: configuración, columnas, endpoints, nota ML↔CRM |
| `POST` | `/api/wolfboard/sync` | `direction`: `both` \| `admin_to_crm` \| `crm_to_admin` |
| `POST` | `/api/wolfboard/row` | `adminRow`, `respuesta`, `link`, `aprobado` |
| `POST` | `/api/wolfboard/presupuesto` | `adminRow`, `driveUrl` o `link`, opcional `respuestaText` |
| `POST` | `/api/wolfboard/batch` | `{ items: [...] }` máx. 30 (misma forma que presupuesto por ítem) |
| `GET` | `/api/wolfboard/export` | CSV |
| `POST` | `/api/wolfboard/enviados` | `adminRow`, `force: true` |
| `POST` | `/api/wolfboard/setup-admin` | Data validation booleana en columna **K** (Enviado) |

**503** si falta `WOLFB_ADMIN_SHEET_ID` y (`BMC_SHEET_ID` o `WOLFB_CRM_SHEET_ID`) o credenciales.

---

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `WOLFB_ADMIN_SHEET_ID` | Libro Admin 2.0 |
| `WOLFB_ADMIN_TAB` | Pestaña (default `Admin.`) |
| `WOLFB_ADMIN_FIRST_DATA_ROW` / `WOLFB_ADMIN_DATA_ROW` | Primera fila de datos **H:K** (default `2`) |
| `WOLFB_CRM_SHEET_ID` | Libro **crm_automatizado** si difiere de `BMC_SHEET_ID` |
| `WOLFB_CRM_MAIN_TAB` | Default `CRM_Operativo` |
| `WOLFB_CRM_ENVIADOS_TAB` | Default `Enviados` |
| `WOLFB_SKIP_COMPOSED_G` | `1` = no reescribir **G** con bloques (solo AF/AH) |
| `WOLFB_DRY_RUN` | `1` = sin escritura |
| `BMC_SHEET_ID` | Fallback CRM si no hay `WOLFB_CRM_SHEET_ID` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account |

La cuenta de servicio necesita **Editor** en el libro Admin y en el libro CRM (y Drive si aplica a enlaces privados).

---

## Auditoría ML ↔ CRM

**Veredicto: `parcial`**

- **Conectado:** webhook / rutas ML → `server/ml-crm-sync.js` → `CRM_Operativo` en el libro configurado como `BMC_SHEET_ID`.
- **Wolfboard:** sincroniza **Admin 2.0 ↔ CRM** en el dashboard Sheets; no sustituye el webhook ML.
- **Coherencia:** si CRM vive en otro spreadsheet, definir **`WOLFB_CRM_SHEET_ID`** igual que el libro donde escribe `ml-crm-sync`, o mantener un solo `BMC_SHEET_ID` para ambos.
- **Motivos típicos de falla ML→CRM:** credenciales o `BMC_SHEET_ID` incorrectos; permisos sin Editor; cuota 429 Sheets; texto de pregunta vacío o no mapeable en `ml-crm-sync`.
- **Empuje Admin→CRM desde Wolfboard:** `POST /api/wolfboard/row`, `/presupuesto` o `/batch`; si no hay match H↔G, la API devuelve `warning` (no es un 200 “silencioso”).

Detalle ampliado también en `GET /api/wolfboard/pipeline` → `mlCrmAudit`.

---

## Run plan (fases 0–7) + dry-run Sheets

| Fase | Acción | Verificación |
|------|--------|--------------|
| 0 | `.env` con `WOLFB_*`, credenciales, opcional `WOLFB_DRY_RUN=1` | `GET /api/wolfboard/pipeline` → `configured: true` |
| 1 | `GET /api/wolfboard/pendientes` | `pending` ≥ 0, `originCounts` presente |
| 2 | `POST /api/wolfboard/sync` con `direction: "both"` | Respuesta con `updatedAdmin` / `updatedCrm` o `warning` si 0 cambios |
| 3 | `POST /api/wolfboard/row` (I/J) en fila de prueba | `crmRow` o `warning` explícito |
| 4 | `POST /api/wolfboard/presupuesto` con URL de prueba | J + CRM AH + G (si no `WOLFB_SKIP_COMPOSED_G`) |
| 5 | `POST /api/wolfboard/batch` con 2 ítems | `applied` acorde |
| 6 | UI `#wolfboard`: sync al scroll, filtro canal, click en fila | Panel detalle + guardar |
| 7 | Quitar dry-run en copia de hojas | Sync real y revisar celdas en Sheets |

**Dry-run:** con `WOLFB_DRY_RUN=1`, `sync` y `row`/`batch` no escriben; revisar `preview` o campos `dryRun: true`.

**Logs ritual:** `WOLFB_RITUAL_LOG=1` emite JSON-lines (`WOLFBOARD_SYNC`, `WOLFBOARD_ROW`, `WOLFBOARD_BATCH`, `WOLFBOARD_ENVIADOS`).

---

## Sync bidireccional CRM ↔ 2.0

- Al **entrar en vista** Wolfboard (`IntersectionObserver`), se ejecuta `POST /api/wolfboard/sync` con `direction: "both"` y luego recarga pendientes.
- El botón **Sincronizar** repite el mismo ritual.
- La respuesta incluye `bidirectional: true`, totales de filas y `warning` si no hubo coincidencias útiles.

---

## P0 pipeline + lote + trigger

- **Pipeline:** ver `p0BudgetPipeline` y `massTrigger` en `GET /api/wolfboard/pipeline`.
- **Lote:** `POST /api/wolfboard/batch` body `{ "items": [ { "adminRow": 3, "driveUrl": "...", "respuestaText": "..." } ] }` (máx. 30).
- **Trigger “nueva fila Admin”:** no incluido en este servidor; documentado como Apps Script / automatismo externo que llame a `/presupuesto` o `/batch`. Opcional: `WOLFB_CALC_API_BASE` para encadenar con `POST /calc/cotizar` en la API Panelin.

---

## UX omnicanal + aprobación

- **Origen:** API devuelve `originCounts`; la UI muestra franja de pastillas y filtro por canal.
- **Click en fila** de la tabla abre el mismo panel que “Ver / Editar”.
- **Aprobar:** deshabilitado si I está vacío; toast y panel si el backend devuelve `warning` (p. ej. sin match CRM).

---

## Mapping columnas (plan maestro)

**Admin 2.0** (`WOLFB_ADMIN_SHEET_ID`, pestaña `WOLFB_ADMIN_TAB`):

| Col | Contenido |
|-----|-----------|
| H | Consulta cliente (clave de match con CRM **G** primer bloque) |
| I | Respuesta IA / operador |
| J | Link presupuesto Drive |
| K | Enviado (checkbox) |

**CRM** (`WOLFB_CRM_SHEET_ID` o `BMC_SHEET_ID`, tab `CRM_Operativo`):

| Col | Contenido |
|-----|-----------|
| G | Cuerpo compuesto: `consulta` + `respuesta` + `link` separados por `\n\n---\n\n` (match sigue funcionando contra el primer bloque) |
| F | Origen (WA, EM, …) — usado en UI filtro |
| AF | Respuesta sugerida |
| AH | Link presupuesto |
| AI | Aprobado enviar |

**Match v1:** `normalizeText` sobre H y el **primer segmento** de G (antes de `---`) o G entero si aún no hay compuesto.

---

## Ritual prueba terminal

```bash
npm run bmc-dashboard
curl -s http://localhost:3849/api/wolfboard/pipeline | jq .
curl -s http://localhost:3849/api/wolfboard/pendientes | jq '.pending'
# Presupuesto (requiere filas reales y match CRM)
curl -s -X POST http://localhost:3849/api/wolfboard/presupuesto \
  -H "Content-Type: application/json" \
  -d '{"adminRow":3,"driveUrl":"https://drive.google.com/file/d/xxx/view","respuestaText":"Propuesta lista."}'

curl -s -X POST http://localhost:3849/api/wolfboard/batch \
  -H "Content-Type: application/json" \
  -d '{"items":[{"adminRow":3,"driveUrl":"https://drive.google.com/file/d/xxx/view"}]}'
```

---

## Integración calculadora (siguiente capa)

1. Tras `saveQuotation()` / URL Drive, llamar `POST /api/wolfboard/presupuesto` con `adminRow` activo (p. ej. `window.__wolfboardAdminRow` desde el detalle Wolfboard).
2. Alternativa ya soportada: pegar URL en el campo **J** en el panel y **Guardar en CRM**.

---

## Seguridad (nota preexistente)

`docs/bmc-dashboard-modernization/service-account.json` no debe permanecer versionado con claves reales; rotar claves y usar path local / secret manager.

---

*Actualizado: batch, ritual (`warning` + `WOLFB_RITUAL_LOG`), pipeline P0, auditoría ML ampliada, UX omnicanal — 2026-04-23*
