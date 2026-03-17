# Strategic Review — Full System Synchronicity with Google Sheets

**Purpose:** Evaluate current Sheets configuration, identify gaps, and propose a structure to use Sheets as the **central database** for all BMC functionalities with full GET/PUSH synchronicity.

**Based on:** Full Sheets Audit (FULL-SHEETS-AUDIT-REPORT.md, FULL-SHEETS-AUDIT-RAW.json)

---

## 1. Current State Assessment

### 1.1 What We Have (Read Access)

| Area | Workbooks | Tabs Used | Data Quality | Gaps |
|------|-----------|-----------|--------------|------|
| **CRM / Cotizaciones** | crm_automatizado | CRM_Operativo | Good; header offset 2 | Parametros, Dashboard, Automatismos not consumed |
| **Pagos** | Pagos 2026 | Pendientes_ | Good | Listos_ (historical) not used; column D/E duplicate headers |
| **Ventas** | 2.0 Ventas | First tab only | Partial | 22 proveedor tabs not iterated; repeated headers in data |
| **Stock** | Stock E-Commerce | First tab | Good | 6 other tabs (EXISTENCIAS, Egresos, etc.) not used |
| **Calendario** | Calendario | First tab | Generic | 45 monthly/thematic tabs not consumed |

### 1.2 What We Push (Write Access)

| Action | Target | Frequency |
|--------|--------|-----------|
| marcar-entregado | Ventas realizadas (Master schema) | On user action |
| — | — | **No other writes** |

### 1.3 Structural Issues

1. **Multi-workbook fragmentation:** 5 separate workbooks, no single source of truth.
2. **Inconsistent column names:** Same concept (e.g. "COSTO", "MONTO") with different headers across sheets.
3. **Header row offsets vary:** CRM=2, Pagos=1, Ventas=multiple per tab, Calendario=1.
4. **Duplicate headers:** Pagos has "Venta U$S IVA inc." in D and E.
5. **Proveedor tabs in Ventas:** 23 tabs with similar structure; API reads only first.
6. **No canonical IDs:** COTIZACION_ID / ID. Pedido / ÓRDEN used inconsistently across workbooks.
7. **No audit trail for writes:** Only marcar-entregado; no AUDIT_LOG append on other potential writes.

---

## 2. Target Architecture — Sheets as Central Database

### 2.1 Principles

1. **Single source of truth per entity:** One tab (or one workbook) per logical entity.
2. **Canonical schema:** Standardized column names and types across all consumers.
3. **Bidirectional sync:** GET for read, PUSH for create/update from Dashboard, Calculadora, GPT, Shopify.
4. **Audit everything:** Every write appends to AUDIT_LOG (timestamp, action, row, user).
5. **ID consistency:** COTIZACION_ID, PEDIDO_ID, PRODUCTO_ID used uniformly.

### 2.2 Proposed Entity Model

| Entity | Current Location | Proposed Master Tab | GET | PUSH |
|--------|------------------|---------------------|-----|------|
| **Cotizaciones** | CRM_Operativo | CRM_Operativo (keep) | ✓ | Add: crear, actualizar estado |
| **Entregas** | CRM + Ventas realizadas | Ventas realizadas (append-only log) | ✓ | marcar-entregado ✓ |
| **Pagos** | Pagos Pendientes | Pendientes_ (keep) | ✓ | Add: registrar pago, actualizar estado |
| **Ventas por proveedor** | 2.0 Ventas (23 tabs) | **Consolidate** → 1 tab "Ventas_Consolidado" + PROVEEDOR column | ✓ | Add: nueva venta, actualizar facturación |
| **Stock** | Stock E-Commerce | First tab (keep) | ✓ | Add: actualizar stock, sincronizar Shopify |
| **Calendario** | Calendario (46 tabs) | Keep monthly tabs; add API to read by month | ✓ | Add: registrar pago vencimiento |
| **Metas** | Metas_Ventas (conditional) | Create if missing | ✓ | Add: actualizar meta |
| **Audit** | AUDIT_LOG | AUDIT_LOG (append-only) | ✓ | Auto-append on every PUSH |

### 2.3 Canonical Schema (Proposed)

**Cotizaciones:**
```
COTIZACION_ID, FECHA_CREACION, CLIENTE_NOMBRE, TELEFONO, DIRECCION, FECHA_ENTREGA, ESTADO, ASIGNADO_A, NOTAS, MONTO_ESTIMADO, MONEDA, ORIGEN, LINK_UBICACION, LINK_COTIZACION
```

**Pagos:**
```
FECHA, PROVEEDOR, CLIENTE_NOMBRE, COTIZACION_ID, MONTO, MONEDA, ESTADO_PAGO, FECHA_VENCIMIENTO, PLAZO, SALDO_CLIENTE, COMENTARIOS
```

**Ventas (consolidated):**
```
COTIZACION_ID, PROVEEDOR, CLIENTE_NOMBRE, FECHA_ENTREGA, MONTO_USD, COSTO_USD, GANANCIA_USD, SALDO_CLIENTE, PAGO_PROVEEDOR, FACTURADO, NUM_FACTURA, FECHA_INGRESO
```

**Stock:**
```
CODIGO, PRODUCTO, COSTO_USD, MARGEN_PCT, GANANCIA, VENTA_USD, STOCK, PEDIDO_PENDIENTE, SHOPIFY_SYNC_AT
```

---

## 3. Implementation Roadmap

### Phase 1 — Improve GET (No Structure Change)

| Task | Effort | Impact |
|------|--------|--------|
| Iterate all 23 Ventas tabs; merge into single API response with PROVEEDOR from tab name | Medium | High — full ventas data |
| Add headerRowOffset per tab where needed (CRM=2, etc.) | Low | Correct parsing |
| Read Calendario by tab name (e.g. MARZO 2026) via query param | Low | Monthly vencimientos |
| Read Stock tabs: EXISTENCIAS_Y_PEDIDOS, Egresos for inventory history | Medium | Richer stock view |

### Phase 2 — Add PUSH Endpoints

| Task | Effort | Impact |
|------|--------|--------|
| POST /api/cotizaciones — append new row to CRM_Operativo | Medium | Calculadora, GPT can create |
| PATCH /api/cotizaciones/:id — update ESTADO, FECHA_ENTREGA | Medium | Dashboard state updates |
| POST /api/pagos — append to Pendientes_ | Medium | Register new pending payment |
| PATCH /api/pagos/:id — update ESTADO, Saldo | Medium | Mark as paid |
| POST /api/ventas — append to Ventas (or correct proveedor tab) | Medium | New sale from Dashboard |
| PATCH /api/stock/:codigo — update STOCK cell | Medium | Shopify sync, manual adjust |
| Append to AUDIT_LOG on every PUSH | Low | Traceability |

### Phase 3 — Structure Improvements (Optional)

| Task | Effort | Impact |
|------|--------|--------|
| Create Ventas_Consolidado tab in 2.0 Ventas; Apps Script to sync from proveedor tabs | High | Single source for ventas |
| Normalize Pagos columns (remove duplicate headers, add COTIZACION_ID consistently) | Medium | Cleaner mapping |
| Add COTIZACION_ID to Pagos where missing (lookup from Ventas/CRM) | Medium | Cross-reference |
| Create Metas_Ventas tab if missing | Low | Metas KPI |

### Phase 4 — Full Synchronicity

| Task | Effort | Impact |
|------|--------|--------|
| Shopify webhook → PUSH stock updates to Stock sheet | Medium | Real-time e-commerce sync |
| Calculadora "Enviar cotización" → POST /api/cotizaciones | Medium | End-to-end flow |
| GPT Actions → GET/PUSH via OpenAPI | Medium | Invoque Panelin integration |
| Apps Script triggers: onEdit → sync to AUDIT_LOG | Low | Sheet-side audit |

---

## 4. Recommended Modifications to Sheet Structure

### 4.1 Minimal Changes (No Migration)

- **CRM_Operativo:** Keep as-is; ensure header row is row 3 (offset 2).
- **Pagos Pendientes:** Document which column is authoritative for MONTO (K vs D/E); add COTIZACION_ID column if not present for linkage.
- **2.0 Ventas:** Option A — iterate all tabs in API (no sheet change). Option B — add "Ventas_Consolidado" tab, Apps Script to aggregate.
- **Stock:** Keep; add optional SHOPIFY_LAST_SYNC column for sync timestamp.
- **Calendario:** Keep monthly tabs; API accepts `?month=2026-03` to read specific tab.

### 4.2 Schema Additions (New Columns)

| Sheet | Column | Type | Purpose |
|-------|--------|------|---------|
| CRM_Operativo | UPDATED_AT | datetime | Last modification |
| Pendientes_ | COTIZACION_ID | string | Link to CRM/Ventas |
| Ventas (any) | FECHA_INGRESO | date | When sale was registered |
| Stock | SHOPIFY_SYNC_AT | datetime | Last Shopify sync |
| AUDIT_LOG | (ensure exists) | — | All writes append here |

### 4.3 New Tabs (If Creating)

| Tab | Workbook | Purpose |
|-----|----------|---------|
| Ventas_Consolidado | 2.0 Ventas | Single view of all ventas; fed by Apps Script from proveedor tabs |
| Metas_Ventas | crm_automatizado | If missing; PERIODO, TIPO, META_MONTO, MONEDA |
| Sync_Log | Any | Optional; timestamp, source, rows_affected for ETL |

---

## 5. API Contract Extensions

### 5.1 New GET Endpoints

```
GET /api/ventas?proveedor=BROMYROS     → filter by proveedor (from tab or column)
GET /api/calendario?month=2026-03      → read tab "MARZO 2026"
GET /api/stock/history                 → EXISTENCIAS_Y_PEDIDOS, Egresos
GET /api/audit?since=2026-03-01       → AUDIT_LOG filtered
```

### 5.2 New PUSH Endpoints

```
POST   /api/cotizaciones               → append CRM_Operativo
PATCH  /api/cotizaciones/:id           → update row
POST   /api/pagos                      → append Pendientes_
PATCH  /api/pagos/:id                  → update row
POST   /api/ventas                     → append to Ventas (tab by proveedor)
PATCH  /api/stock/:codigo              → update STOCK cell
```

### 5.3 Request/Response Format

All PUSH: `Content-Type: application/json`, body with canonical field names.  
Response: `{ ok: true, id?: string, row?: number }`.  
On error: 400/404/503 with `{ ok: false, error: string }`.

---

## 6. Synchronicity Matrix

| Source | Target | Direction | Trigger |
|--------|--------|-----------|---------|
| Dashboard (user) | CRM_Operativo | PUSH | Create/update cotización |
| Dashboard (user) | Pendientes_ | PUSH | Register/update pago |
| Dashboard (user) | Ventas | PUSH | New venta |
| Dashboard (user) | Stock | PUSH | Adjust stock |
| Calculadora | CRM_Operativo | PUSH | New cotización |
| Shopify | Stock | PUSH | Webhook inventory update |
| GPT / Invoque | All | GET + PUSH | Via OpenAPI actions |
| Apps Script | Ventas_Consolidado | PUSH | Nightly aggregation from tabs |
| Apps Script | AUDIT_LOG | PUSH | OnEdit, onFormSubmit |

---

## 7. Next Steps (Priority Order)

1. **Implement Phase 1 (improve GET):** Iterate Ventas tabs, add Calendario ?month, document offsets.
2. **Add AUDIT_LOG append** to existing marcar-entregado.
3. **Design POST /api/cotizaciones** — schema, validation, append logic.
4. **Design POST /api/pagos** — schema, append to Pendientes_.
5. **Evaluate Ventas consolidation:** 1 tab vs iterate 23 tabs.
6. **Implement Phase 2 PUSH endpoints** one by one.
7. **Shopify sync** — webhook to Stock.
8. **GPT/OpenAPI** — expose new endpoints.

---

## 8. References

- Full audit: `FULL-SHEETS-AUDIT-REPORT.md`
- Raw data: `FULL-SHEETS-AUDIT-RAW.json`
- Mapping: `SHEETS-MAPPING-5-WORKBOOKS.md`
- API routes: `server/routes/bmcDashboard.js`
- Planilla inventory: `planilla-inventory.md`
