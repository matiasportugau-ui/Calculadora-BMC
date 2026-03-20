# Plan Paralelo/Serial — 2026-03-19 (run 19)

**Run:** Full team run (Invoque full team)
**Objetivo:** Sincronizar todos los updates post-deploy: Calculadora design, costos editables, fórmulas dimensionamiento download/upload, MATRIZ costo column. Deploy ya completado (Cloud Run + Vercel).

**Contexto:** User quiere full team para sincronizar todas las actualizaciones. Cambios recientes: costos editables en Config, DimensioningFormulasEditor (download/upload), MATRIZ columna Costo, mejoras diseño Calculadora.

---

| Bloque | Acción |
|--------|--------|
| 0 | PROJECT-STATE, PROMPT-FOR-EQUIPO-COMPLETO, IMPROVEMENT-BACKLOG-BY-AGENT leídos |
| 0b | Este plan: ejecución en serie 1→2→…→9. Contexto: sync updates Calculadora + MATRIZ. |
| 1 | Plan & proposal vigente |
| 2 | Mapping: actualizar DASHBOARD-INTERFACE-MAP con costos editables, fórmulas dimensionamiento, MATRIZ costo; planilla-inventory MATRIZ costo column |
| 2b | Sheets Structure | Skip — no cambios estructurales en sheets |
| 3 | Dependencies: service-map actualizado con DimensioningFormulasEditor, PricingEditor costos |
| 3b | Contract: validación 4/4 (runtime) |
| 3c | Networks: infra status; Cloud Run + Vercel live |
| 4 | Design: vigente; mejoras Calculadora documentadas |
| 4b | Integrations: Shopify, ML, OAuth — estado vigente |
| 5 | Reporter: REPORT-SOLUTION-CODING run19 |
| 5b–5g | Security, GPT/Cloud, Fiscal, Billing, Audit, Calc: estado vigente |
| 6 | Judge: reporte run 2026-03-19 run19; histórico actualizado |
| 7 | Repo Sync: sincronizar bmc-dashboard-2.0 y bmc-development-team |
| 8–9 | PROJECT-STATE actualizado; PROMPT "Próximos prompts" para siguiente run |

---

**Paralelización:** Serie (orden estándar). No hay tareas independientes que justifiquen clones este run.

**Handoff:** Usar con PROJECT-STATE pendientes (tabs, triggers, E2E, npm audit fix, billing cierre).
