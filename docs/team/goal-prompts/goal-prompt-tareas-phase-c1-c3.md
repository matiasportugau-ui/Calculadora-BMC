# Role

You are a senior backend engineer implementing the two remaining Phase 1 stubs for the Tareas (Google Tasks bidirectional mirror) module in `calculadora-bmc`. You work with atomic commits, run `npm run gate:local` before every push, and never log plaintext credentials.

# Context

[CONFIRMED: repo state] Working directory `/Users/matias/calculadora-bmc`, branch `main`. Phase A (route mounts, identityAuth fix, cleanup) is committed as `f76109f`. Phase C.2/C.4/C.5 are committed (`4480bd3`–`6ea9808`): CRUD reads, TanStack Query hooks, and TasksModule UI are all real implementations. Only two backend route files remain as stubs.

[CONFIRMED: two files still returning stubs] `server/routes/tasksOAuth.js` returns 501 on all 3 endpoints. `server/routes/tasksSync.js` returns `"not_implemented"` and has a broken `verifyHmacSignature` (computes HMAC of empty string, uses `===` comparison).

[CONFIRMED: one file staged, not committed] `docs/hub-tasks-module/OPERATOR-CHECKLIST.md` is staged but not yet committed. Commit it first.

[CONFIRMED: infrastructure blocked] `GOOGLE_TASKS_CLIENT_ID`, `GOOGLE_TASKS_CLIENT_SECRET`, `SUPABASE_PGP_ENCRYPT_KEY`, `SYNC_HMAC_SECRET` are not yet in Cloud Run environment (operator must provision per OPERATOR-CHECKLIST.md). Code can be written and committed now; E2E testing is blocked until operator provisions. The code must degrade gracefully when env vars are missing.

[CONFIRMED: stack] Node.js 24, Express 5, ES modules only. Factory router pattern is NOT used in these files — both use `export default router`. `requireUser` middleware in `server/lib/identityAuth.js`. Pool via `getTasksPool(config.databaseUrl)` from `server/lib/tasksDb.js`.

[CONFIRMED: redirect URI registered in operator checklist] Callback URI is `https://panelin-calc.run.app/auth/tasks/callback`.

# Goal

Commit the staged operator checklist, expose 4 new env vars in `server/config.js`, implement the real OAuth PKCE flow in `server/routes/tasksOAuth.js`, and implement the real sync handler in `server/routes/tasksSync.js` — leaving the codebase code-complete for Phase 1, ready to activate once operator provisions infrastructure.

- Commit `docs/hub-tasks-module/OPERATOR-CHECKLIST.md` (already staged) before touching any code
- Add `googleTasksClientId`, `googleTasksClientSecret`, `supabasePgpEncryptKey`, `syncHmacSecret` to `server/config.js` and `.env.example`
- Implement 3 PKCE endpoints in `server/routes/tasksOAuth.js`: `/init` (generate verifier+challenge+state, redirect to Google), `/callback` (validate state, exchange code, PGP-encrypt tokens via SQL, upsert to `tasks.oauth_tokens`), `/revoke` (decrypt + POST to Google revoke + mark `revoked_at`)
- Fix `verifyHmacSignature` in `server/routes/tasksSync.js` (use `crypto.timingSafeEqual`, compare against raw HMAC secret header — NOT HMAC of body, per OPERATOR-CHECKLIST.md Step 3.3 which sends `X-Sync-Signature=${SYNC_HMAC}` as a static header)
- Implement sync loop: for each active user token → decrypt via SQL `pgp_sym_decrypt` → call Google Tasks API → upsert lists + tasks → detect conflicts → write `sync_log`
- Append Phase C.1+C.3 completion entry to `docs/team/PROJECT-STATE.md`

# Scope

**IN**: `server/routes/tasksOAuth.js`, `server/routes/tasksSync.js`, `server/config.js`, `.env.example`, `docs/team/PROJECT-STATE.md`

**OUT**: Frontend (TasksModule.jsx, useTasks.js already done — do NOT modify), `server/routes/tasks.js` (CRUD reads already done — do NOT modify), database migration (already applied — do NOT modify), Cloud Run deployment (blocked on operator), Vercel deployment

# Inputs

- [CONFIRMED] `server/routes/tasksOAuth.js` — 99-line stub; all 3 TODO blocks document exact steps to implement
- [CONFIRMED] `server/routes/tasksSync.js` — 88-line stub; broken `verifyHmacSignature` at line 31; sync loop TODO at line 55
- [CONFIRMED] `server/config.js` — add at line ~134 using pattern `key: process.env.KEY || ""`
- [CONFIRMED] `.env.example` — append 4 new variable stanzas
- [CONFIRMED] `server/lib/tasksDb.js` — provides `getTasksPool(databaseUrl)` for DB access
- [CONFIRMED] `server/lib/identityAuth.js` — provides `requireUser` middleware
- [CONFIRMED] `supabase/migrations/20260602000001_tasks_init.sql` — schema reference (READ ONLY): tables `tasks.oauth_state`, `tasks.oauth_tokens`, `tasks.sync_log`, `tasks.sync_conflicts`, `tasks.task_lists`, `tasks.tasks`
- [CONFIRMED] `docs/hub-tasks-module/OPERATOR-CHECKLIST.md` — Step 3.3 shows `X-Sync-Signature` is the raw HMAC secret (not a body signature). Match this in `verifyHmacSignature`.
- [CONFIRMED] `docs/hub-tasks-module/OPERATOR-CHECKLIST.md` — Step 1.1 shows redirect URI: `https://panelin-calc.run.app/auth/tasks/callback`

# Tools & MCPs

- **Bash**: `git status`, `git commit`, `git push`, `npm run gate:local` (mandatory before every push)
- **Read**: verify existing file contents (config.js pattern, tasksDb.js exports, oauth_state schema) before editing
- **Edit**: targeted edits to route files and config — prefer Edit over Write to minimize diff
- **Supabase MCP** (`mcp__claude_ai_Supabase__*`): `execute_sql` to verify `tasks.oauth_state` column names and types if uncertain. Optional but helpful.
- Tools NOT needed: Vercel MCP, Shopify MCP, web search

# Constraints & Guardrails

- DO NOT log plaintext `access_token` or `refresh_token` — mask as `"***" + token.slice(-4)` in any error output
- DO NOT do PGP encryption/decryption in JavaScript — use `pgp_sym_encrypt($1::text, $2)` and `pgp_sym_decrypt($1::bytea, $2)` inside SQL queries. The JS code only passes the plaintext value and key as query parameters; the Postgres function does the crypto
- DO NOT use `===` or `==` for HMAC/secret comparison — use `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))`
- DO NOT store OAuth PKCE state in-memory — use the `tasks.oauth_state` table (survives restarts and horizontal scaling)
- DO NOT delete the `tasks.oauth_state` row before retrieving the `code_verifier` — do `DELETE ... RETURNING code_verifier` in a single query
- DO NOT use `require()` — ES modules only (`import`/`export`)
- DO NOT use `export function createTasksOAuthRouter(config)` factory pattern — both stubs already use `export default router` — keep consistent
- DO NOT skip `npm run gate:local` before any push
- DO NOT run `npm audit fix --force` — forbidden in this repo (has broken Vite before)
- DO NOT push with `--force` or `--no-verify`
- DO degrade gracefully when `config.googleTasksClientId` is empty — return `503 { ok: false, error: "oauth_not_configured", message: "Google Tasks OAuth credentials not provisioned" }` instead of throwing
- DO use `access_type=offline&prompt=consent` in the Google OAuth URL to guarantee refresh_token is returned on first consent

# Anti-patterns

- DO NOT apply or pop `git stash` — stash list is empty; attempting this will error
- DO NOT modify `server/routes/tasks.js` — READ endpoints are already real; WRITE endpoints correctly return 503
- DO NOT modify `server/index.js` — all 3 task routes are already mounted (commit `f76109f`)
- DO NOT modify `supabase/migrations/` — schema is applied and ADR-locked
- DO NOT hardcode `GOOGLE_TASKS_CLIENT_ID` or credentials — must come from `config.googleTasksClientId`
- DO NOT re-implement frontend hooks or UI — `TasksModule.jsx` and `useTasks.js` are already done
- DO NOT send the JWT in a URL query parameter for the `/init` OAuth redirect — this exposes the token in server logs. Instead add `requireUser` to the `/init` route AND update the frontend CTA from `<a href="/auth/tasks/init">` to a JS-driven fetch+redirect (see Open Items #1)
- DO NOT treat the `X-Sync-Signature` header as a HMAC-of-body — per OPERATOR-CHECKLIST.md Step 3.3, it is the raw HMAC secret value sent as a static header by Cloud Scheduler. Verification = `timingSafeEqual(incoming, expectedSecret)`

# Deliverables

- `docs/hub-tasks-module/OPERATOR-CHECKLIST.md` committed: `git commit -m "docs(tasks-module): Phase 1 operator provisioning checklist"`
- `server/config.js` with 4 new keys committed: `git commit -m "chore(tasks-module): expose Google Tasks env vars in config"`
- `.env.example` with 4 new commented entries (same commit as config.js)
- `server/routes/tasksOAuth.js` — real PKCE flow, committed: `git commit -m "feat(tasks-module): implement OAuth PKCE flow with PGP token encryption"`
- `server/routes/tasksSync.js` — fixed HMAC + real sync loop, committed: `git commit -m "feat(tasks-module): implement Cloud Scheduler sync handler with conflict detection"`
- `docs/team/PROJECT-STATE.md` — append under "Cambios recientes": `2026-05-18 — Tareas Phase C.1+C.3: OAuth PKCE + sync handler implemented; code-complete, blocked on operator infra provisioning (see OPERATOR-CHECKLIST.md)`
- All 4 commits pushed to `origin/main`

# Success Criteria

- `grep -rE "not_implemented" server/routes/tasks*.js` returns empty
- `npm run gate:local` exits 0 with ≤24 lint warnings (baseline, not exceeded)
- `git log --oneline -5` shows 4 new commits matching the expected messages above
- `node -e "import('./server/routes/tasksOAuth.js').then(m => console.log('OK'))"` exits 0 (no import errors)
- `node -e "import('./server/routes/tasksSync.js').then(m => console.log('OK'))"` exits 0
- `grep -c "googleTasksClientId\|googleTasksClientSecret\|supabasePgpEncryptKey\|syncHmacSecret" server/config.js` returns 4
- `grep -c "GOOGLE_TASKS_CLIENT_ID\|GOOGLE_TASKS_CLIENT_SECRET\|SUPABASE_PGP_ENCRYPT_KEY\|SYNC_HMAC_SECRET" .env.example` returns 4
- `docs/team/PROJECT-STATE.md` contains the Phase C.1+C.3 changelog entry

# Operational Anchors

- Source hierarchy: code > docs > memory. The migration file `20260602000001_tasks_init.sql` is the schema source of truth for column names; if docs and migration disagree, trust the migration.
- State labeling: mark every claim in PROJECT-STATE.md update as `hecho confirmado` for completed items, `bloqueado: operador` for infrastructure items.
- Triangulation: before writing any SQL in the route files, verify the exact column names match `tasks.oauth_state` and `tasks.oauth_tokens` schema from the migration file.
- Atomic commits: one logical change per commit. Do not batch config + OAuth into one commit.
- gate:local before EVERY push — no exceptions.
- BMC conventions: snake_case in DB columns, camelCase in JS config keys, JWT Bearer via `requireUser`, no `require()`.

# Open Items

- [ASSUMPTION: `/auth/tasks/init` authentication approach | verify before implementing] The current stub has no `requireUser`. The frontend `TasksModule.jsx` links to `/auth/tasks/init` via a plain `<a>` tag (no Authorization header). Two options: (A) Add `requireUser` to `/init` AND change the frontend CTA to a `<button onClick>` that fetches `/auth/tasks/init` with the Bearer token and then `window.location.href = responseUrl`; (B) Keep `/init` unauthenticated and extract user identity differently. Option A is more secure. Read `src/components/hub/tasks/TasksModule.jsx` to see current CTA implementation and decide.

- [ASSUMPTION: `getTasksPool` accepts `databaseUrl` as the only argument | basis: tasks.js imports it this way] Verify in `server/lib/tasksDb.js` that `getTasksPool(config.databaseUrl)` is the correct call signature before using it in OAuth routes.

- [ASSUMPTION: No `node-fetch` needed — Node 24 has native `fetch` | basis: `engines.node = "24.x"` in package.json] All Google API HTTP calls can use native `fetch()`. Do NOT add `node-fetch` dependency.

- [ASSUMPTION: `tasks.oauth_state` columns are: `user_id`, `state_nonce`, `code_verifier`, `expires_at` | basis: migration file] Verify exact column names from `supabase/migrations/20260602000001_tasks_init.sql` before writing INSERT/SELECT queries.

- [ASSUMPTION: `tasks.oauth_tokens` columns include `access_token_encrypted`, `refresh_token_encrypted`, `expires_at`, `revoked_at` | basis: route TODO comments] Verify from migration file.

- None — all infrastructure items are documented in OPERATOR-CHECKLIST.md. Code runs independently of infrastructure (degrades with 503 when config keys are empty).
