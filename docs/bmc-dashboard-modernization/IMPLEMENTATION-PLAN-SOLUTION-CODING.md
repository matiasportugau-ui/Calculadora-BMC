# Implementation Plan — KPI Report (Solution & Coding)

**Fecha:** 2026-03-16  
**Objetivo:** Tareas concretas para implementar /api/kpi-report y bloque UI.

---

## Solution team (aprobado)

| Task | Owner | Status |
|------|-------|--------|
| S1 | Aprobar DESIGN-PROPOSAL-KPI-REPORT-INICIO | Solution | ✓ Aprobado |
| S2 | Aprobar MAPPING-KPI-REPORT-VALIDATION | Solution | ✓ Aprobado |

---

## Coding team

### C1 — Endpoint GET /api/kpi-report

| Subtask | Descripción | Acceptance |
|---------|-------------|------------|
| C1.1 | Añadir ruta en bmcDashboard.js | router.get("/kpi-report", ...) |
| C1.2 | Llamar en paralelo: kpi-financiero (interno), proximas-entregas, stock-kpi, metas-ventas, ventas | Promise.all o reutilizar lógica existente |
| C1.3 | Agregar: totalPendiente = byCurrency[$].total (o primera moneda), estaSemana, proximaSemana | Usar resumen de getResumenPagosPorPeriodo |
| C1.4 | entregasEstaSemana = data.length de proximas-entregas | — |
| C1.5 | bajoStock = stock-kpi.bajoStock | — |
| C1.6 | objetivoMensual: filtrar Metas_Ventas por PERIODO = mes actual (flexible: "2026-03", "MARZO 2026") | META_MONTO |
| C1.7 | realAcumulado: sum(GANANCIA) de ventas con FECHA_ENTREGA en mes actual | — |
| C1.8 | equilibrio: "En meta" | "Por debajo" | "Por encima" | "Sin meta" según meta vs real |
| C1.9 | Degradar si Pagos/Stock/Ventas no configurados | 503 o payload parcial |

**Payload esperado:**

```json
{
  "ok": true,
  "totalPendiente": 1200000,
  "estaSemana": 340000,
  "proximaSemana": 180000,
  "entregasEstaSemana": 12,
  "bajoStock": 8,
  "objetivoMensual": 2500000,
  "realAcumulado": 1800000,
  "equilibrio": "Por debajo",
  "moneda": "$"
}
```

---

### C2 — Dashboard UI bloque KPI Report

| Subtask | Descripción | Acceptance |
|---------|-------------|------------|
| C2.1 | Añadir sección en index.html antes de #finanzas | id="kpiReport" o #inicio |
| C2.2 | 4 kpi-cards: Total pendiente, Esta semana, Entregas, Bajo stock | Reutilizar .kpi-card |
| C2.3 | Card equilibrio: meta, real, pagos mes, badge estado | Nueva clase .kpi-equilibrio |
| C2.4 | En app.js: fetchKpiReport(), incluir en load() o llamada inicial | Una sola request |
| C2.5 | renderKpiReport(payload) | Actualizar DOM |
| C2.6 | Skeleton/empty si error o sin datos | — |

---

### C3 — Planilla-inventory y DASHBOARD-INTERFACE-MAP

| Subtask | Descripción |
|---------|-------------|
| C3.1 | Añadir GET /api/kpi-report en planilla-inventory.md §3 |
| C3.2 | Añadir sección KPI Report en DASHBOARD-INTERFACE-MAP.md |

---

## Handoff table

| Solution delivers | Coding starts |
|------------------|---------------|
| DESIGN-PROPOSAL aprobado | C1, C2 |
| — | — |
| Coding delivers | Solution validates |
| Endpoint + UI | Revisar en browser localhost:3001/finanzas |

---

## Order

1. C1 (endpoint)
2. C2 (UI)
3. C3 (docs)
