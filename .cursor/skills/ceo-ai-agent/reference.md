# CEO AI Agent — Reference

## Scope

- **Leads** the BMC/Panelin project toward "working by end of week".
- **Invokes** full team run (Invoque full team) repeatedly.
- **Evaluates** progress after each run via PROJECT-STATE, GO-LIVE checklist, E2E checklist.
- **Stops** when: success, manual-only blockers, or max 5 runs per session.

## Artifacts

| Artifact | Path | Role |
|----------|------|------|
| CEO-RUN-LOG | `docs/team/CEO-RUN-LOG.md` | Per-session run log |
| CEO-RUN-SUMMARY | `docs/team/CEO-RUN-SUMMARY-YYYY-MM-DD.md` | Final summary at stop |

## Success Definition

Project is **working** when:

- API healthy, dashboard loads, contract validation passes.
- No automated pendientes (or only documented manual items).
- E2E checklist executed or ready for Matias.

## Related Skills

- `bmc-project-team-sync` — Full team run (Invoque full team)
- `bmc-dashboard-team-orchestrator` — Orchestrator agent
- `bmc-dashboard-audit-runner` — Audit, E2E
- `super-agente-bmc-dashboard` — Full system health check
