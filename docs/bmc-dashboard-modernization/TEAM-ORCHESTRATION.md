# BMC Dashboard — Team Orchestration

The BMC Dashboard agent is **orchestrated as a Team**. One orchestrator coordinates roles (skills) in order and passes handoffs.

---

## Orchestrator agent

**Agent:** `.cursor/agents/bmc-dashboard-team-orchestrator.md`

Use when you want to "run the full dashboard team," coordinate multiple skills in sequence, or assign roles and handoffs.

---

## Team roles (summary)

| Role | What it does |
|------|----------------|
| **Planilla & Dashboard Mapper** | Plan first; map sheets + dashboard (fields, location, functionality, localhost). |
| **Sheets Mapper** | Map sheets: inventory, types, GET/PUSH. |
| **Sheets Structure Editor** | Edit sheet structure (tabs, dropdowns, etc.); Matias only. |
| **Dependencies & Service Mapper** | Dependency graph, service map, integration checklist. |
| **Dashboard Designer** | Best practices, time-saving UX/UI, aesthetic + functional design. |
| **Implementation Plan & Reporter** | Reports and implementation plan for Solution and Coding teams. |

---

## How to run

- **Full team run:** Say e.g. "Run the BMC Dashboard team" or "Orchestrate the dashboard agent team." The orchestrator runs: plan → mapping (first task) → dependencies → design → implementation plan/report.
- **Partial run:** e.g. "Only mapping and dependencies" → orchestrator runs plan + Planilla/Dashboard Mapper + Dependencies & Service Mapper.
- **Single role:** e.g. "Run only the Dashboard Designer" → that skill with context from existing docs.

---

## Order and handoffs

1. Plan & proposal (PLAN-PROPOSAL-PLANILLA-DASHBOARD-MAPPING.md).
2. Planilla + dashboard mapping (first task) → planilla map, dashboard interface map, cross-reference.
3. Dependencies & service map → dependencies.md, service-map.md.
4. Dashboard design (best practices, time-saving) → proposal and/or code.
5. Implementation plan & report → REPORT-SOLUTION-CODING.md, IMPLEMENTATION-PLAN-SOLUTION-CODING.md.

Details and artifact paths: see the [orchestrator agent](../../.cursor/agents/bmc-dashboard-team-orchestrator.md).
