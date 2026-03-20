# Handoff itinerante — siguiente RUN

**Propósito:** El agente que lea este archivo toma el relevo del flujo **itinerante** de runs (full team 32→33→34→…). Debe: **(1)** ejecutar el RUN sugerido abajo; **(2)** investigar la mejor opción, solución o camino para ese RUN; **(3)** resolverlo y documentar; **(4)** al terminar, actualizar este handoff con la **siguiente sugerencia de RUN** y seguir trabajando itinerantemente (el próximo agente hará lo mismo).

**Última actualización:** 2026-03-20 (post run34)

---

## Estado al leer este handoff

| Run | Estado | Nota |
|-----|--------|------|
| **32** | ✓ | Full team sync; contratos; artefactos en repo. |
| **33** | ✓ | Full team; Pista 3 coordinación + Mapping; handoff Matias; artefactos commitados. |
| **34** | ✓ | Smoke post-Sheets ejecutado; E2E checklist actualizado; Cloud Run/Vercel curl documentado. |
| **35** | **← Siguiente sugerido** | Ver abajo. |
| 36–39 | Pendientes | Roadmap: `reports/RUN-ROADMAP-FORWARD-2026.md`. |

---

## RUN sugerido para ti (próximo agente)

### RUN 35 — Presupuesto libre / canónico

**Objetivo (roadmap):** Run **27** autopilot: paridad o ADR `backup` vs `V3`; opcional `PRESUPUESTO_LIBRE_IDS`. Roles foco: Calc, Design, Mapping. Entregable: Código o ADR + tests verdes. No hay dependencia bloqueante.

**Qué hacer:**

1. **Investigar** la mejor opción o camino: leer `docs/team/PROJECT-STATE.md` (Presupuesto libre, backup vs V3), `docs/team/HANDOFF-NEXT-AGENT-PRESUPUESTO-LIBRE-2026-03-20.md`, `reports/RUN-ROADMAP-FORWARD-2026.md` (run35). Decidir si hace falta **paridad** entre `PanelinCalculadoraV3_backup.jsx` y `PanelinCalculadoraV3.jsx` en presupuesto libre, o redactar un **ADR** (Architecture Decision Record) dejando backup como canónico o V3 como único; opcional acotar tornillería a `PRESUPUESTO_LIBRE_IDS`. Revisar tests (`npm test`) y que sigan verdes.
2. **Ejecutar** ese plan: ya sea cambios de código (paridad, constantes, IDs) o documento ADR en `docs/` + actualización de PROJECT-STATE.
3. **Documentar:** Actualizar PROJECT-STATE (Cambios recientes run35); si fue full team, generar MATPROMT run35, REPORT, Judge, Repo Sync; si fue acotado, al menos entrada en PROJECT-STATE y opcional REPORT corto.
4. **Itinerante:** Al terminar run35, **actualizar este archivo**: poner run35 en ✓ y escribir como “Siguiente RUN sugerido” el **RUN 36** (Audit `--force`), con 2–3 líneas de objetivo y los 4 pasos para el próximo agente (investigar, ejecutar, documentar, itinerante). RUN 36 requiere aprobación Matias para `npm audit fix --force`; el agente puede investigar, documentar opciones y dejar decisión o rama lista.

---

## Cómo actualizar este handoff al terminar tu RUN

1. En **Estado al leer este handoff**: marcar tu run como ✓ y mover “Siguiente sugerido” al run que sigue.
2. En **RUN sugerido para ti**: reemplazar con el **siguiente número de run** (ej. RUN 36), objetivo breve, y los 4 pasos (investigar, ejecutar, documentar, itinerante) para que el próximo agente sepa qué hacer.
3. **Última actualización:** poner fecha del día.

Así cada agente escucha la sugerencia del RUN anterior, investiga el mejor camino, lo resuelve y deja la siguiente sugerencia para el siguiente agente.
