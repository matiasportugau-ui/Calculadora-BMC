# Handoff itinerante — siguiente RUN

**Propósito:** El agente que lea este archivo toma el relevo del flujo **itinerante** de runs (full team 32→33→34→…). Debe: **(1)** ejecutar el RUN sugerido abajo; **(2)** investigar la mejor opción, solución o camino para ese RUN; **(3)** resolverlo y documentar; **(4)** al terminar, actualizar este handoff con la **siguiente sugerencia de RUN** y seguir trabajando itinerantemente (el próximo agente hará lo mismo).

**Última actualización:** 2026-03-20 (post run36)

---

## Estado al leer este handoff

| Run | Estado | Nota |
|-----|--------|------|
| **32** | ✓ | Full team sync; contratos; artefactos en repo. |
| **33** | ✓ | Full team; Pista 3 coordinación + Mapping; handoff Matias; artefactos commitados. |
| **34** | ✓ | Smoke post-Sheets ejecutado; E2E checklist actualizado. |
| **35** | ✓ | ADR-001 Presupuesto libre backup vs V3; tests 119 passed. |
| **36** | ✓ | Rama run36-audit-force; 0 vulns; lint/test/build OK; PR pendiente aprobación Matias. |
| **37** | **← Siguiente sugerido** | Ver abajo. |
| 38–39 | Pendientes | Roadmap: `reports/RUN-ROADMAP-FORWARD-2026.md`. |

---

## RUN sugerido para ti (próximo agente)

### RUN 37 — MATRIZ SKUs + billing

**Objetivo (roadmap):** Run **29** autopilot: col.D vs `matrizPreciosMapping.js`; sanity billing/cierre. Roles foco: Mapping, Fiscal, Billing, Reporter. Entregable: Lista SKUs OK/pendiente. Depende de datos negocio (MATRIZ).

**Qué hacer:**

1. **Investigar** la mejor opción o camino: leer `docs/team/PROJECT-STATE.md` (SKUs MATRIZ, presupuesto libre), `src/data/matrizPreciosMapping.js`, `docs/google-sheets-module/planilla-inventory.md` (MATRIZ col.D). Comparar SKUs en código vs columna D (o equivalente) de la planilla MATRIZ de COSTOS y VENTAS; listar coincidencias y pendientes. Opcional: sanity de cierre billing (Pagos_Pendientes, errores, duplicados) si hay datos.
2. **Ejecutar** ese plan: documento o lista (SKUs OK / pendiente de validar); actualizar matrizPreciosMapping o planilla-inventory si aplica; anotar hallazgos billing.
3. **Documentar:** Actualizar PROJECT-STATE (Cambios recientes run37); entregable en docs/team/reports o sección en PROJECT-STATE.
4. **Itinerante:** Al terminar run37, **actualizar este archivo**: poner run37 en ✓ y escribir como "Siguiente RUN sugerido" el **RUN 38** (Repos hermanos + GPT drift), con objetivo breve y los 4 pasos para el próximo agente.

---

## Cómo actualizar este handoff al terminar tu RUN

1. En **Estado al leer este handoff**: marcar tu run como ✓ y mover "Siguiente sugerido" al run que sigue.
2. En **RUN sugerido para ti**: reemplazar con el **siguiente número de run** (ej. RUN 38), objetivo breve, y los 4 pasos (investigar, ejecutar, documentar, itinerante) para que el próximo agente sepa qué hacer.
3. **Última actualización:** poner fecha del día.

Así cada agente escucha la sugerencia del RUN anterior, investiga el mejor camino, lo resuelve y deja la siguiente sugerencia para el siguiente agente.
