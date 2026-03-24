# Planilla Inventory — Inventario en vivo

**Workbooks:** 5 workbooks BMC (multi-workbook). Principal: `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg`  
**Schema activo:** CRM_Operativo (BMC_SHEET_SCHEMA)  
**Planilla principal (integra y genera info para el dashboard):** [BMC crm_automatizado](https://docs.google.com/spreadsheets/d/1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg/edit?usp=sharing). Service account con acceso: `bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com`. Ver [PLANILLA-PRINCIPAL-DASHBOARD.md](PLANILLA-PRINCIPAL-DASHBOARD.md).

Inventario runtime de tabs, columnas y rutas API. Ver [SHEETS-MAPPING-5-WORKBOOKS.md](SHEETS-MAPPING-5-WORKBOOKS.md) para mapa detallado.

---

## 0. Workbooks (5)

| Env var | Workbook ID | Nombre | API |
|---------|-------------|--------|-----|
| BMC_SHEET_ID | 1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg | BMC crm_automatizado | cotizaciones, entregas, audit |
| BMC_PAGOS_SHEET_ID | 1AzHhalsZKGis_oJ6J06zQeOb6uMQCsliR82VrSKUUsI | Pagos Pendientes 2026 | kpi-financiero, pagos-pendientes |
| BMC_VENTAS_SHEET_ID | 1KFNKWLQmBHj_v8BZJDzLklUtUPbNssbYEsWcmc0KPQA | 2.0 - Ventas | ventas |
| BMC_STOCK_SHEET_ID | 1egtKJAGaATLmmsJkaa2LlCv3Ah4lmNoGMNm4l0rXJQw | Stock E-Commerce | stock-ecommerce, stock-kpi |
| BMC_CALENDARIO_SHEET_ID | 1bvnbYq7MTJRpa6xEHE5m-5JcGNI9oCFke3lsJj99tdk | Calendario vencimientos | calendario-vencimientos |
| BMC_MATRIZ_SHEET_ID | 1VBbVay7pwPgC40CWCIr35VbKVuxPsKBZ | MATRIZ de COSTOS y VENTAS 2026 | actualizar-precios-calculadora |

**MATRIZ de COSTOS y VENTAS:** La misma planilla alimenta costos y precios de venta. Columnas buscadas por nombre (flexible):

- **SKU / Código** — para mapear a path calculadora
- **Costo / Costos** — costo unitario (con IVA; se convierte a sin IVA)
- **Venta BMC / Venta consumidor / Venta directa** — precio venta directa
- **Venta Web / Web** — precio venta web

El CSV exportado incluye `path`, `label`, `categoria`, `costo`, `venta_bmc_local`, `venta_web`, `unidad`. Los valores son editables en Configuración → Listado de precios (PricingEditor). La columna **Costo** se usa para "Cargar desde MATRIZ" junto con Venta BMC/Web.

---

## 1. Tabs — estado y API (workbook principal)

| Tab | Estado | Schema(s) | API que consume | Notas |
|-----|--------|-----------|-----------------|-------|
| **CRM_Operativo** | active_now | CRM_Operativo | GET /api/cotizaciones, /api/proximas-entregas, /api/coordinacion-logistica | Fuente principal hoy; header row offset 2 |
| **Parametros** | active_now | CRM_Operativo | — | Catálogos, dropdowns; no leído por API actual |
| **Pendientes_** | conditional | — | GET /api/kpi-financiero, /api/pagos-pendientes | Tab real en workbook Pagos 2026 (audit: "Pendientes_", no "Pagos_Pendientes"); API usa getFirstSheetName() |
| **Metas_Ventas** | conditional | — | GET /api/kpi-financiero, /api/metas-ventas | Opcional; degrada limpio si falta |
| **AUDIT_LOG** | conditional | — | GET /api/audit | Si CRM: puede devolver vacío; si BMC: requerido |
| **Master_Cotizaciones** | conditional | Master_Cotizaciones | GET /api/cotizaciones, proximas-entregas, coordinacion; POST marcar-entregado | Solo cuando schema=Master |
| **Ventas realizadas y entregadas** | conditional | Master_Cotizaciones | POST /api/marcar-entregado (destino) | Solo cuando schema=Master |
| **Manual, Dashboard, Automatismos** | active_now | CRM_Operativo | — | Tabs del workbook; no consumidas por API dashboard |
| **Admin_Cotizaciones** | conditional | Admin_Cotizaciones | — | Integrada desde "2.0 - Administrador de Cotizaciones"; script `npm run integrate-admin-cotizaciones`. Ver [INTEGRACION-ADMIN-COTIZACIONES.md](INTEGRACION-ADMIN-COTIZACIONES.md). |

**Workbook origen para Admin_Cotizaciones:** `1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0` (2.0 - Administrador de Cotizaciones). La service account debe tener acceso de lector a ese workbook.

---

## 2. Campos por tab (API contract)

### CRM_Operativo (mapeo a canónico)

| Columna origen | Campo canónico | Tipo |
|----------------|----------------|------|
| ID | COTIZACION_ID | string |
| Fecha | FECHA_CREACION | date |
| Cliente | CLIENTE_NOMBRE | string |
| Teléfono | TELEFONO | string |
| Ubicación / Dirección | DIRECCION | string |
| Fecha próxima acción | FECHA_ENTREGA | date |
| Estado | ESTADO | string |
| Responsable | ASIGNADO_A | string |
| Consulta / Pedido | NOTAS | string |

Ver planilla-map.md §2 para columnas completas y diff vs blueprint.

### Pagos_Pendientes (si existe)

| Campo | Col | Columna origen | Tipo | Uso |
|-------|-----|----------------|------|-----|
| PRECIO_VENTA | D | Precio de Venta IVA Inc | number | Precio venta con IVA |
| COSTO_COMPRA | E | Costo de la compra | number | Costo de compra |
| CLIENTE_NOMBRE | — | CLIENTE | string | Breakdown table |
| COTIZACION_ID | — | ÓRDEN / Ped. Nro | string | Pedido |
| MONTO | — | Saldo a Proveedor / Pago a Proveedor | number | KPI, trend, breakdown |
| MONEDA | — | — | string | Filtro moneda ($, UES, etc.) |
| FECHA_VENCIMIENTO | — | FECHA / PLAZO | date | KPI, trend, breakdown, estado |
| ESTADO_PAGO | — | ESTADO | string | Filtro pendiente |

### Metas_Ventas (si existe)

| Campo | Tipo | Uso |
|-------|------|-----|
| PERIODO | string | Tabla metas |
| TIPO | string | Tabla metas |
| META_MONTO | number | Tabla metas |
| MONEDA | string | Formato |
| NOTAS | string | Tabla metas |

### AUDIT_LOG

| Campo | Tipo |
|-------|------|
| TIMESTAMP | datetime |
| ACTION | string |
| ROW | string |
| OLD_VALUE | string |
| NEW_VALUE | string |
| REASON | string |
| USER | string |
| SHEET | string |

### 2.0 - Ventas (Ventas_2026)

| Campo | Tipo | Uso |
|-------|------|-----|
| COTIZACION_ID | string | ID. Pedido |
| CLIENTE_NOMBRE | string | Tabla ventas |
| FECHA_ENTREGA | date | Ordenamiento |
| COSTO | number | KPI |
| GANANCIA | number | KPI |
| SALDO_CLIENTE | string | Breakdown |
| PAGO_PROVEEDOR | string | Breakdown |
| FACTURADO | string | Estado |
| NUM_FACTURA | string | Referencia |
| PROVEEDOR | string | Filtro |

### Stock E-Commerce (Stock_Ecommerce)

| Campo | Tipo | Uso |
|-------|------|-----|
| CODIGO | string | Producto |
| PRODUCTO | string | Nombre |
| COSTO_USD | number | Valor inventario |
| MARGEN_PCT | number | KPI |
| GANANCIA | number | KPI |
| VENTA_USD | number | Precio |
| STOCK | number | Bajo stock, valor inventario |
| PEDIDO_PENDIENTE | number | Pedidos |
| SHOPIFY_SYNC_AT | datetime | **Nuevo — añadir columna al final de la hoja** |

### Ventas_Consolidado (nueva tab en workbook Ventas)

| Campo | Tipo | Uso |
|-------|------|-----|
| COTIZACION_ID | string | Match upsert |
| PROVEEDOR | string | Match upsert, filtro |
| CLIENTE_NOMBRE | string | Tabla |
| FECHA_ENTREGA | date | Filtro sin facturar |
| COSTO | number | KPI |
| GANANCIA | number | KPI |
| SALDO_CLIENTE | string | Breakdown |
| PAGO_PROVEEDOR | string | Breakdown |
| FACTURADO | string | Alerta sin facturar |
| NUM_FACTURA | string | Referencia |
| FECHA_INGRESO | date | Registro consolidación |

### Calendario — columnas añadidas

| Campo | Tab | Acción |
|-------|-----|--------|
| PAGADO | Cada tab mensual | **Nuevo — añadir al final; valores: "Sí" / vacío** |

### Pagos Pendientes — columnas añadidas

| Campo | Tab | Acción |
|-------|-----|--------|
| COTIZACION_ID | Pendientes_ | **Nuevo — añadir al final (col AP aprox.)** |
| FECHA_COBRO | Pendientes_ | **Nuevo — añadir al final (auto-populated por onEdit)** |

---

## 3. GET/PUSH por ruta

| Ruta | GET | PUSH |
|------|-----|------|
| /api/cotizaciones | CRM_Operativo o Master_Cotizaciones | POST: crea fila en CRM_Operativo (solo schema CRM_Operativo) |
| /api/cotizaciones/:id | — | PATCH: actualiza ESTADO, ASIGNADO_A, FECHA_ENTREGA + AUDIT_LOG |
| /api/proximas-entregas | Idem | — |
| /api/coordinacion-logistica | Idem | — |
| /api/kpi-financiero | Pagos_Pendientes, Metas_Ventas | — |
| /api/pagos-pendientes | Pagos_Pendientes (o BMC_PAGOS_SHEET_ID) | — |
| /api/pagos | — | POST: crea fila en Pendientes_+ AUDIT_LOG |
| /api/pagos/:id | — | PATCH: actualiza ESTADO_PAGO, FECHA_COBRO + AUDIT_LOG |
| /api/metas-ventas | Metas_Ventas | — |
| /api/audit | AUDIT_LOG | — |
| /api/marcar-entregado | Master_Cotizaciones | Ventas realizadas (append), borrado en Master |
| /api/ventas | 2.0 - Ventas — **todas las tabs** (23); ?proveedor= filtra; ?tab= tab específica | POST: append a tab de proveedor |
| /api/ventas/tabs | Lista de tabs disponibles en 2.0 Ventas | — |
| /api/stock-ecommerce | Stock E-Commerce (BMC_STOCK_SHEET_ID) | — |
| /api/stock-kpi | Stock E-Commerce | — |
| /api/stock/history | Stock — tabs EXISTENCIAS_Y_PEDIDOS + Egresos | — |
| /api/stock/:codigo | — | PATCH: actualiza STOCK, PEDIDO_PENDIENTE, SHOPIFY_SYNC_AT + AUDIT_LOG |
| /api/calendario-vencimientos | Calendario (BMC_CALENDARIO_SHEET_ID); ?month=2026-03 lee tab "MARZO 2026" | — |
| /api/kpi-report | Agregado: Pagos_Pendientes, Metas_Ventas, proximas-entregas, ventas, stock-kpi | — |

---

**Última actualización:** 2026-03-16 (Phase 2 PUSH — 7 nuevas rutas POST/PATCH + dashboard notifications)
**Fuente:** bmcDashboard.js, SHEETS-MAPPING-5-WORKBOOKS.md, DASHBOARD-VISUAL-MAP
