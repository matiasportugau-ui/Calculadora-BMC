# Full Sheets Audit — Tab-by-Tab, Column-by-Column Report

**Generated:** 2026-03-16  
**Mode:** READ-ONLY — no edits performed  
**Source:** `scripts/map-all-sheets-audit.js` → `FULL-SHEETS-AUDIT-RAW.json`

---

## Executive Summary

| Workbook | Tabs | Total Columns | API Routes | Status |
|----------|------|---------------|------------|--------|
| BMC crm_automatizado | 5 | ~31 (CRM) | cotizaciones, entregas, audit | ✓ |
| Pagos Pendientes 2026 | 2 | 15–16 | kpi-financiero, pagos-pendientes | ✓ |
| 2.0 - Ventas | 23 | 20–40 per tab | ventas | ✓ |
| Stock E-Commerce | 7 | 60+ (wide) | stock-ecommerce, stock-kpi | ✓ |
| Calendario vencimientos | 46 | 4–5 | calendario-vencimientos | ✓ |

**Total:** 5 workbooks, 83 tabs, ~200+ distinct columns across all sheets.

---

## 1. BMC crm_automatizado

**ID:** `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg`  
**Env:** `BMC_SHEET_ID`

### Tabs

| Tab | Rows | Cols | Columns (sample) | API / Notes |
|-----|------|------|-----------------|-------------|
| **CRM_Operativo** | 1000 | 31 | ID, Fecha, Cliente, Teléfono, Ubicación, Estado, Responsable, Consulta/Pedido, Monto estimado | GET cotizaciones, proximas-entregas, coordinacion; **headerRowOffset: 2** |
| **Manual** | 1000 | 26 | Objetivo, plantilla CRM | Documentation |
| **Parametros** | 1000 | 26 | Estado, Listas y pesos (Pendiente, En análisis, Cotizando…) | Dropdowns; not read by API |
| **Dashboard** | 1000 | 26 | KPI, Consultas activas, Seguimientos vencidos | Gerencial |
| **Automatismos** | 1000 | 26 | ID automático, Prioridad, Alertas | Automation map |

### CRM_Operativo — Column Detail (canonical mapping)

| Col | Header (origin) | Canonical | Type | GET | PUSH |
|-----|-----------------|-----------|------|-----|------|
| A | ID | COTIZACION_ID | string | ✓ | — |
| B | Fecha | FECHA_CREACION | date | ✓ | — |
| C | Cliente | CLIENTE_NOMBRE | string | ✓ | — |
| D | Teléfono | TELEFONO | string | ✓ | — |
| E | Ubicación / Dirección | DIRECCION | string | ✓ | — |
| F | Fecha próxima acción | FECHA_ENTREGA | date | ✓ | — |
| G | Estado | ESTADO | string | ✓ | — |
| H | Responsable | ASIGNADO_A | string | ✓ | — |
| I | Consulta / Pedido | NOTAS | string | ✓ | — |
| J | Monto estimado USD | MONTO_ESTIMADO | number | ✓ | — |

---

## 2. Pagos Pendientes 2026

**ID:** `1AzHhalsZKGis_oJ6J06zQeOb6uMQCsliR82VrSKUUsI`  
**Env:** `BMC_PAGOS_SHEET_ID`

### Tabs

| Tab | Rows | Cols | Key Columns | API |
|-----|------|------|-------------|-----|
| **Pendientes_** | 980 | 39 | FECHA, PROVEEDOR, Venta U$S IVA inc., ÓRDEN, CLIENTE, ESTADO, Pago cliente USD, Pago a Proveedor USD, Saldo a Proveedor USD, PLAZO, SALDO DEL CLIENTE, COMENTARIOS | GET kpi-financiero, pagos-pendientes |
| **Listos_** | 2830 | 39 | FECHA, PROVEEDOR, Venta U$S IVA inc., Costo U$S IVA inc., ÓRDEN, CLIENTE, ESTADO, Pago cliente USD, Pago a Proveedor USD, Saldo a Proveedor USD, PLAZO | Historical; not consumed by API |

### Pendientes_ — Column Detail

| Col | Header | Canonical | Type | Sample Values |
|-----|--------|-----------|------|---------------|
| A | º | — | — | (empty) |
| B | FECHA | FECHA_VENCIMIENTO | date | 12/11/2022, 14/7/2025 |
| C | PROVEEDOR | PROVEEDOR | string | Importación, MONTFRIO, HM Rubber |
| D-E | Venta U$S IVA inc. | MONTO (fallback) | number | 3,654.00, 108.99 |
| F | ÓRDEN | COTIZACION_ID | string | 3102022, A-844 |
| G | CLIENTE | CLIENTE_NOMBRE | string | Alfredo Nario, Javier Plada |
| H | ESTADO | ESTADO_PAGO | string | ENCARGADO, PENDIENTE, ENTREGADO |
| I | Pago cliente USD | — | number | 3,000.00 |
| J | Pago a Proveedor USD | — | number | 100 % |
| K | Saldo a Proveedor USD | MONTO | number | 0.00, 109, 126 |
| L | PLAZO | — | string | indef., 04-11 |
| M | SALDO DEL CLIENTE | — | number | 654, 0 |
| N | COMENTARIOS | — | string | Revisar, Vendimos panel… |

---

## 3. 2.0 - Ventas

**ID:** `1KFNKWLQmBHj_v8BZJDzLklUtUPbNssbYEsWcmc0KPQA`  
**Env:** `BMC_VENTAS_SHEET_ID`

### Tabs (23 total)

| Tab | Purpose | Key Columns |
|-----|---------|-------------|
| Ventas y Coordinaciones | Main / index | origen, VENDEDOR, ID. Pedido, INGRESO PEDIDO, NOMBRE, MONTO, COSTO, GANANCIAS |
| BROMYROS | Proveedor | ID. Pedido, NOMBRE, FECHA ENTREGA, MONTO SIN IVA, COSTO SIN IVA, GANANCIAS SIN IVA, SALDOS, Pago a Proveedor, FACTURADO, Nº FACTURA |
| MONTFRIO | Proveedor | Same structure |
| BECAM | Proveedor | Same structure |
| DAC | Proveedor | Same structure |
| HM-RUBBER | Proveedor | Same structure |
| GALPONES DE JARDIN | Proveedor | Same structure |
| Ecopanels+ | Proveedor | Same structure |
| ARMCO | Proveedor | Same structure |
| ALAMBRESA | Proveedor | Same structure |
| R y C | Proveedor | Same structure |
| CIBULIS | Proveedor | Same structure |
| SECO CENTER | Proveedor | Same structure |
| ALQUILER ENGRAFADORA | Proveedor | Same structure |
| (+ 9 more tabs) | Various | Similar structure |

### Canonical Mapping (per data row)

| Origin | Canonical | Type |
|--------|-----------|------|
| ID. Pedido | COTIZACION_ID | string |
| NOMBRE | CLIENTE_NOMBRE | string |
| FECHA ENTREGA | FECHA_ENTREGA | date |
| COSTO SIN IVA / MONTO SIN IVA | COSTO | number |
| GANANCIAS SIN IVA | GANANCIA | number |
| SALDOS | SALDO_CLIENTE | string |
| Pago a Proveedor | PAGO_PROVEEDOR | string |
| FACTURADO | FACTURADO | string |
| Nº FACTURA | NUM_FACTURA | string |
| (tab name) | PROVEEDOR | string |

**Note:** API reads first tab only; multi-tab iteration not implemented. Each proveedor tab has repeated header rows.

---

## 4. Stock E-Commerce

**ID:** `1egtKJAGaATLmmsJkaa2LlCv3Ah4lmNoGMNm4l0rXJQw`  
**Env:** `BMC_STOCK_SHEET_ID`

### Tabs (7 total)

| Tab | Rows | Cols | Purpose |
|-----|------|------|---------|
| (first / main) | 100+ | 60+ | Productos, costos, stock, Shopify sync |
| EXISTENCIAS_Y_PEDIDOS | — | — | Inventory + orders |
| Orden y Inventario | — | — | Order/inventory |
| POSICION FISICA | — | — | Physical count |
| Conteo 11082025 | — | — | Count snapshot |
| Egresos | — | — | Outbound |
| Copy of Sheet1 | — | — | Backup |

### Main Tab — Key Columns

| Col | Header | Canonical | Type |
|-----|--------|-----------|------|
| A | Cargado en Shopify | — | string |
| B | Etiquetas | — | string |
| C | Codigo | CODIGO | string |
| D | Producto | PRODUCTO | string |
| E | Costo m2 U$S + IVA | COSTO_USD | number |
| F | Margen % | MARGEN_PCT | number |
| G | Ganancia | GANANCIA | number |
| H | Venta + IVA | VENTA_USD | number |
| … | Stock, STOCK | STOCK | number |
| … | Pedido RYC, Pedido 11/08 | PEDIDO_PENDIENTE | number |

---

## 5. Calendario de vencimientos

**ID:** `1bvnbYq7MTJRpa6xEHE5m-5JcGNI9oCFke3lsJj99tdk`  
**Env:** `BMC_CALENDARIO_SHEET_ID`

### Tabs (46 total)

Monthly and thematic tabs, e.g.:

| Tab | Purpose |
|-----|---------|
| GASTOS | Master / index |
| MARZO 2026 | Current month |
| FEBRERO 2026 | Previous month |
| ENERO 2026 | — |
| DICIEMBRE 2025 | — |
| … (40+ more) | Historical months, convenios, patentes, Sura DFSK, etc. |

### Typical Structure (e.g. JUNIO 2025)

| Col | Header | Type | Sample |
|-----|--------|------|--------|
| A | CONCEPTO | string | UTE, OSE, ANTEL, BPS, DGI, BSE, SUELDOS, AGUINALDOS… |
| B | IMPORTE $ | number | 3872, 4274, 325… |
| C | NO PAGO | number | (unpaid amount) |
| D | IMPORTE U$S | number | (USD amount) |

**headerRowOffset:** 1 (row 1 = month title, row 2 = headers).

---

## GET/PUSH Summary (Current)

| Route | GET From | PUSH To |
|-------|----------|---------|
| /api/cotizaciones | CRM_Operativo | — |
| /api/proximas-entregas | CRM_Operativo | — |
| /api/coordinacion-logistica | CRM_Operativo | — |
| /api/audit | AUDIT_LOG (conditional) | — |
| /api/kpi-financiero | Pagos_Pendientes / Pendientes_ | — |
| /api/pagos-pendientes | Pendientes_ | — |
| /api/ventas | 2.0 Ventas (first tab) | — |
| /api/stock-ecommerce | Stock (first tab) | — |
| /api/stock-kpi | Stock (first tab) | — |
| /api/calendario-vencimientos | Calendario (first tab) | — |
| POST /api/marcar-entregado | Master_Cotizaciones | Ventas realizadas (append) |

**PUSH today:** Only `marcar-entregado` writes to Sheets. All other routes are read-only.

---

## Raw Data

Full JSON: `docs/google-sheets-module/FULL-SHEETS-AUDIT-RAW.json`
