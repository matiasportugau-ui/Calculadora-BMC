# Goal 06 — Integration Tests + Phase 1 Completion Docs

## Objective
Add contract tests for OAuth and sync, run full gate, write PHASE-1-COMPLETE.md, update PROJECT-STATE.md.

## Prerequisites
- Goals 01-05 complete.

## Files to create
- `tests/tasksOAuth.test.js` — contract tests:
  - PKCE state generation produces valid challenge
  - Callback with invalid state returns 400
  - Callback with expired state returns 400
  - Revoke on non-existent token returns 404
  - No credentials leaked in error responses

- `tests/tasksSync.test.js` — contract tests:
  - POST /sync/google-tasks/pull without HMAC signature returns 403
  - POST with valid HMAC but no users returns `{ ok: true, itemsSynced: 0 }`
  - Conflict detection logic (unit test `mapGoogleTaskToDb` + conflict check)

- `docs/hub-tasks-module/PHASE-1-COMPLETE.md` — completion summary:
  - Deliverables list with file paths
  - Test results (paste `npm run gate:local` output)
  - Blockers resolved vs still open
  - Phase 2 entry criteria

## Files to modify
- `docs/team/PROJECT-STATE.md` — append under "Cambios recientes":
  ```
  - 2026-05-XX: Tareas module Phase 1 complete — OAuth PKCE, CRUD, sync polling, frontend wiring. PR #NNN.
  ```

## Test patterns
Follow existing test conventions in `tests/`:
- Each file is a standalone Node script (`node tests/tasksOAuth.test.js`)
- Use `assert` module (no jest needed for offline tests)
- Mock HTTP calls where Google API is needed (no live API in CI)
- Test the route handler logic, not the Google API itself

## Verification
```bash
node tests/tasksOAuth.test.js
node tests/tasksSync.test.js
npm run gate:local
npm run gate:local:full  # includes build
```

## Exit
```bash
git add tests/tasksOAuth.test.js tests/tasksSync.test.js docs/hub-tasks-module/PHASE-1-COMPLETE.md docs/team/PROJECT-STATE.md
git commit -m "test(tasks): add contract tests for OAuth and sync
docs(tasks-phase-1): document Phase 1 completion and Phase 2 entry criteria"
git push -u origin HEAD
```

## Final checklist
After this goal, ALL 28 checklist items should be done:
- [ ] `npm run gate:local` exit 0
- [ ] `npm run gate:local:full` exit 0 (build succeeds)
- [ ] No `console.log` in production paths (grep verify)
- [ ] No secrets in git (`git grep -l "ENCRYPTION_KEY=" -- ':!.env.example' ':!*.md'` → empty)
- [ ] PR created, Vercel preview green
- [ ] PHASE-1-COMPLETE.md filled
- [ ] PROJECT-STATE.md updated
