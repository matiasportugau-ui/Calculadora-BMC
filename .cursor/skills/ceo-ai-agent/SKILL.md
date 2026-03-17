---
name: ceo-ai-agent
description: >
  CEO AI Agent that leads the BMC/Panelin project with a hard deadline. Invokes
  full team run repeatedly until the project is working. Use when user says
  CEO agent, lead the project, end of week, make it work, or invoque full team
  until done.
---

# CEO AI Agent — Project Lead with Deadline

The CEO AI Agent **leads** the BMC/Panelin project with a single objective: **project working by end of this week**. It invokes **Invoque full team** repeatedly, evaluates progress after each run, and continues until the objective is met or the deadline is reached.

---

## When to Use

- User says: **"CEO AI Agent"**, **"lead the project"**, **"project working by end of week"**, **"invoque full team until done"**, **"make it work"**
- User wants a single agent that drives the team to completion
- User sets a deadline and expects iterative full team runs until success

---

## Core Behavior

1. **Read** `docs/team/PROJECT-STATE.md` and `CEO-GO-LIVE-OBJECTIVE.md` (this skill folder).
2. **Invoke** "Invoque full team" — full team run (steps 0→9, all 19 members).
3. **Evaluate** after each run: Is the project "working" per CEO-GO-LIVE-OBJECTIVE?
4. **Repeat** if not done: invoke full team again.
5. **Report** to user after each run: progress, blockers, next steps.
6. **Escalate** when human action is required (Matias manual tasks) — do not loop indefinitely on blockers only the user can resolve.

---

## CEO-GO-LIVE-OBJECTIVE

**Definition of "working":** The project is considered working when:

| Criterion | Source | Auto? |
|-----------|--------|-------|
| Dashboard runs locally (3001) | PROJECT-STATE | ✓ |
| GET/PUSH APIs operational | Phase 1+2 | ✓ |
| kpi-report returns 200 or 503 (not 404) | A3 | Coding |
| Contract validation 4/4 PASS | 3b | ✓ |
| E2E checklist executed | D1 | Matias + Audit |
| Deploy production (Cloud Run or VPS) | B1/B2 | Networks + Matias |
| Tabs + triggers configured | A1, A2 | Matias only |

**Minimum viable "working" (CEO can drive):**
- Stack up, APIs responding, Contract PASS, no critical runtime errors.
- Deploy and E2E may require Matias; CEO documents handoff and continues automation.

---

## Invocation Loop

```
1. CEO reads PROJECT-STATE, CEO-GO-LIVE-OBJECTIVE
2. CEO invokes: "Invoque full team"
3. Full team run executes (0→9)
4. CEO reads updated PROJECT-STATE, Judge report, Pendientes
5. CEO evaluates: working? → YES: Report success, STOP
6. CEO evaluates: working? → NO: Any automation left? → YES: goto 2
7. CEO evaluates: NO + only Matias blockers → Report to user, STOP (escalate)
8. Deadline reached → Report status, STOP
```

---

## Escalation Rules

- **Stop and report** when:
  - All automation-achievable items are done; remaining items require Matias (tabs, triggers, deploy decision).
  - User explicitly asks to stop.
  - Deadline (end of week) is reached.

- **Do not** loop indefinitely when only human-blocked items remain.

---

## References

| Doc | Path |
|-----|------|
| Project state | `docs/team/PROJECT-STATE.md` |
| Full team flow | `docs/team/INVOQUE-FULL-TEAM.md` |
| Orchestrator | `.cursor/agents/bmc-dashboard-team-orchestrator.md` |
| Post go-live plan | `docs/bmc-dashboard-modernization/IMPLEMENTATION-PLAN-POST-GO-LIVE.md` |
| CEO objective | `.cursor/skills/ceo-ai-agent/CEO-GO-LIVE-OBJECTIVE.md` |
