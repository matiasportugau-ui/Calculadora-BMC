# Goal 01 — Fix Phase 1 Master Prompt Inline + Merge PR #247

## Objective
Eliminate the doc drift so all downstream goals read correct canon. Two tasks:
1. Apply 4 corrections from `docs/hub-tasks-module/PHASE-1-DRIFT-NOTE.md` directly into `docs/hub-tasks-module/PHASE-1-MASTER-PROMPT.md`.
2. Mark drift note as `[RESOLVED]`.

## Corrections to apply

| Line/section in PHASE-1-MASTER-PROMPT.md | Current (wrong) | Correct |
|---|---|---|
| Constraints §Security | `AES-256-GCM`, key `GOOGLE_TASKS_TOKEN_KEY` | `pgp_sym_encrypt` (pgcrypto), key `ENCRYPTION_KEY` |
| Constraints §Security | `identity.tasks_oauth_tokens` | `tasks.oauth_tokens` |
| Deliverables §1 tasksOAuth.js | `identity.tasks_oauth_state` | `tasks.oauth_state` |
| Deliverables §3 tasksSync.js | `identity.sync_conflicts` | `tasks.sync_conflicts` |

Also replace every occurrence of `GOOGLE_TASKS_TOKEN_KEY` with `ENCRYPTION_KEY` in the file.

## Files to edit
- `docs/hub-tasks-module/PHASE-1-MASTER-PROMPT.md` — apply 4 corrections above
- `docs/hub-tasks-module/PHASE-1-DRIFT-NOTE.md` — prepend `**Status: RESOLVED** — corrections applied inline to PHASE-1-MASTER-PROMPT.md on YYYY-MM-DD.` at top of file

## Verification
- `grep -c "GOOGLE_TASKS_TOKEN_KEY" docs/hub-tasks-module/PHASE-1-MASTER-PROMPT.md` → 0
- `grep -c "identity.tasks_" docs/hub-tasks-module/PHASE-1-MASTER-PROMPT.md` → 0
- `grep -c "AES-256-GCM" docs/hub-tasks-module/PHASE-1-MASTER-PROMPT.md` → 0 (in security constraints context)
- `grep "RESOLVED" docs/hub-tasks-module/PHASE-1-DRIFT-NOTE.md` → match

## Exit
```bash
npm run gate:local
git add docs/hub-tasks-module/PHASE-1-MASTER-PROMPT.md docs/hub-tasks-module/PHASE-1-DRIFT-NOTE.md
git commit -m "docs(tasks-module): fix master prompt inline — drift resolved"
git push -u origin HEAD
```
