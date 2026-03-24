# PANELSIM — Informe de situación Sheets / API — 2026-03-23

**Generado:** 2026-03-23  
**Entorno probado:** API local `http://localhost:3001` (proceso `node server/index.js`).  
**Fuente documental:** `docs/google-sheets-module/planilla-inventory.md`, `SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md` (referencia).  
**Modo:** lectura vía rutas HTTP del servidor (no lectura manual de cada celda en el editor).

---

## 1. Resumen ejecutivo

| Área | Estado | Nota |
|------|--------|------|
| **Workbooks (5)** | Documentados en inventario | IDs públicos en `planilla-inventory` §0; service account `bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com` (doc). |
| **CRM / cotizaciones** | **OK** | `GET /api/cotizaciones` → **200**, **297 filas** en `data` con headers alineados a CRM_Operativo. |
| **KPI financiero / pagos / metas** | **OK** | `GET /api/kpi-financiero` → **200**, claves `pendingPayments`, `calendar`, `byPeriod`, `metas`, etc. |
| **KPI report** | **OK** | `GET /api/kpi-report` → **200**. |
| **Stock e-commerce** | **OK** | `GET /api/stock-ecommerce` → **200**. |
| **Próximas entregas** | **OK** | `GET /api/proximas-entregas` → **200**; `data` **vacío** en este instante (sin entregas listadas o filtro aplicado). |
| **Calculadora / GPT** | **OK** | `GET /calc/gpt-entry-point` → **200**; `data_version` presente. |
| **Mercado Libre (preguntas pendientes)** | **Bloqueado OAuth** | `GET /ml/questions` → **401** — `OAuth not initialized. Complete /auth/ml/start flow first.` |
| **Modo producción Cloud Run** | No probado en este informe | Smoke E2E en `E2E-VALIDATION-CHECKLIST.md` — validar aparte. |

---

## 2. Mapa de workbooks (referencia)

| Variable env | Uso principal (API / doc) |
|--------------|---------------------------|
| `BMC_SHEET_ID` | CRM, cotizaciones, entregas, audit |
| `BMC_PAGOS_SHEET_ID` | KPI financiero, pagos pendientes |
| `BMC_VENTAS_SHEET_ID` | Ventas |
| `BMC_STOCK_SHEET_ID` | Stock e-commerce |
| `BMC_CALENDARIO_SHEET_ID` | Calendario vencimientos |
| `BMC_MATRIZ_SHEET_ID` | MATRIZ costos/ventas → calculadora |

Detalle de tabs y columnas: `planilla-inventory.md`.

---

## 3. Muestra de datos vivos (sin PII innecesario)

- **Cotizaciones:** 297 registros; primera fila de ejemplo en respuesta incluye columnas estándar (ID, Fecha, Cliente, Consulta / Pedido, Estado, etc.).  
- **Próximas entregas:** 0 filas en `data` al momento del curl.  
- **KPI financiero:** estructura completa; no se adjunta tabla completa aquí por tamaño.

---

## 4. Mercado Libre — consultas pendientes

**Estado:** no disponible hasta inicializar OAuth.

**Pasos para PANELSIM (modo aprobación):**

1. Navegador: `http://localhost:3001/auth/ml/start` (o ruta documentada en `server/index.js`).
2. Completar flujo OAuth Mercado Libre.
3. `GET /ml/questions` — listar; proponer borradores; **no** `POST /ml/questions/:id/answer` sin confirmación explícita de Matias.

---

## 5. Riesgos / limitaciones

- **Local vs prod:** Este informe refleja **solo** el estado de la API en **localhost** con `.env` actual. Cloud Run puede devolver **503** si faltan credenciales Sheets en el deploy (comportamiento documentado en `AGENTS.md`).
- **“Leer todas las Sheets”:** En la práctica se hace mediante **rutas API** y scripts; no implica exportar todas las pestañas a markdown en un solo paso salvo que se implemente un script batch.
- **Auditoría:** `GET /api/audit` debe verificarse según necesidad; no expandido en esta corrida.

---

## 6. Referencias

- [`docs/team/AGENT-SIMULATOR-SIM.md`](../AGENT-SIMULATOR-SIM.md)
- [`matprompt/MATPROMT-HANDOFF-PANELSIM-2026-03-23.md`](../matprompt/MATPROMT-HANDOFF-PANELSIM-2026-03-23.md)
- [`docs/google-sheets-module/planilla-inventory.md`](../../google-sheets-module/planilla-inventory.md)
