# Role
Backend + infra engineer stabilizing the Tareas module and broader BMC platform shipped on
2026-05-20 → 2026-05-21. Specifically: harden the 4 workstreams (open Google registration,
user platform, activity log, Tareas BMC-as-source-of-truth) by fixing 5 known issues before
any new feature work touches the code.

---

# Context

Repo: `/Users/matias/calculadora-bmc` [CONFIRMED]
Frontend: `https://calculadora-bmc.vercel.app` [CONFIRMED]
Backend: Cloud Run `panelin-calc-00406-8wb` [CONFIRMED — as of session start]
Supabase: project `htnwozvopveibwppyjhg` [CONFIRMED]

Recent ship cycles (read these first; do NOT rebuild):
- 4-track user platform: commits `0ab15fc → cd19601` (2026-05-20)
- 5-phase activity log: commits `d440ed8 → 80fdf7a` (2026-05-21 AM)
- Tareas BMC source-of-truth: commit `ea5b8c7` (2026-05-21 AM) — outbound writes via
  `server/lib/googleTasksClient.js` + `server/routes/tasks.js` write handlers
- SW navigateFallback fix: commit `3d9b328` (2026-05-21) — denylist for /api, /auth, /sync,
  /calc, /webhooks
- vercel.json /auth/* rewrite: commit `87ce2d1` (2026-05-21)
- Workflow yaml Tareas secret mounting: commit `1558839` (2026-05-21)

All of the above are live. None of this session may regress them.

The 5 known issues this session is closing:
1. **Token refresh missing** [CONFIRMED] — `server/routes/tasksSync.js` decrypts the
   access_token via SQL and uses it directly. The refresh_token IS stored in
   `tasks.oauth_tokens.refresh_token_encrypted` but never used. Google's access_token has a
   ~1h TTL. Cloud Scheduler will return 401 + mark `revoked_at` for every user ~1h after
   their last OAuth connect, breaking sync until they manually reconnect.
2. **Initial-sync backfill missing** [CONFIRMED] — `tasksSync.js` uses
   `updatedMin=lastSyncedAt`. On first cycle after OAuth, lastSyncedAt is the cycle start
   time, so tasks older than the connect moment are filtered out. matias's account has 3
   tasks from 2019 that never landed in `tasks.tasks` despite the sync running successfully.
3. **ErrorBoundary mis-labels every error as calc** [CONFIRMED] — `src/main.jsx` lines
   13-31 hardcode "Error en la Calculadora" for any uncaught React error. Misleads users.
4. **Anthropic API key invalid in Cloud Run** [CONFIRMED] — `POST /api/crm/suggest-response`
   returns 503 with `claude: invalid_request_error / Your cred...`. This causes the CI smoke
   gate to fail, forcing manual `gh workflow run deploy-calc-api.yml --ref main` on every
   push to main since 2026-05-20.
5. **RLS disabled on `tasks.*` 6 tables** [CONFIRMED — Supabase advisor flagged] — task_lists,
   tasks, oauth_tokens, oauth_state, sync_log, sync_conflicts all have RLS=false. The BMC
   backend uses service_role and bypasses RLS by design, so this is defense-in-depth for
   any future PostgREST consumer that uses the anon key.

---

# Goal

Stabilize the 4 workstreams shipped 2026-05-20→21 by closing 5 specific known issues — token
refresh, initial-sync backfill, ErrorBoundary copy, CI smoke gate, RLS — before any new
feature work resumes.

- Implement transparent OAuth token-refresh in the sync handler; retry on 401.
- Detect "first sync" (lastSyncedAt is null) and pull the full task history from Google.
- Rewrite ErrorBoundary copy to be route-aware (or at minimum generic "Error en la aplicación").
- Rotate the Anthropic API key in GCP Secret Manager so the CI smoke gate passes again.
- Apply Supabase migration that ENABLEs RLS on the 6 `tasks.*` tables with a service_role
  bypass policy.
- Verify each subtask end-to-end before committing.

---

# Scope

IN:
- The 5 subtasks listed above, each with its own commit + success criterion.
- Each commit updates `docs/team/PROJECT-STATE.md` "Cambios recientes" — at commit time, not
  session close.
- A closing handoff doc `docs/team/HANDOFF-2026-05-22.md` (or current date) when done.

OUT:
- Any new user-facing feature. No new UI, no new endpoints beyond the refresh/backfill helpers.
- Tailwind / shadcn / any new CSS framework.
- Schema redesigns (e.g., decoupling `google_id NOT NULL`). Document as Mode B follow-up only.
- BMC-specific task extensions (quote linking, tagging, priorities). Future feature sprint.
- Refactor of unrelated code touched in adjacent files. Surgical edits only.
- Touching identity.* tables, identity.audit_log, or the auth flow.
- Touching the `/hub/admin/users` or `/hub/admin/analytics` surfaces (they're solid).

---

# Inputs

**Files involved in each subtask:**

| # | Subtask | Primary files |
|---|---------|---------------|
| 1 | Token refresh | `server/routes/tasksSync.js` (consumer), `server/lib/googleTasksClient.js` (also consumes; reuse the helper), `tasks.oauth_tokens` schema (refresh_token_encrypted column) |
| 2 | Initial-sync backfill | `server/routes/tasksSync.js` (line that constructs `updatedMin` query param) |
| 3 | ErrorBoundary copy | `src/main.jsx` lines 13-31 |
| 4 | Anthropic key rotation | GCP project `chatbot-bmc-live`, secret `ANTHROPIC_API_KEY`. Verify endpoint: `POST /api/crm/suggest-response` |
| 5 | RLS on tasks.* | NEW: `supabase/migrations/20260522000002_tasks_rls.sql`; apply via Supabase MCP `apply_migration` |

**Google OAuth refresh endpoint** (for subtask 1):
- URL: `https://oauth2.googleapis.com/token`
- POST body: `grant_type=refresh_token&client_id=...&client_secret=...&refresh_token=...`
- Returns: `{ access_token, expires_in, scope, token_type }`. Refresh_token usually NOT
  rotated, but if response contains one, store it.
- Reference: `server/routes/tasksOAuth.js` already calls this URL for the initial code
  exchange — copy the pattern.

**Test user**: matias's user_id is `c66f0acc-1a97-4e05-9c08-525997b4b248` [CONFIRMED]. Tokens
encrypted in `tasks.oauth_tokens` for this user. Google list "Lista de Matías" has google_id
`MTAyNjA2ODAzNDI2MjI5NjcxNjU6MDow` and 3 pre-2019 tasks visible via direct Google API call.

---

# Tools & MCPs

- **Bash**: `gcloud secrets versions add` for the Anthropic key rotation; `gh workflow run`
  to trigger Cloud Run deploys; `git` operations; `psql` (with DATABASE_URL from gcloud
  secrets) for ad-hoc token-state inspection.
- **Supabase MCP** (`mcp__claude_ai_Supabase__apply_migration`, `execute_sql`): apply RLS
  migration; verify policies via `pg_policies` query.
- **Edit / Read / Write**: surgical changes to tasksSync.js, googleTasksClient.js, main.jsx.
- **Playwright MCP**: verify subtask 1 (force token refresh by waiting / invalidating) +
  subtask 2 (open /hub/tareas after running first sync → confirm 3 pre-2019 tasks visible) +
  subtask 3 (navigate to /hub/tareas, trigger an error, confirm new copy).
- **advisor()**: call BEFORE subtask 5's migration (one-way door); call BEFORE pushing the
  final batch of commits to main.
- **TaskCreate/TaskUpdate**: track the 5 subtasks.
- Tools NOT needed: WebSearch, Vercel MCP (no Vercel-side changes), Shopify, BigQuery,
  Notion, Gmail.

---

# Constraints & Guardrails

- **DO** wrap token refresh in a try/catch that distinguishes "refresh succeeded → retry
  original call" vs "refresh failed → fall through to existing 401-marks-revoked path".
- **DO** ALSO update `tasksOAuth.js`'s code-exchange to consume the same refresh helper if it
  cleanly factors out. Don't force it.
- **DO** test the refresh by manually invalidating matias's access_token (UPDATE
  `tasks.oauth_tokens SET access_token_encrypted = pgp_sym_encrypt('invalid', $key)` or
  similar) and triggering a sync → verify it refreshes + succeeds.
- **DO** make the initial-sync backfill conditional on `task_lists.synced_at IS NULL` for
  that list (not a global flag); per-list cleanup so adding a new Google list later also
  backfills properly.
- **DO** call `advisor()` before applying the RLS migration. The risk: a malformed policy
  could block the BMC backend's service_role queries and take Tareas offline. Verify with
  a `SELECT count(*)` from each table immediately after applying.
- **DO** use `printf '%s'` not `echo -n` for the new Anthropic key value piped to gcloud.
- **DO** run `npm run gate:local` before each commit. Accept the pre-existing
  sheetsCsvGuard.test.js failures (tab/CR prefix) as baseline; confirm via `git stash` + re-run.
- **DO NOT** push to main without explicit user approval (CLAUDE.md rule).
- **DO NOT** delete the refresh_token after successful refresh; it stays valid for re-use
  on the next expiry cycle.
- **DO NOT** introduce circular re-tries on 401 — refresh once; if it fails, mark revoked.
- **DO NOT** add RLS policies that depend on `current_setting('request.jwt.claims')` — that
  path returns NULL in this architecture (BMC backend uses pg pool directly, not PostgREST).
  Policies should be `USING (true)` for service_role and EXPLICITLY block other roles.
- **DO NOT** rotate the Anthropic key without the user providing the new value. Pause and
  ask in `AskUserQuestion`.
- **DO NOT** modify or delete the existing 4-track or 5-phase code from prior commits.

---

# Anti-patterns

- DO NOT log the decrypted access_token or refresh_token to Cloud Logging. Mask to last 4.
- DO NOT use `gcloud secrets create` if the secret exists — use `gcloud secrets versions add`.
- DO NOT confuse the 3 OAuth client IDs in this project: web-app login
  (`642127786762-hbkkonaqp9vvfk2qa9sv5go4bd8u4sj3`), Google Tasks sync
  (`642127786762-p7siclqkr1c7spm24423t4313tqvv8ul`), and the older test client.
- DO NOT push without `npm run gate:local` exit 0 (modulo pre-existing CSV-guard failures).
- DO NOT touch the SW config in vite.config.js — the navigateFallbackDenylist is correct.
- DO NOT change the schema of `tasks.oauth_tokens` — refresh_token is already stored.
- DO NOT mass-touch the existing route handlers in other domains (wa, ml, traktime,
  identityAdmin, identityAnalytics). They are out of scope.

---

# Deliverables

### Subtask 1 — Token refresh
- Modify `server/lib/googleTasksClient.js`: add internal `refreshIfNeeded(pool, userId)`
  helper that on 401 from the original Google API call, decrypts the refresh_token, POSTs
  to `https://oauth2.googleapis.com/token`, encrypts the new access_token via SQL, updates
  `tasks.oauth_tokens`, and returns the new token for retry.
- Modify `server/routes/tasksSync.js`'s `syncUser()`: same retry logic for the lists +
  tasks fetches. Specifically: when `listsRes.status === 401`, attempt refresh; if refresh
  succeeds, retry the lists fetch ONCE; if refresh fails, fall through to the existing
  "mark revoked + log token_revoked" path.
- Atomic commit: `fix(tasks): transparent OAuth token refresh on 401`

### Subtask 2 — Initial-sync backfill
- Modify `tasksSync.js`: when fetching tasks for a list whose `task_lists.synced_at IS NULL`
  (or list doesn't exist locally yet), omit the `updatedMin` query parameter entirely so
  Google returns the full list history. After that first sync, the normal incremental
  behavior takes over.
- Atomic commit: `fix(tasks): backfill historical Google tasks on first sync per list`

### Subtask 3 — ErrorBoundary copy
- Modify `src/main.jsx`: import `useLocation` from `react-router-dom`, OR fall back to
  reading `window.location.pathname` if the BrowserRouter context isn't available at
  ErrorBoundary level (it isn't, since ErrorBoundary wraps `<App />`). Show
  "Error en la aplicación" as the headline, with the current pathname rendered below it.
  Update the `showError` fallback similarly.
- Atomic commit: `fix(error-boundary): generic copy + pathname context`

### Subtask 4 — Anthropic API key rotation
- Use `gcloud secrets versions add ANTHROPIC_API_KEY --project chatbot-bmc-live --data-file -`
  with the new value piped via `printf '%s'`.
- Trigger Cloud Run redeploy via `gh workflow run deploy-calc-api.yml --ref main`.
- Verify with curl after deploy: `POST /api/crm/suggest-response` returns 200.
- Atomic commit: `chore(secrets): rotate ANTHROPIC_API_KEY in Cloud Run` (commit body
  describes the rotation; no code change in repo).

### Subtask 5 — RLS on tasks.* tables
- NEW migration `supabase/migrations/20260522000002_tasks_rls.sql`:
  ```sql
  ALTER TABLE tasks.task_lists      ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tasks.tasks           ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tasks.oauth_tokens    ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tasks.oauth_state     ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tasks.sync_log        ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tasks.sync_conflicts  ENABLE ROW LEVEL SECURITY;
  -- service_role policies (allow all; backend uses pg pool with service_role)
  CREATE POLICY tasks_service_role_all ON tasks.task_lists      FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY tasks_service_role_all ON tasks.tasks           FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY tasks_service_role_all ON tasks.oauth_tokens    FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY tasks_service_role_all ON tasks.oauth_state     FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY tasks_service_role_all ON tasks.sync_log        FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY tasks_service_role_all ON tasks.sync_conflicts  FOR ALL TO service_role USING (true) WITH CHECK (true);
  ```
- Apply via `mcp__claude_ai_Supabase__apply_migration` (NOT execute_sql).
- After apply: verify `SELECT count(*) FROM tasks.task_lists` from the BMC backend still
  returns the row (regression test that service_role bypass still works).
- Atomic commit: `feat(security): enable RLS on tasks.* (service_role bypass policies)`

### Closing
- Final commit with consolidated `docs/team/PROJECT-STATE.md` entry covering all 5 fixes
  + a new `docs/team/HANDOFF-2026-05-22.md` (or current date) summarizing the session.

---

# Success Criteria

### Subtask 1 — Token refresh
- Manually invalidate matias's access_token in `tasks.oauth_tokens` (UPDATE to
  `pgp_sym_encrypt('invalid')`) → trigger sync via `gcloud scheduler jobs run` or wait for
  next cron → observe sync_log: `token_refreshed` event with non-401 outcome → next sync
  cycle completes with `sync_completed`.
- No `token_revoked` events fired during the test.

### Subtask 2 — Initial-sync backfill
- Run `DELETE FROM tasks.tasks WHERE user_id = matias` + `UPDATE tasks.task_lists SET
  synced_at = NULL WHERE user_id = matias` to simulate a fresh connect.
- Trigger sync.
- After 1 cycle: `tasks.tasks` contains ≥3 rows (the historical 2019 tasks).
- `/hub/tareas` UI shows them.

### Subtask 3 — ErrorBoundary copy
- Navigate Playwright to `/hub/tareas?breakme=1` after temporarily injecting a `throw new
  Error("test")` in a component → ErrorBoundary catches → page shows "Error en la
  aplicación" not "Error en la Calculadora", and includes the pathname `/hub/tareas`.
- Revert the test throw before commit.

### Subtask 4 — Anthropic API key
- `curl -X POST https://calculadora-bmc.vercel.app/api/crm/suggest-response -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{...}'` returns 200 (not 503 with `claude: invalid_request_error`).
- Trigger CI: `gh workflow run ci.yml --ref main` → "Smoke — prod API health (main only)"
  job passes → "Deploy Calculator API to Cloud Run" no longer "skipped".

### Subtask 5 — RLS
- `mcp__claude_ai_Supabase__list_tables schemas=["tasks"]` shows all 6 tables with
  `rls_enabled: true`.
- `SELECT polname FROM pg_policies WHERE schemaname = 'tasks'` returns 6 rows
  (one policy per table).
- A regression test from BMC backend: `curl /api/tasks/lists` with matias's JWT still
  returns 200 with the existing list (proves service_role bypass works).

### Global
- `npm run gate:local` exit 0 per commit (modulo pre-existing csv-guard).
- `npm run build` exit 0; no new vendor chunks introduced.
- Cloud Run latest revision serves all endpoints (the 5 subtasks together).
- `docs/team/PROJECT-STATE.md` has 1 entry per commit (5 entries total) + the handoff doc.

---

# Operational Anchors

- Source hierarchy: live code (tasksSync.js, googleTasksClient.js, main.jsx) > migration
  SQL > docs. When in doubt, read the live code.
- State labeling on every claim: `hecho confirmado` | `inferencia` | `duda abierta`.
- One-way doors call `advisor()`: RLS migration (subtask 5) + the final batch push.
- Atomic commits: one PR-sized commit per subtask. Each independently revertable.
- Push gate per `~/.claude/CLAUDE.md`: NO push to main without explicit user approval.
- Use the existing manual `gh workflow run deploy-calc-api.yml --ref main` workaround for
  Cloud Run deploys IF subtask 4 hasn't been completed yet by the time of first push.
- Documentation gate: PROJECT-STATE.md updated at COMMIT TIME, not session close.

---

# Open Items

- [ASSUMPTION: matias is still the only Tareas user with an active token | verify with
  `SELECT count(*) FROM tasks.oauth_tokens WHERE revoked_at IS NULL` before subtask 1's
  invalidation test, so we don't accidentally break other users]
- [ASSUMPTION: refresh_token in tasks.oauth_tokens is the long-lived form Google issued
  during the initial auth-code exchange | verify by checking the value's structure — Google
  refresh tokens typically start with `1//` and are ~100+ chars]
- [ASSUMPTION: user (matias) will provide a fresh Anthropic API key on request | the goal
  pauses at subtask 4 if the key is not provided; subtask 5 can still proceed without it]
- [ASSUMPTION: the Supabase service_role role exists with that exact name | verify with
  `SELECT rolname FROM pg_roles WHERE rolname = 'service_role'` before applying the policy
  migration]
- [ASSUMPTION: pre-existing sheetsCsvGuard.test.js failures remain unrelated to this work
  | confirm by `git stash` + re-run on every commit]

---

# Blockers

- **Subtask 4 needs a new Anthropic API key value from the user.** The session can proceed
  through subtasks 1, 2, 3, 5 without it; pause at 4 and ask via `AskUserQuestion` when
  reached.
