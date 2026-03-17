# Mapping Validation — KPI Report (Inicio)

**Fecha:** 2026-03-16  
**Objetivo:** Verificar planilla-inventory y DASHBOARD-INTERFACE-MAP incluyen estructura necesaria para KPI Report.

---

## 1. Planilla-Inventory — Metas_Ventas

| Campo | Tipo | Uso en KPI Report | Estado |
|-------|------|-------------------|--------|
| PERIODO | string | Filtrar meta del mes (ej. "2026-03", "MARZO 2026") | ✓ Documentado |
| TIPO | string | Tipo de meta (ventas, etc.) | ✓ Documentado |
| META_MONTO | number | Objetivo mensual | ✓ Documentado |
| MONEDA | string | Formato | ✓ Documentado |
| NOTAS | string | Referencia | ✓ Documentado |

**API:** GET /api/metas-ventas — lee Metas_Ventas (opcional, degrada limpio si falta).

**Gap:** PERIODO puede tener formatos variados (YYYY-MM, "MARZO 2026", etc.). El endpoint /api/kpi-report debe normalizar para matching con mes actual.

---

## 2. Fuentes para los 5 KPIs

| KPI | Fuente API | Campo(s) | Planilla/Tab |
|-----|------------|----------|--------------|
| 1. Total pendiente | /api/kpi-financiero | byCurrency[moneda].total | Pagos_Pendientes |
| 2. Esta semana (vencimientos) | /api/kpi-financiero | byCurrency[moneda].estaSemana | Pagos_Pendientes |
| 3. Entregas esta semana | /api/proximas-entregas | data.length | CRM_Operativo / Master_Cotizaciones |
| 4. Objetivo mensual vs real | /api/metas-ventas + /api/ventas | META_MONTO, sum(GANANCIA) | Metas_Ventas, 2.0 - Ventas |
| 5. Productos bajo stock | /api/stock-kpi | bajoStock | Stock E-Commerce |

---

## 3. Objetivo mensual para equilibrio

| Dato | Fuente | Lógica |
|------|--------|--------|
| Meta del mes | Metas_Ventas | Filtrar PERIODO = mes actual; tomar META_MONTO |
| Avance real | /api/ventas | Sumar GANANCIA (o COSTO) de filas con FECHA_ENTREGA en mes actual |
| Pagos del mes | /api/kpi-financiero | byPeriod.esteMes |
| Estado equilibrio | Calculado | meta vs real: "En meta", "Por debajo", "Por encima" |

**Gap:** Ventas usa FECHA_ENTREGA para filtrar por mes. Confirmar que es el campo correcto para "ventas realizadas del mes".

---

## 4. DASHBOARD-INTERFACE-MAP — Actualización

**Nueva sección a añadir:**

| Elemento | Tipo | Fuente API | Ubicación |
|----------|------|------------|-----------|
| KPI Report — Inicio | section | GET /api/kpi-report | #inicio (primera sección visible) |
| Card Total pendiente | card | kpi-report.totalPendiente | — |
| Card Esta semana | card | kpi-report.estaSemana | — |
| Card Entregas esta semana | card | kpi-report.entregasEstaSemana | — |
| Card Bajo stock | card | kpi-report.bajoStock | — |
| Card Objetivo mensual | card | kpi-report.objetivoMensual | — |
| Card Real acumulado | card | kpi-report.realAcumulado | — |
| Card Equilibrio | card | kpi-report.equilibrio | — |

---

## 5. Cross-reference

| Planilla/Tab | Dashboard block | API | Estado |
|--------------|-----------------|-----|--------|
| Pagos_Pendientes | KPI Report (1, 2) | /api/kpi-report (agregado) | Nuevo |
| Metas_Ventas | KPI Report (4) | /api/kpi-report | Nuevo |
| CRM_Operativo / Master | KPI Report (3) | /api/kpi-report | Nuevo |
| 2.0 - Ventas | KPI Report (4) | /api/kpi-report | Nuevo |
| Stock E-Commerce | KPI Report (5) | /api/kpi-report | Nuevo |

---

## 6. Conclusión

- **Planilla-inventory:** Metas_Ventas documentada; sin cambios estructurales necesarios.
- **DASHBOARD-INTERFACE-MAP:** Añadir sección 2.0 KPI Report — Inicio.
- **Gaps:** (1) Normalización PERIODO para matching mes; (2) Confirmar FECHA_ENTREGA como criterio para ventas del mes.
