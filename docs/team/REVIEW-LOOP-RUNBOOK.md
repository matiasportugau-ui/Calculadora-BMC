# REVIEW-LOOP-RUNBOOK

A repeatable loop that **reviews → evaluates → picks → implements** small safe improvements over multiple rounds. Designed to plug into the existing BMC agent ecosystem (`bmc-orchestrator`, `bmc-judge`, the 11 specialists).

Use it when:
- A branch is "done" and you want a final polish pass before merge.
- You want to surface deferred technical debt **without** committing risky changes.
- You want a dated, signed audit trail of what was considered and what was acted on.

Do **not** use it for:
- Feature work (the loop only commits ≤30 LOC, risk-low items).
- Deploys, dep upgrades, CI changes, secret edits.
- Anything that requires human business judgement.

---

## Round structure (repeated up to N times)

Each round is one cycle: **scan → evaluate → pick → fix → verify → commit → score.**

### 1. Scan (parallel, ~3 agents)

Dispatch a rotating subset of specialists in a single message so they run in parallel:

| Round | Agents |
|-------|--------|
| 1, 4, 7, 10 | `bmc-calc-specialist` + `bmc-api-contract` + `bmc-security` |
| 2, 5, 8     | `bmc-panelin-chat` + `bmc-sheets-mapping` + `bmc-docs-sync` |
| 3, 6, 9     | `calculo-especialist` + `bmc-fiscal` + `bmc-deployment` |

Each agent is asked the same question:

> Find the single highest-leverage **safe-to-commit** improvement in your area on the current branch. Report it as:
> `{ title, file:line, diff_sketch, risk: low|med|high, est_loc, why_it_matters }`.
> Risk rubric: **low** = pure local edit (typo, dead code removal, comment fix, lint nit, doc sync, missing await on a logger). **med** = touches control flow or shared util. **high** = touches config, deps, auth, money, or migrations.

### 2. Evaluate

`bmc-judge` receives all 3 findings + the running log of previous rounds. It:

- Scores each finding on `score = (impact × safety) / max(est_loc, 1)`.
- Picks the winner.
- Writes a 5-line justification (why this, why not the others, what risk remains).

### 3. Feedback (append to log)

Append to `docs/team/judge/REVIEW-LOOP-LOG-<YYYY-MM-DD>.md`:

```
## Round N / TOTAL — <area>
- **Chosen:** <title> (<file:line>)
- **Deferred:** <other titles, one per line, with reason>
- **Judge score:** N.N/10
```

### 4. Implement (safe fixes only)

Apply the diff **iff all** of these hold:

- `risk == low`
- `est_loc ≤ 30`
- Touched files do **not** match any of:
  - `server/config.js`
  - `server/tokenStore.js`
  - `.env*`
  - `package.json`, `package-lock.json` (dep changes)
  - `.github/workflows/**`
  - `**/migrations/**`
  - Anything under `wa-package/` or `transportista-cursor-package/` migrations

If a gate fails → mark **DEFERRED** in the log (no commit). The round still counts.

### 5. Verify

Run:

```bash
npm run lint
npm test
```

If either fails → revert **only the files the round touched** with `git checkout -- <file1> <file2> ...` (or `git revert <sha>` if already committed). **Never** use `git checkout -- .` (wipes unrelated work-in-progress), `--no-verify`, `--force`, or `--amend` to push past a failure. Mark **REVERTED** in the log.

### 6. Commit

Atomic commit, one per round, message format:

```
chore(review-loop): <title> [round N/TOTAL]
```

Push **once at the end of the run**, not per round.

### 7. Score

Judge writes the final 1–10 round score into the log.

---

## Stop conditions (before reaching N)

The loop stops early if:

- **Three consecutive rounds** with no safe fix found → report "converged."
- A test/lint failure that cannot be reverted cleanly → stop, ask the user.
- A `git push` rejection (branch protection, conflict) → stop, ask the user.
- The user presses Esc → partial log is preserved; resume with `/review-loop resume`.

---

## Final report (after the loop ends)

Append to the log and post as the draft-PR description:

```
# Review-loop run — <date>

| Metric | Value |
|--------|-------|
| Rounds attempted | N |
| Commits made     | N |
| Deferred items   | N |
| Reverted items   | N |
| LOC changed      | +N / -N |
| Files touched    | N |

## Top 3 deferred (future work)
1. ...
2. ...
3. ...

## Per-area heat map
| Area | Findings | Fixes committed |
|------|----------|-----------------|
| ...  | ...      | ...             |

## Recommendation
ready-for-review | needs-human-call | converged-no-action
```

Also append one line to `docs/team/PROJECT-STATE.md` → "Cambios recientes":

```
YYYY-MM-DD (Review-loop): <N> commits, <N> deferred. Branch: <branch>. PR: #<num>.
```

---

## How to run it

Three modes, in order of effort:

### 1. One-shot, default 10 rounds

In a Claude Code session on the target branch:

```
/review-loop
```

Walk away; come back to a draft PR + log file.

### 2. Custom scope or count

```
/review-loop iterations=5
/review-loop iterations=5 scope=server
/review-loop iterations=10 scope=docs
```

`scope` narrows the safety gate so only files matching the pattern are eligible for editing.

### 3. Dry-run / report-only

```
/review-loop dry=true
```

Skips step 4 (Implement). Produces only the log + final report. Useful first-time pass on a new branch.

### Resume a partial run

```
/review-loop resume
```

Picks up at the next round number found in the most recent `REVIEW-LOOP-LOG-*.md`.

---

## Critical files referenced by the workflow

Read-only during execution unless explicitly listed as a target:

- `.claude/agents/bmc-orchestrator.md` — dispatch pattern.
- `.claude/agents/bmc-judge.md` — judge criteria.
- `docs/team/PROJECT-STATE.md` — read at round 1; one line appended at end.
- `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` — scoring rubric.
- `docs/team/FULL-TEAM-RUN-DEFINITION.md` — DoD rules.

---

## Safety summary (the short version)

| Will do | Won't do |
|---------|----------|
| Commit ≤30 LOC, risk-low fixes | Edit `.env*`, `config.js`, `tokenStore.js`, deps, CI, migrations |
| Run lint + test before committing | Use `--no-verify`, `--force`, `--amend` |
| Push only at end of run | Deploy (Vercel / Cloud Run) |
| Open a draft PR | Mark PR ready-for-review |
| Defer risky items to a list | Touch business logic without human sign-off |
