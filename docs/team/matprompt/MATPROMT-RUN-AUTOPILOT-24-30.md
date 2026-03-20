# MATPROMT — AUTOPILOT Runs 24–30

**Propósito:** Bundle de prompts **compactos** por run para “Invoque full team” sin redactar 7 archivos en cada paso. Cada run asume lectura previa de `PROJECT-STATE.md` y [SOLUCIONES-UNO-POR-UNO-2026-03-20.md](../plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md).

**Índice Reporter/Judge/Parallel:** ver [`../reports/AUTOPILOT-FULL-TEAM-RUNS-24-30.md`](../reports/AUTOPILOT-FULL-TEAM-RUNS-24-30.md)

---

## Run 24 — Git baseline

- **Todos:** No commitear `.env`; revisar diff sensible.
- **Repo Sync:** Push a remoto configurado; lista de archivos si hay sync a `bmc-development-team`.
- **Orchestrator:** Actualizar PROJECT-STATE “Pista 1” ✓/bloqueo.
- **DELTA:** Si solo docs, Calc puede N/A.

## Run 25 — Smoke prod

- **Networks:** curl + nota URL; CORS solo si hay error reproducible.
- **Contract:** 404 vs 503 — semántica acorde AGENTS.md.
- **Audit:** Marcar E2E checklist; screenshot opcional.
- **DELTA:** Si API caída por deploy, Networks + GPT/Cloud mínimo.

## Run 26 — Sheets

- **Sheets Structure:** Ejecutar checklist AUTOMATIONS; no renombrar tabs sin avisar Mapping.
- **Mapping:** Diff `planilla-inventory.md` si cambia schema.
- **Dependencies:** Fecha en service-map.
- **DELTA:** Nuevo tab → posible ruta API → Contract + Calc dashboard.

## Run 27 — Calc backup / libre

- **Calc:** Paridad Presupuesto libre o ADR “backup deprecado”.
- **Design:** Misma jerarquía visual que V3 canónico.
- **Mapping:** Si filtro `PRESUPUESTO_LIBRE_IDS`, validar MATRIZ.
- **DELTA:** Solo uno de: port UI **o** doc deprecación.

## Run 28 — Audit force

- **Security:** Rama aislada; sin `--force` en main sin aprobación.
- **Audit:** `build` obligatorio post-fix.
- **DELTA:** Si rollback, CHANGELOG “intentado y revertido”.

## Run 29 — SKUs + billing

- **Mapping:** Cruce col.D; no hardcodear sheet IDs.
- **Fiscal/Billing:** Una nota de riesgo en PROJECT-STATE si hay huecos datos.
- **DELTA:** Solo negocio confirma precios sensibles.

## Run 30 — Cierre autopilot

- **MATPROMT:** Añadir fila histórico MATPROMT-FULL-RUN-PROMPTS (autopilot 24–30).
- **Judge:** Actualizar JUDGE-REPORT-HISTORICO con línea agregada o por evidencia real.
- **Orchestrator:** PROMPT “Próximos prompts” = agenda post-30 (tabs si pendiente, E2E completo, OAuth, etc.).
- **DELTA:** Ninguno salvo nueva orden usuario.

---

## Rol §2 — recordatorio transversal (todos los runs 24–30)

- **bmc-project-team-sync:** Tras cierre real de cada run, entrada en PROJECT-STATE “Cambios recientes”.
- **ai-interactive-team:** Solo si dos áreas chocan (ej. nombre tab vs código API).
