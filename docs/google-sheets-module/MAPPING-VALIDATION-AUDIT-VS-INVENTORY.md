# Mapping Validation — Audit Report vs Planilla-Inventory & DASHBOARD-INTERFACE-MAP

**Generated:** 2026-03-16  
**Origen:** Full BMC Dashboard team run (Mapping agent)  
**Input:** FULL-SHEETS-AUDIT-REPORT.md, planilla-inventory.md, DASHBOARD-INTERFACE-MAP.md, SHEETS-MAPPING-5-WORKBOOKS.md

---

## 1. Executive Summary

The Full Sheets Audit (5 workbooks, 83 tabs, ~200+ columns) was validated against planilla-inventory and DASHBOARD-INTERFACE-MAP. **Alignment is high** for core routes; **gaps** are documented for Ventas multi-tab, Calendario monthly tabs, Stock tabs, and GET/PUSH coverage.

---

## 2. Workbook-by-Workbook Validation

### 2.1 BMC crm_automatizado

| Source | Inventory | Audit | DASHBOARD-INTERFACE-MAP | Status |
|--------|-----------|-------|-------------------------|--------|
| ID | 1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg | ✓ | ✓ | ✓ Aligned |
| CRM_Operativo | active_now ✓ | 31 cols ✓ | ✓ | ✓ Aligned |
| headerRowOffset | 2 | 2 | — | ✓ Aligned |
| Parametros, Dashboard, Automatismos | Not consumed | Not consumed | — | ✓ Documented (no API) |
| AUDIT_LOG | conditional | — | — | ✓ Conditional |

**Gaps:** None. Audit confirms planilla-inventory and DASHBOARD-INTERFACE-MAP.

---

### 2.2 Pagos Pendientes 2026

| Source | Inventory | Audit | DASHBOARD-INTERFACE-MAP | Status |
|--------|-----------|-------|-------------------------|--------|
| ID | 1AzHhalsZKGis_oJ6J06zQeOb6uMQCsliR82VrSKUUsI | ✓ | ✓ | ✓ Aligned |
| Tab name | Pagos_Pendientes (conditional) | **Pendientes_** | — | ⚠️ **Gap** |
| Inventory tab | Pagos_Pendientes | Audit: Pendientes_ | — | Inventory uses generic name; Audit uses actual tab name |
| Listos_ | — | 2830 rows, historical | — | Not consumed by API ✓ |
| Column D/E | MONTO | Venta U$S IVA inc. (duplicate) | — | ⚠️ **Gap:** Duplicate headers; document authoritative MONTO |

**Gaps:**
- Tab name mismatch: planilla-inventory says "Pagos_Pendientes"; audit shows actual tab is "Pendientes_". Update planilla-inventory if needed.
- Duplicate headers (D/E) in Pagos: document which column is authoritative for MONTO.

---

### 2.3 2.0 - Ventas

| Source | Inventory | Audit | DASHBOARD-INTERFACE-MAP | Status |
|--------|-----------|-------|-------------------------|--------|
| ID | 1KFNKWLQmBHj_v8BZJDzLklUtUPbNssbYEsWcmc0KPQA | ✓ | ✓ | ✓ Aligned |
| Tabs | First tab only | **23 tabs** (proveedor tabs) | First tab | ⚠️ **Major gap** |
| API | GET /api/ventas | Reads first tab only | — | 22 proveedor tabs not iterated |
| Canonical mapping | COSTO, GANANCIA | COSTO/GANANCIAS SIN IVA | — | ✓ Aligned |
| PROVEEDOR | From tab name | — | — | Not implemented in API |

**Gaps:**
- **Critical:** API reads only first tab; 22 proveedor tabs (BROMYROS, MONTFRIO, etc.) not consumed. Dashboard Ventas 2.0 shows partial data.
- STRATEGIC-REVIEW Phase 1: Iterate all 23 Ventas tabs; merge into single API response with PROVEEDOR from tab name.

---

### 2.4 Stock E-Commerce

| Source | Inventory | Audit | DASHBOARD-INTERFACE-MAP | Status |
|--------|-----------|-------|-------------------------|--------|
| ID | 1egtKJAGaATLmmsJkaa2LlCv3Ah4lmNoGMNm4l0rXJQw | ✓ | ✓ | ✓ Aligned |
| Tabs | First tab | **7 tabs** | First tab | ⚠️ **Gap** |
| Main tab | Stock E-Commerce | 60+ cols | — | ✓ Aligned |
| EXISTENCIAS_Y_PEDIDOS, Egresos, etc. | — | Not consumed | — | 6 tabs not used |

**Gaps:**
- API reads first tab only. EXISTENCIAS_Y_PEDIDOS, Egresos, Orden y Inventario, etc. not consumed.
- STRATEGIC-REVIEW Phase 1: Read Stock tabs: EXISTENCIAS_Y_PEDIDOS, Egresos for inventory history.

---

### 2.5 Calendario de vencimientos

| Source | Inventory | Audit | DASHBOARD-INTERFACE-MAP | Status |
|--------|-----------|-------|-------------------------|--------|
| ID | 1bvnbYq7MTJRpa6xEHE5m-5JcGNI9oCFke3lsJj99tdk | ✓ | ✓ | ✓ Aligned |
| Tabs | First tab | **46 tabs** (monthly) | — | ⚠️ **Gap** |
| Structure | CONCEPTO, IMPORTE $, NO PAGO, IMPORTE U$S | ✓ | — | ✓ Aligned |
| headerRowOffset | 1 | 1 | — | ✓ |

**Gaps:**
- API reads first tab only. 45 monthly/thematic tabs (MARZO 2026, FEBRERO 2026, etc.) not consumed.
- STRATEGIC-REVIEW Phase 1: Add API to read by month: `GET /api/calendario?month=2026-03`.

---

## 3. Cross-Reference Validation (Planilla ↔ Dashboard ↔ API)

| Planilla/Tab | Dashboard section | API route | Audit | Status |
|--------------|-------------------|-----------|-------|--------|
| CRM_Operativo | Entregas, Operaciones | /api/proximas-entregas, /api/coordinacion-logistica | ✓ | ✓ |
| Pagos_Pendientes / Pendientes_ | Resumen, Trend, Breakdown | /api/kpi-financiero, /api/pagos-pendientes | ✓ | ✓ (tab name gap) |
| Metas_Ventas | Metas de ventas | /api/kpi-financiero | conditional | — |
| AUDIT_LOG | Audit log | /api/audit | conditional | — |
| 2.0 - Ventas (first tab) | Ventas 2.0 | /api/ventas | Partial (22 tabs missing) | ⚠️ |
| Stock E-Commerce (first tab) | Stock E-Commerce | /api/stock-ecommerce, /api/stock-kpi | ✓ | ✓ |
| Calendario (first tab) | Calendario vencimientos | /api/calendario-vencimientos | Partial (45 tabs missing) | ⚠️ |
| Invoque Panelin | Placeholder | — | — | ✓ |

---

## 4. GET/PUSH Coverage Gaps

| Route | GET | PUSH | Audit | Inventory | Gap |
|-------|-----|------|-------|-----------|-----|
| /api/cotizaciones | ✓ | — | — | — | No PUSH |
| /api/proximas-entregas | ✓ | — | — | — | — |
| /api/proximas-entregas | — | marcar-entregado | ✓ | ✓ | — |
| /api/kpi-financiero | ✓ | — | — | — | — |
| /api/pagos-pendientes | ✓ | — | — | — | No PUSH |
| /api/ventas | Partial (1 tab) | — | — | — | No PUSH; 22 tabs not read |
| /api/stock-ecommerce | ✓ | — | — | — | No PUSH |
| /api/calendario-vencimientos | Partial (1 tab) | — | — | — | 45 tabs not read |

**STRATEGIC-REVIEW Phase 2:** Add PUSH for cotizaciones, pagos, ventas, stock. Phase 1: Improve GET (iterate Ventas tabs, Calendario by month).

---

## 5. Recommendations

1. **Update planilla-inventory:** Add actual tab names (Pendientes_ vs Pagos_Pendientes); document which Pagos column is MONTO.
2. **Phase 1 (GET):** Implement Ventas multi-tab iteration; Calendario ?month=; Stock EXISTENCIAS_Y_PEDIDOS, Egresos.
3. **Phase 2 (PUSH):** Design POST /api/cotizaciones, POST /api/pagos, POST /api/ventas, PATCH /api/stock/:codigo per STRATEGIC-REVIEW.
4. **Log for Design:** Ventas 2.0 will show full data once Phase 1 is implemented; no UI change needed if API returns merged data.
5. **Log for Dependencies:** New Ventas/Calendario/Stock API behavior affects dependencies.md; update after Phase 1.

---

**Handoff:** Dependencies, Reporter, Design (for Phase 1–2 implementation plan).
