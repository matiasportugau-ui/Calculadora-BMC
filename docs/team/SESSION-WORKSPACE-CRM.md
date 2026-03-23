# Session & workspace CRM — Matias + agents

**Purpose:** One page for **this workspace** so you do not get lost between “what we finished” and “what is next.” `PROJECT-STATE.md` stays the **repo-wide** source of truth; this file is the **operating cockpit** for the **current stretch of work** (days or weeks) and for **each Cursor session** when you want clarity.

**When to open it:** Start of a work block, end of a session, or whenever you feel disoriented.

---

## 1. Current session (edit each time you sit down)

| Field | Value |
|--------|--------|
| **Date** | 2026-03-23 |
| **Focus (one line)** | PANELSIM: Handoff ejecutado + informe situación Sheets/API local |
| **Energy / time box** | *e.g. 90 min / full day* |
| **Definition of “done” for today** | *one measurable outcome* |

---

## 2. Last accomplishments (rolling — max 7 bullets)

> Keep the newest at the top. Move old lines to archive or delete. Do not duplicate `PROJECT-STATE` long history; summarize only what **you** need to remember.

- *Example: Hub Sheets docs unified under `docs/google-sheets-module/README.md` (mapper, sync map, variables 1:1).*
- 2026-03-23: **PANELSIM** — Handoff [`panelsim/matprompt/MATPROMT-HANDOFF-PANELSIM-2026-03-23.md`](./panelsim/matprompt/MATPROMT-HANDOFF-PANELSIM-2026-03-23.md); informe [`panelsim/reports/PANELSIM-SHEETS-SITUATION-2026-03-23.md`](./panelsim/reports/PANELSIM-SHEETS-SITUATION-2026-03-23.md) (API local: CRM 297 filas; ML OAuth pendiente).
- 2026-03-21: PROMPT «Próximos prompts» alineado con roadmap 32→39 (34–39 ✓ documental) y siguiente ciclo **run 52**; agenda manual sigue en `PROMPT-FOR-EQUIPO-COMPLETO.md`.
- 2026-03-21: Merge **`run36-audit-force`** → **`main`** + push (ver `PROJECT-STATE`); workstreams cockpit actualizados (sin merge pendiente en audit).

---

## 3. Active workstreams (kanban-lite)

Use short names. Drag mentally: only **one** “Doing” if you want less chaos.

| Stream | Status | Owner | Next physical action |
|--------|--------|-------|----------------------|
| Sheets / Pista 3 (tabs, triggers) | Waiting / Doing | Matias | Manual in Sheets — see `plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md` |
| Repo / Dependabot | Backlog | Matias | Opcional: GitHub Security / Dependabot vs `npm audit` local 0 tras merge run36 (`PROJECT-STATE` Cambios 2026-03-21) |
| E2E / prod smoke | Backlog | Matias + agent | `E2E-VALIDATION-CHECKLIST.md` — Cloud Run / Vercel |
| Calculadora / MATRIZ SKUs | Backlog | agent | Confirm placeholders vs planilla col.D — `REPORT-RUN37-MATRIZ-SKUS-2026-03-20.md` |

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

```
Before coding: read in order:
1) docs/team/SESSION-WORKSPACE-CRM.md (sections 1–4)
2) docs/team/PROJECT-STATE.md (Cambios recientes + Pendientes)
3) Task-specific file if any (issue, plan, or PROMPT-FOR-EQUIPO-COMPLETO.md)

Rules:
- Prefer updating SESSION-WORKSPACE-CRM.md + PROJECT-STATE.md after meaningful steps (per project protocol).
- Do not start a large refactor unless section 4 lists it.
- Say explicitly when "next task" is ready: inputs present, blockers cleared, definition of done clear.
```

**“Next task is ready” when:** inputs are in the repo or pasted in chat, scope is one deliverable, and blockers in section 4 are false or documented.

---

## 6. Canonical links (do not duplicate content here)

| Need | File |
|------|------|
| **Visual hub** (links + copy prompts / commands) | [WORKSPACE-CRM-HUB.html](./WORKSPACE-CRM-HUB.html) |
| Repo-wide state, pendientes, cambios | [PROJECT-STATE.md](./PROJECT-STATE.md) |
| Full team run input + próximos prompts | [PROMPT-FOR-EQUIPO-COMPLETO.md](./PROMPT-FOR-EQUIPO-COMPLETO.md) |
| Agent backlog / KB maturity | [IMPROVEMENT-BACKLOG-BY-AGENT.md](./IMPROVEMENT-BACKLOG-BY-AGENT.md) |
| Invoking the team | [INVOQUE-FULL-TEAM.md](./INVOQUE-FULL-TEAM.md) |
| Roadmap runs | [reports/RUN-ROADMAP-FORWARD-2026.md](./reports/RUN-ROADMAP-FORWARD-2026.md) |
| Pistas 1–8 | [plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md](./plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md) |

---

## 7. Optional: session log (one line per day)

| Date | Outcome in one line |
|------|---------------------|
| 2026-03-21 | Added SESSION-WORKSPACE-CRM.md; seeded from PROJECT-STATE. |
