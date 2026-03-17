# Report — Solution & Coding Teams (KPI Report)

**Fecha:** 2026-03-16  
**Objetivo:** Handoff para implementar KPI Report (inicio) con 5 KPIs + objetivo mensual.

---

## Executive summary

Implementar un reporte ejecutivo unificado "KPI Report — Inicio" que agregue en una sola vista: (1) total pendiente a proveedores, (2) vencimientos esta semana, (3) entregas esta semana, (4) objetivo mensual vs real (equilibrio), (5) productos bajo stock.

**Solution:** Aprobado — DESIGN-PROPOSAL-KPI-REPORT-INICIO.md.  
**Coding:** Implementar endpoint GET /api/kpi-report y bloque UI.

---

## Status by module

| Módulo | Estado | Notas |
|--------|--------|-------|
| Mapping | ✓ | MAPPING-KPI-REPORT-VALIDATION.md; Metas_Ventas documentada |
| Design | ✓ | DESIGN-PROPOSAL-KPI-REPORT-INICIO.md |
| API | Pendiente | GET /api/kpi-report |
| Dashboard UI | Pendiente | Bloque KPI Report en #inicio |

---

## Gaps

- Ninguno crítico. APIs fuente existen; agregación en backend.

---

## Risks

- Metas_Ventas puede no existir → equilibrio "Sin meta".
- Ventas puede devolver fallback vacío → realAcumulado = 0.

---

## Handoff points

| From | To | Deliverable |
|------|-----|-------------|
| Design | Coding | DESIGN-PROPOSAL-KPI-REPORT-INICIO.md (layout, cards, equilibrio) |
| Mapping | Coding | MAPPING-KPI-REPORT-VALIDATION.md (fuentes, campos) |
| Coding | Solution | Endpoint + UI implementados; validar en browser |

---

## Acceptance criteria

1. **Endpoint:** GET /api/kpi-report retorna payload con totalPendiente, estaSemana, proximaSemana, entregasEstaSemana, bajoStock, objetivoMensual, realAcumulado, equilibrio.
2. **UI:** Sección "KPI Report — Inicio" visible en #inicio con 4 cards + card equilibrio.
3. **Degradación:** Si Sheets no configurados, 503 o payload con valores 0/null.
