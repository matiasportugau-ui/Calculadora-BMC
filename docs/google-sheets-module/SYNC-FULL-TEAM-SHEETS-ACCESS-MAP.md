# Full team sync — Dónde accede cada parte a la información de Sheets

**Canónico:** Documento vivo de **acceso por producto**; el detalle de columnas por pestaña está en [MAPPER-PRECISO-PLANILLAS-CODIGO.md](MAPPER-PRECISO-PLANILLAS-CODIGO.md). Índice del módulo: [README.md](README.md).

**Audiencia:** Mapping, Dashboard, Calculadora, GPT/Cloud, Integraciones, OmniCRM, Orquestador.  
**Objetivo:** Una sola vista de **quién lee qué** y **por qué ruta** (API del servidor vs Web App vs UI), para mantener **sync** entre planillas, código y documentación.

**Documentos canónicos (leer antes de cambiar columnas):**

| Documento | Rol |
|-----------|-----|
| [MAPPER-PRECISO-PLANILLAS-CODIGO.md](MAPPER-PRECISO-PLANILLAS-CODIGO.md) | Pestaña, fila de header, nombres de columna **según `bmcDashboard.js`** |
| [planilla-inventory.md](planilla-inventory.md) | Workbooks, tabs, rutas API de negocio |
| [VARIABLES-Y-MAPEO-UNO-A-UNO.md](VARIABLES-Y-MAPEO-UNO-A-UNO.md) | Variables extraíbles y verificación 1:1 |
| `omnicrm-sync/docs/INTERNAL-RUNBOOK.md` (repo hermano) | Extensión → Web App → pestaña `_targetSheet` |

---

## 1. Resumen ejecutivo — fuentes de verdad

| Capa | Fuente de datos Sheets | Cómo se accede hoy |
|------|------------------------|---------------------|
| **Dashboard Finanzas (HTML estático)** | Varios workbooks vía **API REST** del mismo origen que sirve `/finanzas` | `fetch('/api/...')` desde `docs/bmc-dashboard-modernization/dashboard/app.js` (ver §2) |
| **Backend BMC (Express)** | Google Sheets API usando `GOOGLE_APPLICATION_CREDENTIALS` + env `BMC_*_SHEET_ID` | `server/routes/bmcDashboard.js`, `server/routes/calc.js`, etc. |
| **Calculadora React (Vercel/local)** | Catálogo/precios: **MATRIZ** (CSV/API) + `constants` | `VITE_API_URL` → `GET /api/actualizar-precios-calculadora` (descarga CSV desde MATRIZ); botón “Cargar desde MATRIZ” en UI |
| **GPT / agente** | Mismo backend: `/calc/gpt-entry-point`, `/capabilities` | No lee Sheets directo; lee **API** que encapsula motor + catálogo |
| **OmniCRM Sync** | **Otro** flujo: POST JSON a **Web App** de Apps Script → append en pestaña configurada | No usa `bmcDashboard.js`; requiere `SPREADSHEET_ID` + pestaña alineada a headers del script |

**Regla de sync:** Si cambiás **nombre de columna o pestaña** en Google Sheets, actualizá **en el mismo cambio**: `bmcDashboard.js` (o mappers), **este doc §2–3**, y [MAPPER-PRECISO-PLANILLAS-CODIGO.md](MAPPER-PRECISO-PLANILLAS-CODIGO.md).

---

## 2. Dashboard Finanzas — `dashboard/app.js` → API → Sheets

**Archivo UI:** `docs/bmc-dashboard-modernization/dashboard/app.js`  
**Base URL:** `API_BASE = ''` → las peticiones van al **mismo host** que sirve el dashboard (p. ej. Cloud Run en `/finanzas/`). El servidor debe montar el router BMC en `/api`.

| Bloque UI / función | Ruta API | Datos de planilla (origen lógico) |
|---------------------|----------|-----------------------------------|
| Próximas entregas, coordinación | `GET /api/proximas-entregas` | `BMC_SHEET_ID` → `CRM_Operativo` **o** `Master_Cotizaciones` según `BMC_SHEET_SCHEMA` |
| Texto WhatsApp coordinación | `GET /api/coordinacion-logistica` (+ `?ids=` opcional) | Igual; filas de cotización |
| Finanzas: pagos, calendario, metas, KPIs por moneda | `GET /api/kpi-financiero` | `BMC_PAGOS_SHEET_ID` (primera pestaña) + `Metas_Ventas` en principal |
| Tabla audit | `GET /api/audit` | `AUDIT_LOG` en `BMC_SHEET_ID` |
| Ventas 2.0 | `GET /api/ventas` | `BMC_VENTAS_SHEET_ID` — **todas las pestañas** (proveedor = nombre de tab) |
| Calendario impuestos/vencimientos | `GET /api/calendario-vencimientos` | `BMC_CALENDARIO_SHEET_ID` (tab por mes o primera hoja) |
| Stock tabla | `GET /api/stock-ecommerce` | `BMC_STOCK_SHEET_ID` — **primera pestaña**, schema stock |
| KPI stock (números arriba) | `GET /api/stock-kpi` | Misma primera pestaña stock |
| KPI Report agregado (banner/meta) | `GET /api/kpi-report` | Agrega: pagos pendientes, próximas entregas, stock KPI, metas, **ventas** (todas las tabs) |
| Marcar entregado | `POST /api/marcar-entregado` | `Master_Cotizaciones` → append en “Ventas realizadas…” (flujo Master) |

**Nota:** Esta copia de `app.js` **no** llama a `GET /api/cotizaciones` ni `GET /api/pagos-pendientes` directamente en los `fetch` iniciales; el **snapshot financiero** viene de **`kpi-financiero`** (pagos + metas + resúmenes). Si agregás pantallas que listen cotizaciones crudas, el endpoint existe: `GET /api/cotizaciones`.

---

## 3. Backend — rutas principales ↔ workbook (resumen)

| Ruta | Env principal | Pestaña / resolución |
|------|---------------|----------------------|
| `GET /api/cotizaciones` | `BMC_SHEET_ID` | `CRM_Operativo` o `Master_Cotizaciones` |
| `GET /api/pagos-pendientes` | `BMC_PAGOS_SHEET_ID` o principal | Primera hoja **o** `Pagos_Pendientes` |
| `GET /api/metas-ventas` | Principal | `Metas_Ventas` |
| `GET /api/ventas` | `BMC_VENTAS_SHEET_ID` | Todas las tabs o `?tab=` |
| `GET /api/stock-ecommerce` | `BMC_STOCK_SHEET_ID` | Primera pestaña |
| `GET /api/stock/history` | Stock | `EXISTENCIAS_Y_PEDIDOS`, `Egresos` |
| `GET /api/calendario-vencimientos` | Calendario | Tab `MES AAAA` o primera |
| `GET /api/actualizar-precios-calculadora` | `BMC_MATRIZ_SHEET_ID` | Primera pestaña MATRIZ → CSV |
| `POST /api/cotizaciones` | Principal | Solo si `BMC_SHEET_SCHEMA=CRM_Operativo` → escribe `CRM_Operativo` |

Detalle de columnas: [MAPPER-PRECISO-PLANILLAS-CODIGO.md](MAPPER-PRECISO-PLANILLAS-CODIGO.md).

---

## 4. Calculadora (React) — acceso a MATRIZ

| Quién | Dónde | Información |
|-------|--------|----------------|
| Usuario en **Config / Listado de precios** | UI llama al backend configurado en `VITE_API_URL` | `GET /api/actualizar-precios-calculadora` descarga CSV generado desde **MATRIZ** (`buildPlanillaDesdeMatriz`) |
| Motor cotización | `constants.js` / datos inline | Deben **coincidir** con SKUs mapeados en `src/data/matrizPreciosMapping.js` y columnas MATRIZ |

**Sync:** Cambio de precio en **MATRIZ** → “Cargar desde MATRIZ” o script de sync → sin eso la UI puede quedar desalineada.

---

## 5. GPT / OpenAPI / Panelin

| Recurso | Ruta | Relación con Sheets |
|---------|------|---------------------|
| Entrada GPT | `GET /calc/gpt-entry-point` | Expone catálogo/motor; **no** lee Sheets en el cliente |
| Capacidades | `GET /capabilities` | Lista paths; MATRIZ/indirecto vía backend si el flujo cotiza |
| Cotizaciones CRM | Según `agentCapabilitiesManifest` | `GET/POST /api/cotizaciones` si el action está publicado |

**Sync:** Cambios en OpenAPI o GPT Actions deben alinearse con las mismas rutas que el servidor expone; drift → ver skill `panelin-gpt-cloud-system` y [MAPPER-PRECISO](MAPPER-PRECISO-PLANILLAS-CODIGO.md) para campos.

---

## 6. OmniCRM Sync (extensión Chrome)

| Componente | Acceso a datos |
|--------------|----------------|
| Extensión | **No** usa `/api` del dashboard para CRM; hace **POST** a **Web App** `https://script.google.com/macros/s/.../exec` |
| Apps Script | Escribe en el libro configurado en `SPREADSHEET_ID` + pestaña `_targetSheet` / default |

**Sync con BMC:** Si la pestaña debe ser la misma que **CRM_Operativo**, los **headers** del script OmniCRM deben coincidir con lo que querés en esa hoja **o** usar una pestaña dedicada (ej. `CRM BMC`) — ver [VARIABLES-Y-MAPEO-UNO-A-UNO.md §2.7](VARIABLES-Y-MAPEO-UNO-A-UNO.md).

---

## 7. Checklist de sincronización (full team)

1. **Env:** Todos los deploys (Cloud Run, local) comparten los mismos `BMC_*_SHEET_ID` y `BMC_SHEET_SCHEMA` esperados.
2. **Schema:** Producción con CRM operativo → `BMC_SHEET_SCHEMA=CRM_Operativo` (si no, el dashboard lee Master y POST cotizaciones falla).
3. **Credenciales:** `GOOGLE_APPLICATION_CREDENTIALS` válido; service account con acceso a los 5 workbooks + MATRIZ + libro OmniCRM si aplica.
4. **Documentación:** Cualquier cambio de columna → actualizar **MAPPER-PRECISO** + **planilla-inventory** + fila en **VARIABLES** si es variable de negocio.
5. **Dashboard:** Tras cambiar API, probar `fetch` desde la misma base URL que sirve `app.js`.
6. **OmniCRM:** Tras cambiar Web App, probar GET `/exec` y POST de prueba con `omni_key` si hay secreto.

---

## 8. Roles del equipo (quién mira qué)

| Rol / área | Documento / código principal |
|------------|------------------------------|
| **Mapping** | planilla-inventory, planilla-map, MAPPER-PRECISO, VARIABLES |
| **Dashboard UI** | `docs/bmc-dashboard-modernization/dashboard/app.js`, `index.html` |
| **Networks / deploy** | `.env` en servidor, `server/config.js` |
| **Calc** | `server/routes/calc.js`, MATRIZ en bmcDashboard `buildPlanillaDesdeMatriz` |
| **GPT/Cloud** | `server/gptActions.js`, `docs/openapi*.yaml`, `/capabilities` |
| **Integraciones / OmniCRM** | `omnicrm-sync`, Apps Script `omnicrm-apps-script-v1.1.gs` |
| **Orquestador / full team** | `docs/team/PROMPT-FOR-EQUIPO-COMPLETO.md`, `PROJECT-STATE.md` |

---

**Última actualización:** 2026-03-13  
**Fuente de verdad código:** `server/routes/bmcDashboard.js`, `server/config.js`, `docs/bmc-dashboard-modernization/dashboard/app.js`.
