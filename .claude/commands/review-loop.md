# /review-loop — Multi-agent review → evaluate → implement loop

Core philosophy: **Many small safe wins > one big unreviewed change.** Each round commits at most one low-risk improvement; everything else is logged for a human to decide on.

Full specification: [`docs/team/REVIEW-LOOP-RUNBOOK.md`](../../docs/team/REVIEW-LOOP-RUNBOOK.md).

## What to do when invoked

1. Parse args. Defaults: `iterations=10`, `scope=branch`, `dry=false`, `resume=false`.
2. Read `docs/team/REVIEW-LOOP-RUNBOOK.md` and follow the round structure verbatim.
3. Read `docs/team/PROJECT-STATE.md` and `git status --short` / `git log --oneline -5` for round-1 context.
4. Create `docs/team/judge/REVIEW-LOOP-LOG-<YYYY-MM-DD>.md` (or open the latest if `resume=true`).
5. For each round 1..iterations:
   - **Scan**: dispatch the 3 specialists for this round number IN PARALLEL (single message, multiple Agent tool calls). Use the rotation table in the runbook.
   - **Evaluate**: dispatch `bmc-judge` with the 3 findings + log so far.
   - **Pick + log**: append a `## Round N` section to the log.
   - **Implement** (skip if `dry=true`): apply diff only if all safety gates pass (risk=low, est_loc≤30, no protected files).
   - **Verify**: `npm run lint` and `npm test`. Revert on failure.
   - **Commit**: `chore(review-loop): <title> [round N/TOTAL]`.
   - **Score**: judge writes 1–10 into the log.
   - Check stop conditions (3 consecutive empty rounds, lint/test fail, push reject).
6. After the loop: write final report into the log + push + open draft PR + append one line to `docs/team/PROJECT-STATE.md`.

## Report format (printed in chat at the end)

```
# /review-loop — Run complete

Branch: <branch> | Rounds: <N/total> | Commits: <N> | Deferred: <N> | Reverted: <N>

## What landed
- Round 1: <title> — <commit-sha>
- Round 2: <title> — <commit-sha>
...

## What we deferred (top 3)
1. <title> — <why-not-now> — <where>
2. ...
3. ...

## Per-area heat map
| Area | Findings | Committed | Deferred |
|------|----------|-----------|----------|

## Next steps
- Review draft PR #<num>
- Triage deferred list
- Consider a focused branch for: <highest-impact-deferred>
```

## Safety rules (non-negotiable)

- Never touch: `.env*`, `server/config.js`, `server/tokenStore.js`, `package.json` deps, `.github/workflows/**`, `**/migrations/**`.
- Never use `--no-verify`, `--force`, or `--amend`.
- Push once at the end. Open the PR as **draft**.
- On any unrecoverable error, stop and `AskUserQuestion` — don't paper over with hacks.

## Args

| Arg | Default | Meaning |
|-----|---------|---------|
| `iterations` | `10` | Max rounds. Stops early on 3 consecutive empty rounds. |
| `scope` | `branch` | `branch` (whole branch) \| `server` \| `src` \| `docs`. Narrows the safety gate. |
| `dry` | `false` | If `true`, no commits; report only. |
| `resume` | `false` | If `true`, continue the most recent `REVIEW-LOOP-LOG-*.md`. |

## Examples

```
/review-loop
/review-loop iterations=5
/review-loop iterations=10 scope=server
/review-loop dry=true
/review-loop resume
```
