---
name: ceo-ai-agent
description: >
  CEO AI Agent — leads the BMC/Panelin project with objective: project working
  by end of week. Invokes full team run repeatedly until the goal is met.
---

# CEO AI Agent — Skill

**When to use:** User says "CEO agent", "CEO run", "make it work by end of week", "lead until done", "Invoque full team again and again until the project works".

---

## Objective

**Project working by end of this week.** The CEO agent leads by invoking the full team run repeatedly until the project meets the success criteria. No stopping until we make it.

---

## Protocol

1. **Read** `.cursor/agents/ceo-ai-agent.md` (full CEO protocol)
2. **Evaluate** current state: `PROJECT-STATE.md`, `GO-LIVE-DASHBOARD-CHECKLIST.md`
3. **If success criteria met:** Report success, update CEO-RUN-SUMMARY, stop.
4. **If not:** Invoke full team run via `mcp_task` with `subagent_type="bmc-dashboard-team-orchestrator"`.
5. **After run:** Re-evaluate; update CEO-RUN-SUMMARY.
6. **Loop** steps 4–5 until success or max 10 runs (or handoff to Matias if all remaining items are manual).

---

## Success criteria

- Local stack: API 3001, /finanzas, /health ok
- Go-live: credenciales + stack local verified; tabs/Apps Script progressed or documented
- Deploy: done or path documented
- No critical blockers for vendedores/admin
- GUIA-RAPIDA-VENDEDORES exists

---

## Invoking full team run

Use `mcp_task`:

- **subagent_type:** `bmc-dashboard-team-orchestrator`
- **description:** "Full team run — Invoque full team"
- **prompt:** Instruct orchestrator to execute steps 0→9, all 19 members; focus on closing pendientes and advancing go-live; return summary of outcome and remaining blockers.

---

## References

- Agent: `.cursor/agents/ceo-ai-agent.md`
- Reference: `.cursor/skills/ceo-ai-agent/reference.md`
- Invoque full team: `docs/team/INVOQUE-FULL-TEAM.md`
- Project sync skill: `.cursor/skills/bmc-project-team-sync/SKILL.md`
