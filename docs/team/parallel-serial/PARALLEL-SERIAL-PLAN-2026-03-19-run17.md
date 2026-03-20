# Plan Paralelo/Serial — 2026-03-19 (run 17)

**Run:** Full team run (Invoque full team)
**Objetivo:** Ejecutar 0→9 completo; preparar deploy de la Calculadora; todos los 19 miembros.

**Contexto:** User quiere deployar esta versión de la calc. Cambios recientes (2026-03-19): Calculadora UI (accesorios on roof preview, costo/margen/ganancia columns, Cargar desde MATRIZ, Enter key, display fixes).

---

| Bloque | Acción |
|--------|--------|
| 0 | PROJECT-STATE, PROMPT-FOR-EQUIPO-COMPLETO, IMPROVEMENT-BACKLOG-BY-AGENT, REPORT-STUDY-IMPROVEMENTS leídos |
| 0b | Este plan: ejecución en serie 1→2→…→9. Contexto: deploy calc; Cloud Run vs Vercel vs Netuy. |
| 1 | Plan & proposal vigente; REPORT-STUDY-IMPROVEMENTS como input |
| 2 | Mapping: vigente; DASHBOARD-INTERFACE-MAP incluye Calculadora 5173 mejoras |
| 2b | Sheets Structure | Skip — no cambios estructurales en sheets |
| 3 | Dependencies: módulo Calculadora (MATRIZ flow, actualizar-precios-calculadora); service-map |
| 3b | Contract: validación 4/4 (código; runtime si servidor corriendo) |
| 3c | Networks: infra status; deploy options (Cloud Run/Vercel/Netuy) |
| 4 | Design: Calculadora UX mejorada vigente |
| 4b | Integrations: Shopify, ML, OAuth — estado vigente |
| 5 | Reporter: REPORT-SOLUTION-CODING para este run |
| 5b–5g | Security, GPT/Cloud, Fiscal, Billing, Audit, Calc: estado vigente |
| 6 | Judge: reporte run 2026-03-19 run17; histórico actualizado |
| 7 | Repo Sync: sincronizar bmc-dashboard-2.0 y bmc-development-team con artefactos |
| 8–9 | PROJECT-STATE actualizado; PROMPT "Próximos prompts" para siguiente run |

---

**Paralelización:** Serie (orden estándar). No hay tareas independientes que justifiquen clones este run.

**Handoff:** Usar con REPORT-STUDY-IMPROVEMENTS §20 (Fases) y PROJECT-STATE pendientes (deploy, tabs, triggers, E2E).
