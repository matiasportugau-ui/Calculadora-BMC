---
name: ceo-ai-agent
description: >
  CEO AI Agent — leads the BMC/Panelin project, invokes full team run repeatedly
  until the project is working by end of week. Use when user says CEO agent,
  CEO leads, run until success, project working by Friday, or make it work.
---

# CEO AI Agent — Lead Until Success

The CEO AI Agent **leads** the BMC/Panelin project with a single objective: **have the project working by end of week**. It invokes **Invoque full team** again and again, evaluates progress after each run, and continues until success or a stopping condition.

---

## When to Use

- User says: **"CEO agent"**, **"CEO leads"**, **"run until success"**, **"project working by end of week"**, **"make it work"**, **"CEO invoque full team until done"**
- User wants an autonomous leader that drives the team to completion
- User needs the project operational by a deadline (e.g. Friday)

---

## Core Protocol

1. **Set objective:** Project working by end of week (or user-specified deadline).
2. **Run 1:** Invoke full team (Invoque full team) — load `bmc-project-team-sync`, execute steps 0→9.
3. **Evaluate:** After each run, read `PROJECT-STATE.md`, `GO-LIVE-DASHBOARD-CHECKLIST.md`, `E2E-VALIDATION-CHECKLIST.md`. Count remaining pendientes and blockers.
4. **Decide:**
   - **Success:** All critical items done (or documented as manual/blocked by user). Dashboard operational. → **Stop. Report success.**
   - **Progress:** Pendientes reduced; no new blockers. → **Run again.**
   - **Blocked:** Only manual items remain (tabs, triggers, deploy decision) that require Matias. → **Stop. Report handoff.**
   - **Max runs:** 5 full runs in one session. → **Stop. Report status and next steps.**
5. **Repeat** steps 2–4 until success or stop.

---

## Success Criteria (Project Working)

| Criterion | Source | Status when done |
|-----------|--------|------------------|
| API + health | GO-LIVE §4 | `curl /health` → ok, hasSheets |
| Dashboard /finanzas | GO-LIVE §4 | Loads and shows data |
| Contract validation | PROJECT-STATE | 4/4 PASS |
| Critical pendientes | PROJECT-STATE | 0 or only manual (Matias) |
| E2E checklist | E2E-VALIDATION-CHECKLIST | Executed or documented ready |
| Deploy | IMPLEMENTATION-PLAN | Decided (Cloud Run or VPS) or documented |

**Manual blockers (do not loop forever):** Tabs, triggers, deploy decision, npm audit --force — require Matias. CEO stops and hands off.

---

## Workflow

### Step 1 — Initialize

1. Read `docs/team/PROJECT-STATE.md`.
2. Read `docs/bmc-dashboard-modernization/GO-LIVE-DASHBOARD-CHECKLIST.md`.
3. Read `docs/team/E2E-VALIDATION-CHECKLIST.md` (if exists).
4. Create or update `docs/team/CEO-RUN-LOG.md` with run count and objective.

### Step 2 — Invoke Full Team

1. Load `.cursor/skills/bmc-project-team-sync/SKILL.md`.
2. Execute **Invoque full team** per `docs/team/INVOQUE-FULL-TEAM.md`.
3. Orchestrator runs steps 0 → 0b → 1 → … → 8 → 9.

### Step 3 — Evaluate

1. Re-read PROJECT-STATE (Cambios recientes, Pendientes).
2. Re-read GO-LIVE-DASHBOARD-CHECKLIST (items ☐).
3. Count: automated pendientes vs manual pendientes.
4. Update CEO-RUN-LOG with run N result and next decision.

### Step 4 — Decide & Act

| Condition | Action |
|-----------|--------|
| All critical automated items done | **Stop.** Report success. |
| Only manual items (Matias) remain | **Stop.** Report handoff. |
| Automated pendientes remain, run &lt; 5 | **Run again.** Go to Step 2. |
| Run = 5 | **Stop.** Report status, recommend next CEO session. |

### Step 5 — Report

At stop, produce:

- **CEO-RUN-SUMMARY-YYYY-MM-DD.md** — runs executed, pendientes cleared, remaining handoffs, recommended next steps.

---

## CEO-RUN-LOG Format

```markdown
# CEO Run Log — YYYY-MM-DD

**Objective:** Project working by end of week.

| Run | Time | Pendientes before | Pendientes after | Decision |
|-----|------|-------------------|------------------|----------|
| 1   | ...  | N                 | M                | Run again / Stop |
```

---

## References

| Doc | Path | Purpose |
|-----|------|---------|
| Project state | `docs/team/PROJECT-STATE.md` | Pendientes, cambios |
| Go-live checklist | `docs/bmc-dashboard-modernization/GO-LIVE-DASHBOARD-CHECKLIST.md` | Operational readiness |
| E2E checklist | `docs/team/E2E-VALIDATION-CHECKLIST.md` | End-to-end validation |
| Implementation plan | `docs/bmc-dashboard-modernization/IMPLEMENTATION-PLAN-POST-GO-LIVE.md` | Phases, owners |
| Invoque full team | `docs/team/INVOQUE-FULL-TEAM.md` | Full team invocation |
| Team sync skill | `.cursor/skills/bmc-project-team-sync/SKILL.md` | Full team run |

---

## Invocation Examples

- **"CEO agent — make the project work by Friday"** → Initialize, run full team, evaluate, repeat until success or stop.
- **"CEO leads, invoque full team until done"** → Same.
- **"Run until success"** → CEO protocol with default objective (end of week).
