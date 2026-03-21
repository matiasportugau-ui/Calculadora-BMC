# CEO AI Agent — Reference

## Quick reference

| Item | Value |
|------|-------|
| **Objective** | Project working by end of week |
| **Action** | Invoke full team run repeatedly until success |
| **Max runs** | 10 per CEO session |
| **Success** | Go-live criteria met; no critical blockers |

## Key files

| File | Purpose |
|------|---------|
| `docs/team/PROJECT-STATE.md` | Pendientes, Cambios recientes |
| `docs/bmc-dashboard-modernization/GO-LIVE-DASHBOARD-CHECKLIST.md` | Go-live items ☐/☑ |
| `docs/bmc-dashboard-modernization/IMPLEMENTATION-PLAN-POST-GO-LIVE.md` | Phases A–E |
| `docs/team/CEO-RUN-SUMMARY.md` | CEO run log (create if missing) |

## mcp_task invocation

```
subagent_type: bmc-dashboard-team-orchestrator
description: Full team run — Invoque full team
prompt: Execute full team run steps 0→9, all 19 members. Focus: close pendientes, advance go-live. Return summary and remaining blockers.
```

## Handoff to user

When all remaining items require Matias (manual tabs, triggers, deploy decision):

- Document in CEO-RUN-SUMMARY
- Report: "CEO run complete. Full team ran N times. Remaining: [list]. These require Matias manual action."
