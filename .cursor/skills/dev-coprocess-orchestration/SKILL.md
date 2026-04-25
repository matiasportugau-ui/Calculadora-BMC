---
name: dev-coprocess-orchestration
description: Positions the prompt-receiving agent as the orchestrator for a task: designs per-terminal work, issues expert instruction prompts per track, polls log files until gates match, cross-ingests findings across tracks, and live-rebalances instructions so all tracks stay aligned. Uses coprocesses, .runtime/orch logs, gates, and HIL. Use when the user wants a central orchestrator, multi-terminal coordination, expert prompts per pane, cross-track discovery merge, or equitable shared objective across parallel work.
---

# Dev coprocess orchestration

## The prompt receiver as orchestrator

The **session that holds this skill** (the agent reading the user prompt) acts as the **single orchestrator**. Other “terminals” are **workers**: shell processes, tmux panes, or **separate assistant sessions** that run what the orchestrator assigns.

**Orchestrator responsibilities**

1. **Decompose** the user goal into a **DAG of tracks** (what can run in parallel vs serial).
2. **Design each track’s task** in one paragraph: objective, constraints, success signal, log file.
3. **Emit an expert instruction prompt per track** — copy-paste ready for that terminal (or for a second Claude/Code session). Each prompt must state: CWD, commands, log path (`tee`), **stop condition** (“you are done when…”), and **what to append to `events.ndjson`** when a milestone hits (optional).
4. **Observe**: read **tail of that track’s log** (or health check) until the **expected signal** appears (regex, HTTP, exit, file). Load that text into reasoning context; do not assume success without evidence.
5. **Cross-ingest**: compare the new finding with **other tracks’ logs and `git diff` facts**. If discoveries conflict (e.g. API says port A, E2E expects B), **resolve or flag** before ordering more work.
6. **Live rebalance**: update **other tracks’ expert prompts** when one track discovers something that changes the plan (new env var, route rename, feature flag). Push **delta instructions** (“ignore step 2; use URL X”) so all tracks stay aimed at one **shared definition of done**.
7. **Equilibrium**: maintain **shared invariants** (see below) so no track optimizes locally and breaks the global goal.

**Reality constraints**

- The orchestrator **does not** click other IDE tabs. It **reads** `.runtime/orch/*.log`, `events.ndjson`, terminal transcript files if the user `@` them, and the repo.
- **Other terminals** only follow instructions if a **human** pastes the expert prompt there, or a **script** the orchestrator wrote runs there. Multiple **LLM** sessions are **not** one shared brain unless each gets the posted prompt.
- **Cross-ingest** is **the orchestrator comparing** logs and diffs — not automatic IPC between processes.

## Shared invariants (keep all tracks aligned)

Define at orchestration start (one short list, copy into every expert prompt):

- **Product goal** (one sentence).
- **Ports / URLs** (e.g. API `:3001`, Vite `:5173`) — single source of truth.
- **Branch / commit** or “dirty OK” rule.
- **Definition of done** for the whole task (e.g. “green `gate:local` + screenshot of X”).

When a track diverges, **update invariants** once and **re-issue deltas** to affected tracks.

## Relationship to other skills

- **Many panes / merge-only**: [multiterminator](../multiterminator/SKILL.md) reconciles chaos; **this** skill adds **continuous orchestration** (assign → observe → merge → rebalance).
- **Stack**: `CLAUDE.md` + workspace **autostart** — check health before duplicate processes.

## Core model

1. **Tracks**: each has **command**, **log sink** under `repo/.runtime/orch/`, **gates**, and an **expert prompt** artifact the orchestrator maintains.
2. **Control plane**: scripts and/or manual `tee`; orchestrator **polls logs** on a loop until gate or timeout.
3. **Communication**: append-only logs, optional `events.ndjson`, HTTP/TCP on localhost.
4. **HIL**: `G_human` when automation must stop for OAuth, approval, or paste.

## Gate types

| Gate | Check | HIL often? |
|------|--------|------------|
| `G_tcp` | port listening | no |
| `G_http` | `curl` status/body | sometimes |
| `G_file` / `G_log` | path or **regex on log tail** | optional |
| `G_exit` | process exit 0 | no |
| `G_human` | user signal | **yes** |

Build a **DAG**; parallelize only independent tracks.

## Log contract

- `repo/.runtime/orch/` (parent `.runtime/` is gitignored).
- Files: `api.log`, `vite.log`, `e2e.log`, optional `events.ndjson`.
- Manual terminals: `cmd 2>&1 | tee .runtime/orch/<track>.log`
- Orchestrator **re-reads tails** after each milestone; for **cross-ingest**, compare **two or more** log tails + `git status` / diff scope.

## Orchestrator observe → rebalance loop (minimal)

```
for each milestone:
  for each active track T:
    read log T (or gate check) until success | timeout | user HIL
    ingest finding into shared context
  merge: detect conflicts between tracks; update invariants if needed
  for any track U affected by another track’s discovery:
    emit **delta expert prompt** for U
until global definition of done or blocked
```

## Human-in-the-loop

- Mark `G_human` with a **single** success signal.
- No secrets in chat; OAuth stays local.

## Agent behavior (when this skill applies)

1. Start with **runbook + invariants + expert prompts** for each track.
2. **Check** ports/health before spawning duplicate stack.
3. **Poll** logs or HTTP; **quote** evidence when reporting status.
4. On cross-track conflict: **stop** linear progress; resolve with user or rebalance prompts.
5. Prefer **absolute paths** if CWD has spaces.

## Optional: events.ndjson

Append one JSON line per event: `{"t":"ISO","track":"api","event":"ready","detail":{}}` for machine-friendly cross-ingest.

## Anti-patterns

- Two processes on the same port; **destroying** git state without approval.
- Issuing expert prompts **without** shared invariants (causes drift).
- Ignoring track B’s log after track A’s success when B’s work **depends** on A’s output.

## See also

- [reference.md](reference.md) — expert prompt template, orchestrator checklist, cross-ingest table, tee snippets.
