---
name: multiterminator
description: Orchestrates multi-terminal and multi-session work: assigns roles, env, and run order; waits on logs, ports, and exit codes; reconciles live terminal output. Also synthesizes chaos from several Cursor terminals or agent sessions. Use when the user wants parallel panes, process orchestration, live logs, or to merge many terminal attachments into one runbook.
---

# MULTITERMINATOR

## Two modes

1. **Reconcile (read-only)**: N terminals / transcripts → one picture, one backlog, risks. Use the synthesis template in "Synthesis" below.
2. **Orchestrate (action)**: Decompose a goal into **parallel tracks** with **contracts** (who runs what, which log, which gate unblocks the next step). The agent does not magically click other IDE panes: it **issues commands, writes the plan, and polls** (shell output, log files, HTTP health) per track.

## How to orchestrate (model)

### Roles (virtual, not OS-assigned)

Assign each **track** a stable id and purpose. Example:

| Track | Job | Default log (suggested) | Unblocks when |
|-------|-----|-------------------------|---------------|
| T-api | `npm run start:api` | `.runtime/orch-api.log` or shell file | `GET localhost:3001/health` → 200 |
| T-web | `npm run dev` | `.runtime/orch-vite.log` | `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173` → 200 |
| T-test | `npm test` / Playwright | stdout + exit code | exit 0 and optional regex in output |
| T-user | human-only (OAuth, browser, 2FA) | user pastes output | user says "listo" or log line seen |

**Rule:** One **writer** per port and per repo root (avoid two APIs on 3001). Check before start (`lsof`, `curl` health) per `CLAUDE.md` / workspace autostart.

### Configuration per track

- **Env**: document inline in the runbook (`export FOO=bar` in that track only) or a **named env snippet** the user pastes in the right terminal.
- **CWD**: always absolute path to the repo; paths with **spaces** must be quoted; prefer `node /abs/path/scripts/foo.mjs` over fragile `cd` when spawning from automation.

### Wait / proceed (gates)

Use explicit **gates** so "wait for output" is not ambiguous.

- **G_port**: TCP port listening (e.g. 3001, 5173).
- **G_http**: HTTP status and optional body substring.
- **G_file**: path exists and optionally `grep` pattern in last N lines.
- **G_process**: process exit code 0, or background job completed (read terminal output file tail).
- **G_human**: user confirmation (MFA, deploy approval).

**Order matters:** define a small **DAG** (T-api → T-web → T-e2e). Parallel only what is independent; never start E2E before `G_api`+`G_web` if tests hit localhost.

### Live terminals the user is watching

When the user keeps **separate** Cursor/tmux panes for visibility:

1. The agent **does not** control those panes; it **delivers a one-screen runbook**: command per pane, expected first log line, and the **line that means "ready"**.
2. User runs or confirms; the agent **polls** by asking for paste, or by reading a **shared log file** both agree on: e.g. `>> .runtime/orch-T-api.log 2>&1` so the agent can `read` that file.
3. Prefer **file logging** over "scrollback in my head" for automation friendliness.

### What the agent runs itself

- One shell in this environment: can run **background** long processes and **read their output file**; can **await** with bounded polling (regex / exit) per tool rules.
- Avoid duplicate long-running servers: **check** health first; if already up, **attach** to the story (use existing) instead of spawning again.

## Orchestration runbook (template for the user + agent)

Copy and fill; keep paths absolute if spaces.

```markdown
# Run: [name]
CWD: /abs/path/Calculadora-BMC

## Tracks
- **T1 — [id]**: [command] → log: [path] → Gate: [G_*]
- **T2 — …**

## Graph
T1 → T2; T1 + T2 → T3 (parallel: …)

## Abort / rollback
- Stop: [pkill pattern / tmux send-keys] (only with user ok for mass kill)
- Disk / secrets: [note]
```

## Synthesis (reconcile many terminals)

```markdown
## Threads (N)
- **T1 — [name]**: [state]. Blocker: […]

## Conflicts / risks
- […]

## Single next step
1. […]
```

## Rules

- **Filesystem over narrative**: `git status`, `curl /health`, log tail beat "it worked" in chat.
- **App API vs IDE**: `localhost:3001` (Calculadora) ≠ MCP/Claude socket errors.
- **Uncertainty**: if transcripts disagree, say so and name the verification.

## Common footguns

| Signal | Typical cause |
|--------|-----------------|
| `EJSONPARSE` | JSON file invalid (often `package.json`) mid parallel edit |
| `FailedToOpenSocket` (MCP) | IDE/bridge, not Express |
| `git checkout --force` | Lost **untracked** files |
| Duplicate `:3001` / `:5173` | Autostart + manual `dev:full` |
| `MODULE_NOT_FOUND` + spaces in path | Use absolute paths; quote paths |

## Calculadora-BMC

- Vite **:5173**, API **:3001**; check before second stack; see **workspace autostart** rule.
- `npm run gate:local` after touch `src/` or `server/`.
- Optional 4-pane layout: repo scripts `scripts/bmc-dev-session.sh`, `scripts/bmc-watch.sh`, `scripts/bmc-gate-chain.sh` (if present) — **assign panes** to T-api / T-logs / T-gate per script comments.

## Anti-patterns

- Spawning a second `dev:full` without a port/health check.
- Treating "linter reverted" as fact without `git diff` / `npm run lint`.
- Destructive git or mass **kill** without user approval.
- `docs/team/PROJECT-STATE.md` updates unless the user asked for that deliverable.

## See also

- **[dev-coprocess-orchestration](../dev-coprocess-orchestration/SKILL.md)** — prompt-holder as **orchestrator**: expert prompts per track, log-until-gate, **cross-ingest** across tracks, live **rebalance** of worker instructions, shared invariants.

## Progressive reading

On huge logs: read **last 40–80 lines** first (error + exit), then the **start** (intent).
