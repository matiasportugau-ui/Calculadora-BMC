# Handoff itinerante — siguiente RUN

**Propósito:** El agente que lea este archivo toma el relevo del flujo **itinerante** de runs. Debe: **(1)** ejecutar el RUN sugerido abajo; **(2)** investigar la mejor opción, solución o camino; **(3)** resolverlo y documentar; **(4)** actualizar este handoff con la **siguiente sugerencia de RUN**.

**Última actualización:** 2026-03-20 (post run 50)

---

## Estado al leer este handoff

| Run | Estado | Nota |
|-----|--------|------|
| **32–36** | ✓ | Full team, Pista 3, smoke, ADR-001, audit rama run36-audit-force. |
| **37** | ✓ | MATRIZ SKUs lista (72); REPORT-RUN37-MATRIZ-SKUS. |
| **38** | ✓ | Repo Sync + GPT drift anotados; REPORT-RUN38. |
| **39** | ✓ | Síntesis ciclo; REPORT-RUN39-SINTESIS-CICLO. |
| **40–50** | ✓ | Extensión roadmap §2b; revisión, E2E, Pista 3, billing, contract, docs, data version, security, Judge, síntesis run 50. REPORT-RUNS-40-50-ITINERANTE. |
| **51** | **← Siguiente sugerido** | Ver abajo. |

---

## RUN sugerido para ti (próximo agente)

### RUN 51 — Ciclo siguiente (post run 50)

**Objetivo:** Primer run del siguiente ciclo tras síntesis run 50. Priorizar según pendientes vivos: (1) Merge run36-audit-force si aprobado; (2) Validación SKUs en planilla MATRIZ real; (3) Repo Sync a bmc-dashboard-2.0 / bmc-development-team; (4) Pista 3 (tabs/triggers) si Matias cerró; (5) GPT Builder drift vs openapi-calc.

**Qué hacer:**

1. **Investigar:** Leer PROJECT-STATE (Pendientes, Cambios recientes), HANDOFF-ITINERANTE, RUN-ROADMAP-FORWARD-2026 §2 y §2b. Elegir la acción más prioritaria o de mayor impacto.
2. **Ejecutar:** Llevar a cabo esa acción (código, doc, validación, sync, etc.).
3. **Documentar:** Actualizar PROJECT-STATE; entregable en reports/ o entrada Cambios recientes.
4. **Itinerante:** Poner run 51 en ✓ en este handoff; escribir RUN 52 como siguiente (objetivo breve + 4 pasos). Si con run 51 se cierran todos los pendientes del ciclo, RUN 52 puede ser "Mantenimiento / siguiente prioridad de negocio".

---

## Cómo actualizar este handoff al terminar tu RUN

1. En **Estado al leer este handoff**: marcar tu run como ✓ y mover "Siguiente sugerido" al run que sigue.
2. En **RUN sugerido para ti**: reemplazar con el **siguiente número de run**, objetivo breve, y los 4 pasos (investigar, ejecutar, documentar, itinerante).
3. **Última actualización:** poner fecha del día.
