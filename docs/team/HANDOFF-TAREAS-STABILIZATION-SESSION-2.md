# Handoff — Tareas Stabilization Session 2 (2026-05-21)

Continuation of `HANDOFF-2026-05-22.md` ("Session 1"). Focus this session: E2E verification of Phase C.1+C.3 against live production, fix the regressions surfaced during activation, drive bidirectional sync to first-data-round-trip.

## Branch
`main` at `4750a4a docs(oauth): document redirect_uri_mismatch fix + add bitacora and runbook`. Working tree clean except for `src/data/calculatorDataVersion.js` (build-stamp; auto-regenerated, do NOT commit).

## What landed this session (commits, oldest first)

| Commit | Why |
|--------|-----|
| `494ae62` | `chore(tasks-module): expose Google Tasks env vars in config` — 4 keys + `.env.example` |
| `d6526b5` | `feat(tasks-module): implement OAuth PKCE flow with PGP token encryption` — `/init`, `/callback`, `/revoke` real implementations |
| `e702c73` | `fix(auth): wrap App with QueryClientProvider to unblock TasksModule` (parallel session — needed by TanStack hooks) |
| `4ee410d` | `feat(tasks-module): implement Cloud Scheduler sync handler with conflict detection` — fixed broken HMAC, real sync loop |
| `883b4cb` | `docs(project-state): log Tareas Phase C.1+C.3 code-complete` |
| `47703b9` | `fix(tasks-module): point OAuth callback redirect at the frontend host` — advisor caught this before E2E |
| `87ce2d1` | `fix(vercel): proxy /auth/* and /sync/* paths to Cloud Run` — **critical**; without it, frontend's `fetch('/auth/tasks/init')` was hitting the SPA wildcard and silently failing |
| `6e97b5e` | `fix(tasks-module): invoke requireUser factory, not pass it bare` — **critical**; was causing 60s upstream timeouts on every `/auth/tasks/*` and `/api/tasks/*` request because Express never called the returned middleware |
| `2cf5ffd` | `chore(tasks-module): auto-cleanup expired oauth_state on each sync cycle` — sweeps the 5-min-TTL rows so debug-loop residue self-clears |
| `625d3a6` | `docs(project-state): Tareas Phase C E2E live + verified` — narrated the full first-success arc |
| `92769c6` | `docs(tasks-module): update redirect URI to Vercel SPA host` — OPERATOR-CHECKLIST tells operator to register the Vercel callback URL in GCP OAuth client |

Plus parallel-session commits that landed in the same window and now form the stack: `ea5b8c7` (BMC as system-of-record / outbound writes / `googleTasksClient.js`), `503e26c`, `4be393c` (RLS on `tasks.*`), `4398e25` (Session 1 handoff), `52a91a4`, `c514a7f`, `4750a4a`.

## Bugs found + fixed during E2E activation (the "fix-loop")

1. **`vercel.json` missing `/auth/*` rewrite** — frontend fetch fell through to SPA HTML, JSON parse returned `{}`, button silently errored. Fix: `87ce2d1`.
2. **`requireUser` factory misuse** — `tasks.js:35`, `tasksOAuth.js:36,248` passed the factory function instead of invoking it. Express called the factory with `(req,res,next)` (treating `req` as `opts`), got back a middleware function, ignored the return, request hung 60s. Fix: `6e97b5e`. Confirmed via probe: `GET /auth/tasks/init` went from `504/60.2s` to `401/303ms`.
3. **REDIRECT_URI host change** — switched to `${config.frontendBaseUrl}/auth/tasks/callback` (Vercel domain) so the user stays on one host; requires the operator to register the Vercel callback URL in the GCP OAuth client (documented in `OPERATOR-CHECKLIST.md`, commit `92769c6`).
4. **Stale `oauth_state` rows** — 13 abandoned debug-loop rows accumulated; now auto-cleaned every sync cycle (`2cf5ffd`).

## Production state right now (2026-05-21 06:51 UTC)

### What works
- All 7 backend routes pass smoke probes in 300-400ms (verified at 04:59 UTC):
  `/auth/tasks/init`→401, `/revoke`→401, `/callback` (no params)→400, `/callback?state=nonexistent`→400 state_invalid, `/api/tasks/lists`→401, `/sync/.../pull` (no sig)→403, (wrong sig)→403.
- OAuth flow works end-to-end. Token persisted for `c66f0acc-1a97-4e05-9c08-525997b4b248` at `04:50:44 UTC`.
- Cloud Scheduler `tasks-sync-60s` fires on 60s cadence (verified 10 consecutive `sync_completed` rows).
- **Bidirectional sync demonstrated**:
  - Inbound: `"Lista de Matías"` pulled from Google at `04:53`.
  - Outbound (via parallel session's `ea5b8c7`): `"Mat"` list, `"No gilees"` task, `"Test from BMC"` task all pushed to Google at `05:50`.
- RLS enabled on all 6 `tasks.*` tables (`4be393c`); service_role bypass intact.

### What's broken (single open blocker)
- **Token in revoke loop.** access_token expired at `05:50:43` (Google 1-hour TTL). The new `fetchWithRefresh()` + `refreshAccessToken()` helpers (deployed in `503e26c`) are NOT successfully refreshing — every attempt ends in `token_revoked` with `reason=google_401`. Three successive un-revoke→sync→re-revoke cycles at `05:51`, `06:25`, `06:51` UTC.
- **The refresh failure reason is silently swallowed** by `fetchWithRefresh`'s empty `try {...} catch {}` — we have no log line telling us *why* `refreshAccessToken` is throwing. Could be:
  - `no_refresh_token_stored` (decrypts short/empty)
  - `refresh_failed_http_400 invalid_grant` (Google says the refresh_token is dead)
  - A bug in the new code path
- DB-side evidence: `oauth_tokens.refresh_token_encrypted` is 340 bytes (matches a real Google refresh_token after PGP encrypt overhead), so the bytes are present. The decrypt path or Google's acceptance is what's failing.

## Replanned next steps (4 atomic, ~15 min)

1. **Add diagnostic logging.** Replace the empty `catch {}` in `tasksSync.js fetchWithRefresh` with one that writes a `sync_failed` row containing `refresh_error_message`. One-line code change. Same for the `googleTasksClient.js call()` retry path so outbound writes log it too.
2. **Commit + push + `workflow_dispatch` deploy** (CI is red on pre-existing `sheetsCsvGuard` failures, so auto-deploy won't fire — must use manual dispatch).
3. **User re-OAuth once.** Fresh refresh_token. New logging captures whatever happens.
4. **Wait ~70 min** (next access_token expiry). Query `sync_log`: if `token_refreshed` row appears, the loop is self-sustaining. If `sync_failed` appears with refresh_error_message, we now know the exact cause.

If after step 4 the refresh still fails with `invalid_grant`, the root cause is Google-side (refresh_token was invalidated, possibly by repeated `prompt=consent` flows). Mitigation options:
- Switch `/init` to `prompt=` (omit) so we don't burn refresh_tokens on every reconnect — but loses the "force fresh consent" property.
- Move the access scope to long-lived (service-account-style) — not available for user-OAuth Tasks.

## Open items NOT addressed this session (out of Tareas scope)

- **Pre-existing `sheetsCsvGuard.test.js` baseline failures** (tab/CR prefix tests) — keep failing CI on every push to main, blocking auto-deploy. Every backend ship in this session required `gh workflow run deploy-calc-api.yml --ref main`. Fix or quarantine the tests to restore the green-CI-auto-deploy invariant.
- **Rich task fields (time / all-day / repeat)** the user requested per the Google Tasks creation modal screenshot. The Google Tasks API v1 only supports `title`, `notes`, `due` (date), `status`, `parent_id` — time/all-day/repeat in the Google UI come from a Calendar integration not exposed in the Tasks API. If the user wants these, they need a separate Google Calendar API integration (Phase D-class scope, ~1-2 days).
- **Anthropic key rotation** — still flagged blocked from Session 1.

## Literal next prompt to resume with

```
Continue Tareas Stabilization. Read docs/team/HANDOFF-TAREAS-STABILIZATION-SESSION-2.md
"Replanned next steps" section. Execute step 1 (add diagnostic logging to
fetchWithRefresh in server/routes/tasksSync.js and to call() in
server/lib/googleTasksClient.js — write sync_log 'sync_failed' rows with
the actual refreshAccessToken error message instead of swallowing).
Commit + push + workflow_dispatch deploy-calc-api.yml. Then ask the user
to re-OAuth once and run the 70-min observability watch via Supabase MCP.
```

## Reference queries (paste into Supabase MCP `execute_sql` on `htnwozvopveibwppyjhg`)

```sql
-- Full pipeline snapshot
SELECT 'oauth_state'    AS metric, COUNT(*)::text AS value FROM tasks.oauth_state
UNION ALL SELECT 'oauth_tokens_active',  COUNT(*)::text FROM tasks.oauth_tokens WHERE revoked_at IS NULL AND expires_at > now()
UNION ALL SELECT 'oauth_tokens_revoked', COUNT(*)::text FROM tasks.oauth_tokens WHERE revoked_at IS NOT NULL
UNION ALL SELECT 'task_lists', COUNT(*)::text FROM tasks.task_lists
UNION ALL SELECT 'tasks_alive', COUNT(*)::text FROM tasks.tasks WHERE is_deleted = FALSE
UNION ALL SELECT 'sync_log_last_10min', COUNT(*)::text FROM tasks.sync_log WHERE created_at > now() - interval '10 min'
ORDER BY metric;

-- Most recent sync events (narrative)
SELECT created_at, event_type, http_status_code, details
FROM tasks.sync_log ORDER BY created_at DESC LIMIT 10;

-- Manual un-revoke (after re-OAuth, NOT needed if user does fresh /init flow)
UPDATE tasks.oauth_tokens
   SET revoked_at = NULL, updated_at = now()
 WHERE user_id = 'c66f0acc-1a97-4e05-9c08-525997b4b248'
RETURNING user_id, expires_at, revoked_at;
```

## Anchors

- Schema source of truth: `supabase/migrations/20260602000001_tasks_init.sql` + `20260522000002_tasks_rls.sql`.
- Source hierarchy: code > docs > memory.
- Phase 1 operator checklist: `docs/hub-tasks-module/OPERATOR-CHECKLIST.md` (now includes the Vercel callback URL).
- Phase C.1+C.3 canonical changelog: `docs/team/PROJECT-STATE.md` → "Cambios recientes" → "2026-05-21 PM (Tareas module — Phase C E2E live + verified)".
