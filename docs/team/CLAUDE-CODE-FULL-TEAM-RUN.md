# Full Team Run — Claude Code Guide

**Audience:** Matias working in Claude Code (CLI or desktop app) on the `calculadora-bmc.vercel.app` project.  
**Complements:** [`FULL-TEAM-RUN-DEFINITION.md`](./FULL-TEAM-RUN-DEFINITION.md) (canonical definition), [`RUN-SCOPE-GATE.md`](./RUN-SCOPE-GATE.md) (depth matrix).  
**Agent definitions:** `.claude/agents/` in this repo.

---

## What a full team run is

A coordinated cycle where every domain of the project is touched in order, with explicit handoffs between roles, quality evaluation at the end, and next steps documented. The goal is not to run every agent at maximum depth — it is to **close a cross-area objective** with traceability.

Think of it as a standup + sprint review + retrospective all in one automated cycle.

---

## When to use it vs. when NOT to

### Use a full team run when:
- A change touches **more than one domain** (e.g., new Sheets column → API change → UI update)
- You want a **full health check** of the project across all areas
- You're starting a new feature that has cross-cutting impact
- You haven't run the team in a while and want to catch drift

### Do NOT use a full team run when:
- The change is isolated to one area (single component fix, docs update, test fix)
- You just need a security review or a deploy check — invoke that single agent directly
- Prerequisites aren't met (see below)

### Lightweight alternatives (cheaper, faster):
| Situation | What to invoke |
|-----------|----------------|
| Close a work session | `bmc-docs-sync` → `bmc-judge` |
| Pre-deploy check | `bmc-security` → `bmc-deployment` |
| After API change | `bmc-api-contract` |
| After calc logic change | `bmc-calc-specialist` |

---

## Prerequisites before running

- [ ] `npm run gate:local:full` passes (lint + test + build)
- [ ] All agents listed in `docs/team/PROJECT-TEAM-FULL-COVERAGE.md §2`
- [ ] `docs/team/PROJECT-STATE.md` is readable (not stale by months)
- [ ] You have a clear objective for the run (not just "check everything")

---

## How to trigger

Just say in Claude Code:

```
full team run — objective: [what you're trying to close]
```

Examples:
```
full team run — objective: validate the new Sheets column we added to CRM_Operativo is exposed correctly in the API and reflected in UI
```
```
full team run — objective: weekly health check, no specific change
```

The `bmc-orchestrator` agent picks this up and runs the pipeline.

---

## What happens step by step

```
Step 0   — Orchestrator reads PROJECT-STATE, defines Run Scope Matrix
Step 0a  — MATPROMT produces per-role prompt bundle
Step 0b  — Parallel/Serial decides order and which steps can run in parallel

Step 1   — bmc-sheets-mapping     (Profundo / Ligero / N/A)
Step 2+3 — bmc-calc-specialist    (parallel with bmc-panelin-chat)
           bmc-panelin-chat
Step 4+5 — bmc-api-contract       (parallel with bmc-security)
           bmc-security
Step 6   — bmc-deployment
Step 7   — bmc-fiscal
Step 8   — bmc-docs-sync          (always last before Judge — updates PROJECT-STATE)
Step 9   — bmc-judge              (always last — evaluates the run, ranks agents)
```

### Run Scope Matrix (depth per role)

At step 0, the orchestrator assigns one of three modes to each role:

| Mode | What it means | Cost |
|------|---------------|------|
| **Profundo** | Full work: reads files, makes changes, produces artifacts, handoff | High |
| **Ligero** | Read-only: 1–3 bullets on what was checked and why no delta | Low |
| **N/A** | Not relevant to this run's objective — one sentence why | Minimal |

Every role runs — none are skipped silently. Ligero and N/A produce a brief close, not a fake report.

---

## Handoff format between agents

Every agent ends its work with:

```markdown
## Handoff → [next agent name]
- What I changed: ...
- What you need to know: ...
- Open items for next run: ...
```

This is how context flows through the pipeline without requiring a human to summarize between steps.

---

## How agents communicate in Claude Code

In Claude Code, the `bmc-orchestrator` is the main agent. It spawns the others using the `Agent` tool. Each subagent:

1. Receives the task + handoff from the previous role
2. Reads relevant files (it has access to all tools: Read, Grep, Glob, Bash, Edit, Write)
3. Does its work
4. Returns a result with the handoff section

The orchestrator collects results and passes them to the next agent. You see all of this in the main conversation.

**Parallel execution:** When two agents can run independently (e.g., `bmc-calc-specialist` and `bmc-panelin-chat`), the orchestrator launches both in a single message. This roughly halves the time for those steps.

---

## Definition of Done (DoD)

A full team run is complete when:

1. Every §2 role has a result (Profundo / Ligero / N/A) with explicit close
2. `docs/team/PROJECT-STATE.md` updated with a "Cambios recientes" entry for this run
3. Judge report written to `docs/team/judge/JUDGE-REPORT-RUN-YYYY-MM-DD.md`
4. `npm run gate:local:full` still passes (no regressions)
5. "Pendientes" in PROJECT-STATE reflect the actual next steps
6. No open propagation items (§4 table fully honored)

If DoD is not met, the orchestrator iterates — not closes.

---

## After the run

The Judge's "Top 3 improvements" feed the next run's scope. The cycle is:

```
Run N finishes → Judge produces Top 3 → stored in IMPROVEMENT-BACKLOG-BY-AGENT.md
Run N+1 starts → Orchestrator reads backlog → sets objective → scopes accordingly
```

---

## Quick reference — agent invocation phrases

| To invoke | Say |
|-----------|-----|
| Full team run | "full team run — objective: ..." |
| Just orchestrate planning | "run scope gate for [objective]" |
| Close a session | "docs sync and judge for today's work" |
| Single domain | "use bmc-[agent] to [task]" |
| Security check | "security review before deploy" |
| Deploy | "deploy to vercel production" |

---

## Files to know

| File | Purpose |
|------|---------|
| `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` | Canonical §2 team table, §4 propagation rules |
| `docs/team/PROJECT-STATE.md` | Single source of truth — all agents read this |
| `docs/team/FULL-TEAM-RUN-DEFINITION.md` | Canonical cycle definition (Cursor-centric) |
| `docs/team/RUN-SCOPE-GATE.md` | Depth matrix templates and rules |
| `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` | Per-agent evaluation criteria |
| `docs/team/judge/JUDGE-REPORT-HISTORICO.md` | Historical rankings |
| `.claude/agents/` | All Claude Code agent definitions |
| `.cursor/agents/` | All Cursor agent definitions |
| `.cursor/skills/` | Skill files (deep domain knowledge, 49 skills) |
