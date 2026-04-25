# Reference — runbooks, expert prompts, cross-ingest

## Shared invariants block (paste at top of every expert prompt)

```markdown
## Shared invariants (do not contradict)
- Goal: [one sentence]
- API: http://127.0.0.1:3001  Vite: http://127.0.0.1:5173
- Repo: [absolute path]
- Global DoD: [e.g. npm run gate:local green + …]
- Branch: [name]  (or: worktree OK on …)
```

## Expert instruction prompt — per terminal (template)

Give each worker terminal (or separate AI session) **one** of these, filled in:

```markdown
# Track: [id, e.g. e2e]

## Your role
You are the **worker** for this track only. Another session is the **orchestrator**.

## Invariants
[paste Shared invariants block]

## Your task
[Specific objective for this track]

## Commands / CWD
```bash
cd "/abs/path/Calculadora-BMC"
mkdir -p .runtime/orch
[command] 2>&1 | tee .runtime/orch/[id].log
```

## You are DONE when (stop condition)
- [e.g. log contains `368 passed` OR health returns 200 — be exact]

## When you hit a milestone (optional)
Append one line to `.runtime/orch/events.ndjson`:
`{"track":"[id]","event":"milestone","detail":"..."}`

## If you discover something that changes the plan
Write it at the **top** of your next message to the orchestrator in one line: `DISCOVERY: ...`
```

## Runbook template (orchestrator-facing)

```markdown
# Orchestration: [goal]
Log dir: .runtime/orch/

## Tracks
| ID | Worker type | Log | Gate | Depends on |
|----|---------------|-----|------|------------|
| api | shell / Claude | api.log | G_http /health | — |
| vite | shell | vite.log | G_http :5173 | — |
| e2e | shell | e2e.log | G_log regex | api+vite |

## Cross-ingest rule
After each track completes a milestone, orchestrator reads **all active log tails** and reconciles before next assignments.
```

## Cross-ingest checklist (orchestrator)

| Step | Action |
|------|--------|
| 1 | Read tail of track A log; extract facts (URLs, errors, paths) |
| 2 | Read tail of track B; same |
| 3 | Compare: same ports, same branch, compatible assumptions? |
| 4 | If conflict: pause; update **invariants**; send **delta expert prompt** to A and/or B |
| 5 | If one track found a **blocking** error: rebalance — shorten or repoint other tracks |

## HIL (human) checklist

- [ ] One clear success signal per HIL step
- [ ] No tokens in orchestrator chat
- [ ] Optional: `touch .runtime/orch/ready.user` as signal

## Tee + health (copy-paste)

```bash
mkdir -p .runtime/orch
npm run start:api 2>&1 | tee .runtime/orch/api.log
```

```bash
curl -sf http://127.0.0.1:3001/health | head -c 200
```

```bash
touch .runtime/orch/ready.user
```
