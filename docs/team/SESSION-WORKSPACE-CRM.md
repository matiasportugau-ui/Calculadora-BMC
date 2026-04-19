# Session & workspace CRM — Matias + agents

**Purpose:** One page for **this workspace** so you do not get lost between “what we finished” and “what is next.” `PROJECT-STATE.md` stays the **repo-wide** source of truth; this file is the **operating cockpit** for the **current stretch of work** (days or weeks) and for **each Cursor session** when you want clarity.

**When to open it:** Start of a work block, end of a session, or whenever you feel disoriented.

**Prioridad operativa (rolling):** La prioridad del día o la semana debe alinearse con `**docs/team/PROJECT-STATE.md` → Cambios recientes** (correo, E2E, Go-live, tooling). No sustituye el roadmap de runs en `PROMPT-FOR-EQUIPO-COMPLETO.md`; evita que un solo bloque «Próximos prompts run N» opaque pendientes operativos recientes.

---

## 1. Current session (edit each time you sit down)


| Field                              | Value                                                                                                                                                                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Date**                           | 2026-04-18                                                                                                                                                                                                                                                                       |
| **Focus (one line)**               | **Plan óptimo ejecutado** — smoke + `wa:cloud-check --probe` + `ml:verify` prod + `email:ingest-snapshot --dry-run`; programa **cm-0/cm-1** cerradas; **cm-2** con dry-run OK (ingest real CRM cuando toque).                                                                                        |
| **Energy / time box**              | —                                                                                                                                                                                                                                                                                |
| **Definition of “done” for today** | Evidencia CLI + `.channels/last-pipeline.json`; **cm-0** abierto hasta Meta/webhook + fila CRM verificada ([`HUMAN-GATES-ONE-BY-ONE.md`](./HUMAN-GATES-ONE-BY-ONE.md)).                                                                                                           |


### 1.1 Full Team Run — checklist rápido (antes de “Invoque full team”)

Definición canónica: `[FULL-TEAM-RUN-DEFINITION.md](./FULL-TEAM-RUN-DEFINITION.md)`.


| ✓   | Ítem                                                                                          |
| --- | --------------------------------------------------------------------------------------------- |
| ☐   | **Objetivo central del run** en 1–3 frases (¿qué cierra o avanza este ciclo?)                 |
| ☐   | **Definition of Done** del objetivo (condiciones medibles; human gates si aplica)             |
| ☐   | **Run Scope Matrix** planeada (Profundo / Ligero / N/A por rol §2)                            |
| ☐   | **PROMPT + BACKLOG** leídos; paso 9 previsto (próximos prompts para la *siguiente* iteración) |
| ☐   | Tras el run: **Judge** + **PROJECT-STATE** + **7b docs** + actualización PROMPT/backlog       |


---

## 2. Last accomplishments (rolling — max 7 bullets)

> Keep the newest at the top. Move old lines to archive or delete. Do not duplicate `PROJECT-STATE` long history; summarize only what **you** need to remember.

- 2026-04-18: **Plan próximos pasos (repo)** — `npm run smoke:prod` OK; `PUBLIC_BASE_URL=…642127786762… npm run wa:cloud-check -- --probe` OK (`OK_META`); `BMC_API_BASE=… npm run ml:verify` OK (token ML); `email:ingest-snapshot --dry-run --limit 5` OK. `scripts/smoke-prod-api.mjs` `DEFAULT_BASE` alineado a `public_base_url`. Informes [`reports/CM0-WHATSAPP-VERIFICATION-2026-04-18.md`](./reports/CM0-WHATSAPP-VERIFICATION-2026-04-18.md), [`reports/CM2-EMAIL-INGEST-DRYRUN-2026-04-18.md`](./reports/CM2-EMAIL-INGEST-DRYRUN-2026-04-18.md). `bmc-panelin-master.json`: **cm-0** y **cm-1** → `done`; **cm-2** sigue `doing` hasta ingest real opcional. Pendiente humano: **`WHATSAPP_APP_SECRET`** en Cloud Run ([`WHATSAPP-META-E2E.md`](./WHATSAPP-META-E2E.md) §1.1).
- 2026-04-17: **Plan BMC run (pipeline ligero)** — Lecturas canónicas + `gate:local` + `smoke:prod` + `project:compass` + `channels:automated --write` → `.channels/last-pipeline.json`; **`humanGate` → cm-0**. `PROJECT-STATE` + `PROMPT` actualizados; no reemplaza Invoque full team 0→9.
- 2026-04-01: **v3.1.3** — `BmcLogisticaApp` + `bmcLogisticaCargo.js`; `App.jsx` rutas logística; `server/index.js` SPA fallback `/calculadora/*`; `gate:local:full` OK; `PROJECT-STATE` actualizado.
- 2026-03-31: **Calculadora — producción canónica + release** — Docs: [`CANONICAL-PRODUCTION.md`](../calculadora/CANONICAL-PRODUCTION.md), [`RELEASE-CHECKLIST-CALCULADORA.md`](../calculadora/RELEASE-CHECKLIST-CALCULADORA.md), [`CALCULADORA-LAUNCH-GAPS.md`](../calculadora/CALCULADORA-LAUNCH-GAPS.md), [`RELEASE-BRIEF-OFFICIAL.md`](../calculadora/RELEASE-BRIEF-OFFICIAL.md). `PROJECT-STATE` actualizado. Launch core = cotizador + MATRIZ + PDF; logística en ruta propia.
- 2026-03-28: **Full team sync (asistente)** — `bmc-project-team-sync`: `PROJECT-STATE` + `PROMPT` + `SESSION` alineados; `npm run project:compass` (p2, ~31% / ~45%); `npm run gate:local` **165 passed**; git **`main`** limpio vs `origin/main` (HEAD `c8dd50c`). No reemplaza Invoque full team 0→9 + MATPROMT 0a.
- 2026-03-28: **MATPROMT run56** — `[matprompt/MATPROMT-RUN-2026-03-28-run56.md](matprompt/MATPROMT-RUN-2026-03-28-run56.md)` (prompts por rol §2 + Run Scope Matrix); informe `[reports/REPORT-FULL-TEAM-MODIFICATIONS-2026-03-28-run56.md](reports/REPORT-FULL-TEAM-MODIFICATIONS-2026-03-28-run56.md)` (modificaciones + mejoras vs riesgo pérdida de información); `[MATPROMT-FULL-RUN-PROMPTS.md](MATPROMT-FULL-RUN-PROMPTS.md)` actualizado.
- 2026-03-28: **Run Scope Gate + RUN-MODES-AND-TRIGGERS** — Protocolos R1–R4 documentados; `RUN-SCOPE-GATE.md` con matriz Profundo/Ligero/N/A; **Docs & Repos Organizer** incorporado a §2 (paso 7b); **Telegram Scout** agente + `telegram/WATCHLIST.md`; orquestador alineado pasos 7→7b→8→9; coherencia INVOQUE↔Orquestador verificada.
- 2026-03-27: **Plan PROJECT-STATE ejecutado (repo)** — `gate:local:full`, `smoke:prod` OK; curls prod (kpi-report 200, cotizaciones 503, calculadora/finanzas 200); MATRIZ reconcile duplicados documentados; nuevos `RUN55-OPERATOR-CHECKLIST.md`, E2E §2026-03-27, nota MONTO en planilla-inventory; PROMPT run 55 con subestado. Run 55 **no 17746900583041774690435011cerrado** (pasos humanos pendientes).
- 2026-03-27: **Sync + compass** — `package.json`: scripts `program:status`, `project:compass`, `followup`, `channels:*`, `email:ingest-snapshot`, `matriz:reconcile` alineados a `AGENTS.md`; `npm run gate:local` **165 passed**; `main` limpio vs `origin`. Run **55** sigue abierto en `PROMPT-FOR-EQUIPO-COMPLETO.md` hasta cierre formal con Orquestador/MATPROMT.
- 2026-03-24: **Sincronización completa equipo** — skill `bmc-project-team-sync`: `PROJECT-STATE` entrada nueva (CI **119** + 1 warning ESLint; git **0/0** vs `origin`; WIP listado); siguiente run numerado **55** en PROMPT; no reemplaza Invoque full team 0→9 + MATPROMT.
- 2026-03-24: **Run 55** — WA Cloud API webhook live (`chatbo2`, Phone ID `857133467479731`); auto-trigger 5min inactivity (no más 🚀); `POST /api/crm/parse-email` endpoint; Apps Script v2 (row fix + batch + lock); Cloud Run rev `panelin-calc-00031-4r2`; email ingest pipeline diseñado (6 cuentas IMAP, clasificación "ventas" → CRM).
- 2026-03-24: **Full team sync** — `PROJECT-STATE`: «verificación CI + árbol git» (última pasada) + entrada previa «full update + verify»; gate **119** (1 ESLint warning opcional `calculatorConfig.js`); git **0/0** vs `origin`; WIP: `bmcDashboard` suggest-response, `package.json`/lock, `.env.example`, ML/CRM, Dockerfile, team docs.
- 2026-03-23: **PANELSIM** — Handoff `[panelsim/matprompt/MATPROMT-HANDOFF-PANELSIM-2026-03-23.md](./panelsim/matprompt/MATPROMT-HANDOFF-PANELSIM-2026-03-23.md)`; informe `[panelsim/reports/PANELSIM-SHEETS-SITUATION-2026-03-23.md](./panelsim/reports/PANELSIM-SHEETS-SITUATION-2026-03-23.md)` (API local: CRM 297 filas; ML OAuth pendiente).
- 2026-03-21: PROMPT «Próximos prompts» alineado con roadmap 32→39 (34–39 ✓ documental) y siguiente ciclo **run 52**; agenda manual sigue en `PROMPT-FOR-EQUIPO-COMPLETO.md`.
- 2026-03-21: Merge `**run36-audit-force`** → `**main**` + push (ver `PROJECT-STATE`); workstreams cockpit actualizados (sin merge pendiente en audit).

---

## 3. Active workstreams (kanban-lite)

Use short names. Drag mentally: only **one** “Doing” if you want less chaos.


| Stream                            | Status               | Owner          | Next physical action                                                          |
| --------------------------------- | -------------------- | -------------- | ----------------------------------------------------------------------------- |
| ~~503 `/api/cotizaciones`~~       | ✅ CERRADO 2026-03-28 | agent          | `BMC_SHEET_SCHEMA=CRM_Operativo` → rev `00041-t8x` → 200/297 filas            |
| ~~MATRIZ dups (7 paths)~~         | ✅ CERRADO 2026-03-28 | Matias + agent | SKUs planilla + mapping corregidos → deploy `00042-2mn` → `ok: true` 48 paths |
| Sheets / Pista 3 (tabs, triggers) | Waiting / Doing      | Matias         | Manual in Sheets — see `plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md`           |
| E2E / prod smoke                  | Backlog              | Matias + agent | `E2E-VALIDATION-CHECKLIST.md` — Cloud Run / Vercel                            |
| Repo / Dependabot                 | Backlog              | Matias         | Opcional: GitHub Security / Dependabot vs `npm audit` local 0                 |


---

## 4. Next actions (numbered — max 5)

1. **Read** `PROJECT-STATE.md` → “Pendientes” + latest “Cambios recientes”.
2. **Pick one** item from section 3 and define “done”.
3. **Update** section 2 when you finish something meaningful.
4. *Add your own…*

**Blocked by:** *credentials / decision / external person / nothing*

---

## 5. For the AI agent — auto-start checklist

Copy-paste into a new chat when you want the model **fully oriented** without re-explaining:

```text
Before coding: read in order:
1) docs/team/SESSION-WORKSPACE-CRM.md (sections 1–4)
2) docs/team/PROJECT-STATE.md (Cambios recientes + Pendientes)
3) npm run project:compass — fase, %, próximos pasos + follow-ups vencidos (índice: docs/team/PROJECT-SCHEDULE.md)
4) Task-specific file if any (issue, plan, or PROMPT-FOR-EQUIPO-COMPLETO.md)

PANELSIM / cotizaciones con precios reales (Sheets + MATRIZ):
- npm run panelsim:env   — verifica .env, GOOGLE_APPLICATION_CREDENTIALS, IDs BMC_* (incl. MATRIZ por default), correo service account para compartir en Drive
- npm run start:api     — luego GET /api/* y GET /api/actualizar-precios-calculadora para MATRIZ

Rules:
- Prefer updating SESSION-WORKSPACE-CRM.md + PROJECT-STATE.md after meaningful steps (per project protocol).
- Do not start a large refactor unless section 4 lists it.
- Say explicitly when "next task" is ready: inputs present, blockers cleared, definition of done clear.
```

**“Next task is ready” when:** inputs are in the repo or pasted in chat, scope is one deliverable, and blockers in section 4 are false or documented.

---

## 6. Canonical links (do not duplicate content here)


| Need                                             | File                                                                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Visual hub** (links + copy prompts / commands) | [WORKSPACE-CRM-HUB.html](./WORKSPACE-CRM-HUB.html)                                                               |
| **Cronograma + rutina + seguimiento unificado**  | [PROJECT-SCHEDULE.md](./PROJECT-SCHEDULE.md) — `npm run project:compass` (alias `npm run schedule`)              |
| **WhatsApp → ML → Correo (checklist)**           | [PROCEDIMIENTO-CANALES-WA-ML-CORREO.md](./PROCEDIMIENTO-CANALES-WA-ML-CORREO.md) — `npm run channels:onboarding` |
| **Programa maestro (JSON)**                      | [orientation/README.md](./orientation/README.md) — `npm run program:status`                                      |
| Repo-wide state, pendientes, cambios             | [PROJECT-STATE.md](./PROJECT-STATE.md)                                                                           |
| Full team run input + próximos prompts           | [PROMPT-FOR-EQUIPO-COMPLETO.md](./PROMPT-FOR-EQUIPO-COMPLETO.md)                                                 |
| Agent backlog / KB maturity                      | [IMPROVEMENT-BACKLOG-BY-AGENT.md](./IMPROVEMENT-BACKLOG-BY-AGENT.md)                                             |
| Invoking the team                                | [INVOQUE-FULL-TEAM.md](./INVOQUE-FULL-TEAM.md)                                                                   |
| Full Team Run (definición + loop + iteración)    | [FULL-TEAM-RUN-DEFINITION.md](./FULL-TEAM-RUN-DEFINITION.md)                                                     |
| Run modes (R1–R4) + triggers + cómo encargar     | [RUN-MODES-AND-TRIGGERS.md](./RUN-MODES-AND-TRIGGERS.md), [RUN-SCOPE-GATE.md](./RUN-SCOPE-GATE.md)               |
| Roadmap runs                                     | [reports/RUN-ROADMAP-FORWARD-2026.md](./reports/RUN-ROADMAP-FORWARD-2026.md)                                     |
| Pistas 1–8                                       | [plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md](./plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md)                       |


---

## 7. Optional: session log (one line per day)


| Date       | Outcome in one line                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------ |
| 2026-03-28 | Run Scope Gate (R1–R4), RUN-MODES-AND-TRIGGERS, Docs & Repos Organizer §2, Telegram Scout.       |
| 2026-03-27 | Run 55 formal; gates humanos cm-0/1/2 pendientes; smoke prod OK; MATRIZ duplicados documentados. |
| 2026-03-21 | Added SESSION-WORKSPACE-CRM.md; seeded from PROJECT-STATE.                                       |


can you run for me 