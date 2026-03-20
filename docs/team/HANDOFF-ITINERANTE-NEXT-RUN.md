# Handoff itinerante — siguiente RUN

**Propósito:** El agente que lea este archivo toma el relevo del flujo **itinerante** de runs (full team 32→33→34→…). Debe: **(1)** ejecutar el RUN sugerido abajo; **(2)** investigar la mejor opción, solución o camino para ese RUN; **(3)** resolverlo y documentar; **(4)** al terminar, actualizar este handoff con la **siguiente sugerencia de RUN** y seguir trabajando itinerantemente (el próximo agente hará lo mismo).

**Última actualización:** 2026-03-20 (post run33)

---

## Estado al leer este handoff

| Run | Estado | Nota |
|-----|--------|------|
| **32** | ✓ | Full team sync; contratos; artefactos en repo. |
| **33** | ✓ | Full team; Pista 3 coordinación + Mapping; handoff Matias; artefactos commitados. |
| **34** | **← Siguiente sugerido** | Ver abajo. |
| 35–39 | Pendientes | Roadmap: `reports/RUN-ROADMAP-FORWARD-2026.md`. |

---

## RUN sugerido para ti (próximo agente)

### RUN 34 — Smoke post-Sheets

**Objetivo (roadmap):** Re-validar Cloud Run/Vercel; anotar si 503→200 en rutas clave; OAuth/CORS si aplica. Depende de run33 (hecho o documentado “parcial”). Roles foco: Networks, Contract, Audit. Entregable: E2E checklist actualizado.

**Qué hacer:**

1. **Investigar** la mejor opción o camino: leer `docs/team/E2E-VALIDATION-CHECKLIST.md`, `docs/team/plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md`, `docs/team/PROJECT-STATE.md` (Pendientes, Cambios recientes). Decidir si run34 se hace como **full team** (Invoque full team 0→9 con foco run34) o como **pasos acotados** (solo Networks + Contract + Audit + actualizar E2E checklist).
2. **Ejecutar** ese plan: re-validar URLs producción (Cloud Run, Vercel), probar rutas API clave, documentar 200/503 y actualizar el checklist.
3. **Documentar:** Actualizar PROJECT-STATE, y si fue full team: MATPROMT run34, Parallel/Serial, REPORT, Judge, Repo Sync; si fue acotado: al menos REPORT o entrada en PROJECT-STATE + E2E checklist.
4. **Itinerante:** Al terminar run34, **actualizar este archivo**: poner run34 en ✓ y escribir como “Siguiente RUN sugerido” el **RUN 35** (Presupuesto libre / canónico), con 2–3 líneas de objetivo y qué investigar. El siguiente agente que abra el repo leerá este handoff y hará run35 de la misma forma (investigar → ejecutar → documentar → sugerir run36).

---

## Cómo actualizar este handoff al terminar tu RUN

1. En **Estado al leer este handoff**: marcar tu run como ✓ y mover “Siguiente sugerido” al run que sigue.
2. En **RUN sugerido para ti**: reemplazar con el **siguiente número de run** (ej. RUN 35), objetivo breve, y los 4 pasos (investigar, ejecutar, documentar, itinerante) para que el próximo agente sepa qué hacer.
3. **Última actualización:** poner fecha del día.

Así cada agente escucha la sugerencia del RUN anterior, investiga el mejor camino, lo resuelve y deja la siguiente sugerencia para el siguiente agente.
