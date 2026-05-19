# Tareas Module Phase 1 — Plan and Execute

## Role

Backend + frontend implementation agent for Phase 1 of the Tareas Module (Google Tasks integration). Execute the roadmap sequence: blockers documentation → specialized skill invocations → backend implementation → frontend wiring → integration tests → Cloud Scheduler configuration. Maintain atomic commits per goal completion and push to `feat/tasks-module` after each goal.

## Context

[CONFIRMED: Phase 0 scaffolding complete] 8 files committed and pushed to `feat/tasks-module` (2026-05-18):
- 6 documentation files in `docs/hub-tasks-module/` (feasibility, architecture, roadmap, decisions + stubs for MCP and frontend)
- 3 backend route stubs in `server/routes/` (tasksOAuth.js, tasks.js, tasksSync.js)
- 3 frontend component stubs in `src/components/hub/tasks/` (TasksModule.jsx, useTasks.js, useTasksSync.js)
- identityAuth.js updated to include "tareas" in ALL_MODULES (line 27–38)

[CONFIRMED: @tanstack/react-query installed] `npm install @tanstack/react-query@latest` completed; 2 packages added, dependency locked in package-lock.json.

[CONFIRMED: User workflow preference] Per prior session: atomic commits per goal completion, push after each goal. Message: "each time you reach the goals, please save, commit and push."

[CONFIRMED: Key architecture decisions made] Phase 0 finalized:
- OAuth 2.0 PKCE flow (not implicit grant)
- Polling-based sync with exponential backoff (not WebSockets)
- Soft-delete conflict resolution (mandatory human review, no automatic merge)
- Application-layer AES-256 token encryption (not pgp_sym_encrypt) for key rotation flexibility
- Theme: extend BMC palette (not isolated component theme)
- Scope: Google Tasks only, no Outlook/Todoist/Asana
- MCP server: Node.js + pg + @googleapis/tasks client

## Goal

Implement Phase 1 of the Tareas Module by sequencing specialized skill invocations (MCP builder, theme factory, web artifacts), then replacing 501 backend stubs with actual Google Tasks API integration, wiring frontend hooks to the backend, adding integration tests, and configuring Cloud Scheduler — maintaining atomic commits and push discipline after each goal.

**Expansion (7 bullets):**
- Document all Phase 1 blockers explicitly (DATABASE_URL, OAuth credentials, Cloud Scheduler IAM) before any implementation begins.
- Invoke `/mcp-builder` to flesh out `02-mcp-server.md` into a full MCP spec (tools table, auth flow, deployment plan).
- Invoke `/theme-factory` to generate Tareas module theme tokens (extend BMC palette for task lists, task cards, conflict UI).
- Invoke `/web-artifacts-builder` to scaffold interactive component demo and Figma-compatible UI kit.
- Replace 501 stubs in backend routes with actual Google Tasks API integration (tasks.list, tasks.move, tasks.patch, tasks.delete, handling rate limits and sync errors).
- Wire frontend components and hooks to backend: implement useTasks/useTasksSync, add IndexedDB offline queue, build sync conflict UI, handle optimistic updates.
- Add integration tests (contract tests for OAuth PKCE flow, sync pull/push with conflict scenarios) and configure Cloud Scheduler with OIDC token verification.

## Scope

**IN:**
- Backend route implementation: OAuth endpoints (PKCE challenge/callback/revoke), CRUD endpoints (/api/tasks/*), sync handler (POST /sync/google-tasks/pull).
- Frontend component wiring: TasksModule, TaskListPicker, TaskListDetail, TaskEditor, ConflictResolver, SyncStatus UI.
- Google Tasks API integration: tasks.list, tasks.move, tasks.patch, tasks.delete with retry logic and rate-limiting.
- Offline-first queue: IndexedDB storage for unsyncable edits, conflict detection on pull.
- Integration tests: OAuth flow contract tests, sync scenarios (new task, edit, move, delete, conflict), rate-limiting recovery.
- Cloud Scheduler setup: cron job, OIDC token verification, error handling.
- Atomic commits: one commit per completed goal, push to `feat/tasks-module` after each.

**OUT:**
- Infrastructure provisioning: DATABASE_URL, OAuth credentials provisioning, Cloud Scheduler IAM configuration (operator responsibility; blockers documented only).
- Modifying Phase 0 deliverables (docs, schema, base stubs are final).
- Adding other task integrations (Outlook, Todoist, Asana — scope is Google Tasks only).
- UI/UX refinement beyond component scaffolding (theme factory output is the baseline).
- Changing core calculator or other BMC modules.

## Constraints & Guardrails

**Hard rules:**
- [CONFIRMED] OAuth PKCE flow required (no implicit grant, no client secret in frontend).
- [CONFIRMED] Row-level security (RLS) enforced at database layer: service_role only (see `20260602000001_tasks_init.sql`).
- [CONFIRMED] Soft-delete conflict model: sync conflicts marked for human review, no automatic resolution. Marked records remain in database until operator reviews.
- [CONFIRMED] Polling-based sync: no WebSockets. Cloud Scheduler invokes POST /sync/google-tasks/pull on a cron schedule (operator configures schedule).
- [CONFIRMED] Token encryption at rest: application-layer AES-256 (Phase 1 implements per decision record in `05-decisions.md`).
- [CONFIRMED] Identity module integration: "tareas" module must be registered in `server/lib/identityAuth.js` ALL_MODULES (already done Phase 0).

**Read-only zones:**
- `docs/hub-tasks-module/` — architecture decisions are final; document deviations only if discovery reveals infeasibility.
- `supabase/migrations/20260602000001_tasks_init.sql` — schema is final; Phase 1 does not alter tables.
- `server/lib/identityAuth.js` — "tareas" already added; do not remove or rename.

**Security:**
- OAuth tokens stored encrypted in `identity.tasks_oauth_tokens.token_encrypted` (AES-256-GCM, key from `.env.GOOGLE_TASKS_TOKEN_KEY`).
- Cloud Scheduler validates OIDC token in Authorization header: `POST /sync/google-tasks/pull` must verify `Bearer <OIDC token>` with Google's cert endpoints.
- No credentials in logs, error messages, or frontend code. Use `pino-http` middleware in Express (already in stack).

**Audit-sensitive material:**
- OAuth callback must not log redirect_uri or code (token exchange is sensitive).
- Rate limit errors (429) must be logged but not exposed to frontend (return 503 Service Unavailable).
- Sync conflicts must record the exact diff (old vs. new state) for audit trail.

## Inputs

**Documentation (read-only, Phase 0 deliverables):**
- `/Users/matias/calculadora-bmc/HANDOFF-TASKS-PHASE-0.md` — Phase 0 completion summary, Phase 1 blockers, resume instructions.
- `/Users/matias/calculadora-bmc/docs/hub-tasks-module/00-feasibility.md` — GO verdict, cost matrix, 6 risks + mitigations.
- `/Users/matias/calculadora-bmc/docs/hub-tasks-module/01-architecture.md` — C4-lite OAuth PKCE diagram, Supabase schema (3 tables), polling sync strategy, conflict resolution.
- `/Users/matias/calculadora-bmc/docs/hub-tasks-module/04-roadmap.md` — Phases 0–4, binary exit criteria, time estimates, per-phase risks.
- `/Users/matias/calculadora-bmc/docs/hub-tasks-module/05-decisions.md` — 8 ADR-lite entries (polling vs. middleware, conflict resolution, OAuth storage, MCP stack, theme, scope, sync, token encryption).

**Code stubs (to be replaced Phase 1):**
- `/Users/matias/calculadora-bmc/server/routes/tasksOAuth.js` — OAuth endpoints (GET /auth/tasks/init, GET /auth/tasks/callback, POST /auth/tasks/revoke) returning 501.
- `/Users/matias/calculadora-bmc/server/routes/tasks.js` — CRUD endpoints (GET/POST/PATCH/DELETE /api/tasks/lists, etc.) returning 501.
- `/Users/matias/calculadora-bmc/server/routes/tasksSync.js` — Sync handler (POST /sync/google-tasks/pull) returning 501.
- `/Users/matias/calculadora-bmc/src/components/hub/tasks/TasksModule.jsx` — Module entry, Suspense wrapper (placeholder Phase 0).
- `/Users/matias/calculadora-bmc/src/components/hub/tasks/hooks/useTasks.js` — TanStack Query hooks (useTaskLists, useTaskList, useMutateTask) with stub signatures.
- `/Users/matias/calculadora-bmc/src/components/hub/tasks/hooks/useTasksSync.js` — Sync hooks (useSyncStatus, useManualSync, useConflictResolver) with stub signatures.

**Configuration (already present):**
- `/Users/matias/calculadora-bmc/server/lib/identityAuth.js` — ALL_MODULES includes "tareas" (Phase 0); verify no changes needed.
- `/Users/matias/calculadora-bmc/package.json` — @tanstack/react-query@latest installed Phase 0; check for other missing deps (googleapis, aes-js, etc.).
- `/Users/matias/calculadora-bmc/.env.example` — verify GOOGLE_TASKS_TOKEN_KEY, GOOGLE_TASKS_CLIENT_ID, GOOGLE_TASKS_CLIENT_SECRET placeholders present.

**Git state:**
- Branch: `feat/tasks-module` (created Phase 0, currently active).
- Last commit: chore(tasks-module): add @tanstack/react-query for frontend state management (2026-05-18).
- Uncommitted: none (Phase 0 fully committed and pushed).

## Tools & MCPs

**Specialized skills (to be invoked):**
- `/mcp-builder` — Flesh out `02-mcp-server.md` into full MCP spec (tools table, auth flow diagram, deploy checklist).
- `/theme-factory` — Generate Tareas module theme tokens (colors, spacing, typography) extending BMC palette.
- `/web-artifacts-builder` — Scaffold interactive component demo and Figma-compatible UI kit from component stubs.

**Standard Claude Code tools:**
- `Edit` — Replace 501 stubs with actual implementation (backend routes, frontend hooks).
- `Read` — Inspect architecture docs, schema, Phase 0 stubs before implementing.
- `Write` — Create test files (contract tests for OAuth, sync, conflict resolution).
- `Bash` — Run `npm install` for missing deps, `npm run test:api` for contract tests, `npm run lint` pre-commit.
- `Agent` — For exploration tasks (e.g., Google Tasks API discovery) if not covered by existing docs.

**External APIs / libraries:**
- `@googleapis/tasks` — Google Tasks API v1 client (to be imported in backend routes).
- `@google-auth-library/nodejs` — Google OAuth client (already in stack for other integrations).
- `aes-js` or `crypto` module — Token encryption at-rest (select per Phase 1 implementation).
- `idb` or native IndexedDB — Offline queue storage in frontend.
- `jest` or `vitest` — Integration test runner (already in `npm run test:api` stack).

## Anti-patterns

**Known failure modes (do NOT repeat):**
1. **Assuming infrastructure is provisioned**: DATABASE_URL, OAuth credentials, Cloud Scheduler are operator responsibilities. Document blockers explicitly before implementing routes that depend on them. Phase 1 can implement routes, but tests will fail if infrastructure is missing.
2. **Skipping the polling sync for WebSockets**: Architecture decided polling (not WebSockets) for simplicity and cost. Do not refactor to bidirectional sync without revisiting `05-decisions.md` and feasibility.
3. **Automatic conflict resolution**: The soft-delete model requires human review; do not merge conflicts silently. Marked records stay in database until operator reviews.
4. **Storing OAuth tokens plaintext**: Enforce encryption at rest. Do not store `refresh_token` or `access_token` without AES-256-GCM.
5. **Logging sensitive data**: Do not log OAuth codes, tokens, or full error stack traces in production. Use `pino-http` and log only metadata.
6. **Forgetting atomic commits**: User workflow requires one commit per goal, push after each. Do not batch multiple goals into one commit.
7. **Changing schema mid-Phase**: The `20260602000001_tasks_init.sql` migration is final. Do not add columns, change indexes, or alter RLS policies in Phase 1 without a new migration and re-documentation.
8. **Skipping integration tests**: Contract tests for OAuth PKCE flow and sync scenarios are mandatory before Cloud Scheduler config. Unit tests alone will not catch OAuth state leaks or sync race conditions.

## Deliverables

**Backend implementation (4 files, all server/routes/):**
1. `server/routes/tasksOAuth.js` — OAuth PKCE endpoints, replace 501 stubs:
   - `GET /auth/tasks/init` — Generate PKCE challenge, state, store in `identity.tasks_oauth_state` (TTL 10min), return challenge + state to frontend.
   - `GET /auth/tasks/callback` — Verify state, exchange code for token (PKCE), store encrypted token in `identity.tasks_oauth_tokens`, return redirect to `/hub/tasks`.
   - `POST /auth/tasks/revoke` — Revoke stored token from Google, mark as revoked in database.
   - Rate limiting: 20/15min per user for init, 30/15min for callback (Google's defaults).
   - Error handling: log errors to pino, return appropriate status (400 for invalid state, 503 for Google API errors).

2. `server/routes/tasks.js` — CRUD endpoints, replace 501 stubs:
   - `GET /api/tasks/lists` — List all task lists for authenticated user (via Google Tasks API).
   - `GET /api/tasks/lists/:listId` — Get details for one task list.
   - `POST /api/tasks/lists/:listId/tasks` — Create a new task in a list.
   - `GET /api/tasks/lists/:listId/tasks` — List all tasks in a list (paginated).
   - `PATCH /api/tasks/lists/:listId/tasks/:taskId` — Update a task (title, notes, due date, status).
   - `DELETE /api/tasks/lists/:listId/tasks/:taskId` — Delete a task.
   - Rate limiting: 100/60min per user (Google's quota, lower for testing).
   - Offline: store unsyncable edits in IndexedDB (frontend responsibility); routes return 503 if Google API unavailable.

3. `server/routes/tasksSync.js` — Sync handler, replace 501 stub:
   - `POST /sync/google-tasks/pull` — Cloud Scheduler target; validate OIDC token in Authorization header, pull updates from Google Tasks API for all users with active tokens, detect conflicts, store in `identity.sync_conflicts` (soft-delete model), run once per 15min (operator configures cron).
   - Error handling: log errors, continue for other users on individual failures, return 503 if majority fail.
   - Idempotency: use `updatedMin` parameter to pull only changes since last sync.

4. `server/lib/tasks.js` (new utility file) — Shared helpers:
   - `getTasksClient(userId)` — Instantiate Google Tasks client with user's decrypted OAuth token.
   - `decryptToken(encryptedToken, key)` — Decrypt AES-256-GCM token from database.
   - `mapGoogleTaskToDb(googleTask)` — Transform Google Tasks API response to database schema.
   - `handleGoogleTasksError(error)` — Classify Google API errors (rate limit, auth, transient, etc.) for retry logic.

**Frontend implementation (4 files, all src/components/hub/tasks/):**
1. `TasksModule.jsx` — Module entry, replace placeholder:
   - Render TaskListPicker (list selector dropdown).
   - Render TaskListDetail (task grid + editor).
   - Handle sync status display (pulling, conflicts, last sync time).
   - Lazy-loadable with Suspense wrapper.

2. `hooks/useTasks.js` — TanStack Query hooks, replace stub signatures:
   - `useTaskLists()` — Query GET /api/tasks/lists, auto-refetch on window focus.
   - `useTaskList(listId)` — Query GET /api/tasks/lists/:listId/tasks, paginated.
   - `useMutateTask()` — Mutation for POST/PATCH/DELETE, optimistic update + rollback on error.

3. `hooks/useTasksSync.js` — Sync state hooks, replace stub signatures:
   - `useSyncStatus()` — Poll sync status endpoint (GET /api/tasks/sync/status or stored in state), return {syncing, lastSync, conflicts}.
   - `useManualSync()` — Mutation for POST /api/tasks/sync/pull-now (manual trigger), return {mutate, isLoading}.
   - `useConflictResolver()` — Query sync conflicts, mutation to resolve (keep local, keep remote, merge).

4. `index.js` (new) — Module barrel export (TasksModule, hooks, components).

**Integration tests (2 files, tests/ directory):**
1. `tests/tasksOAuth.test.js` — Contract tests:
   - PKCE flow: state generation, challenge storage, code exchange, token storage.
   - Rate limiting: exceed limits, verify 429 response.
   - Error scenarios: invalid state, Google API errors, network timeout.

2. `tests/tasksSync.test.js` — Sync contract tests:
   - Pull with no conflicts: verify tasks update in database.
   - Pull with local edit + remote edit (conflict): verify conflict record created (soft-delete).
   - Rate limiting recovery: 429 → exponential backoff + retry.
   - Pagination: pull with `pageSize`, verify next page fetched.
   - OIDC token validation: valid token → proceed; invalid token → 403.

**Documentation updates (1 file, docs/hub-tasks-module/):**
1. `PHASE-1-COMPLETE.md` — Summary of Phase 1 deliverables, verification checklist, blockers resolved, Phase 2 entry criteria.

**Commits (atomic, per goal completion):**
- `feat(tasks-oauth): implement PKCE flow endpoints`
- `feat(tasks-crud): implement task list and task CRUD endpoints`
- `feat(tasks-sync): implement Google Tasks pull sync with conflict detection`
- `feat(tasks-frontend): wire components and hooks to API`
- `test(tasks-integration): add contract tests for OAuth and sync`
- `docs(tasks-phase-1): document Phase 1 completion and Phase 2 entry criteria`

## Success Criteria

**Code quality:**
- `npm run lint` returns 0 errors in tasks-related files.
- `npm run test:api` passes all contract tests (OAuth PKCE, sync scenarios, rate limiting).
- No TypeScript errors (if types added for tasks routes).
- No console.log in production paths; use `pino` for all logging.

**Functional correctness:**
- OAuth callback correctly stores encrypted token in `identity.tasks_oauth_tokens`.
- GET /api/tasks/lists returns non-empty array when user has active token.
- Sync pull detects conflicts and stores them in `identity.sync_conflicts` with soft-delete marker.
- Frontend hooks (useTasks, useSyncStatus) render task lists and handle loading/error states.
- Optimistic updates in frontend rollback on API error.

**Integration:**
- Cloud Scheduler can invoke POST /sync/google-tasks/pull with OIDC token (configure in Phase 2, but endpoint must be ready for test).
- All endpoints return appropriate HTTP status codes (200, 400, 401, 403, 429, 503).
- Rate limiting enforced: 429 returned when limits exceeded; client implements exponential backoff.

**Documentation:**
- PHASE-1-COMPLETE.md fully filled with deliverables, test results, Phase 2 entry criteria.
- All Phase 0 docs (00-feasibility, 01-architecture, 04-roadmap, 05-decisions) reviewed; deviations documented in new decisions file if any.

**Git discipline:**
- One commit per goal completion (6 commits total for Phase 1).
- Each commit message references the deliverable (feat/test/docs prefix).
- All commits pushed to `feat/tasks-module` branch (no squashing; linear history).

## Operational Anchors

**Source hierarchy (per CLAUDE.md):**
1. **docs/hub-tasks-module/** (architecture decisions, feasibility, roadmap) — canonical for design trade-offs.
2. **code stubs** (Phase 0 deliverables) — canonical for implementation baseline.
3. **Google Tasks API documentation** (googleapis/tasks v1) — canonical for API contracts.
4. **Supabase PostgreSQL schema** (`20260602000001_tasks_init.sql`) — canonical for data model.
5. **BMC/Calculadora-BMC conventions** (CLAUDE.md, AGENTS.md, identityAuth.js) — canonical for integration patterns.

**State labeling (per PROJECT-STATE.md convention):**
- `[BLOCKER]` — Phase 1 cannot proceed without operator action (DATABASE_URL, OAuth credentials, Cloud Scheduler IAM).
- `[DECISION]` — Trade-off or architectural choice documented in `05-decisions.md`.
- `[RISK]` — Known risk from Phase 0 feasibility; mitigation strategy applied.
- `[DUDA ABIERTA]` — Open question requiring clarification before Phase 2.

**Commit discipline (per CLAUDE.md):**
- Atomic commits: one goal per commit, no squashing or force-push.
- Commit messages: English, concise, `type:` prefix (`feat`, `fix`, `test`, `docs`, `chore`).
- Pre-commit: `npm run lint` must pass; no console.log in production code.

**Security review (per CLAUDE.md):**
- No credentials hardcoded; all secrets via `process.env` from `.env` or Secret Manager.
- OAuth tokens encrypted at-rest (AES-256-GCM, key rotation via `.env.GOOGLE_TASKS_TOKEN_KEY`).
- CORS: open in dev (handled by Vite dev server); restricted to known origins in prod (Cloud Run config).
- RLS enforced at database layer: `identity.tasks` accessible only by service_role (no user-level queries).

## Open Items

**[ASSUMPTION]**: Phase 1 assumes Google Tasks API v1 is stable and backward-compatible through 2026. Verify API deprecation timeline before deploying to production. If API changes, re-assess in Phase 3.

**[ASSUMPTION]**: Cloud Scheduler is available in the same GCP project as Cloud Run (`panelin-calc` service). Verify service account has `iam.serviceAccountTokenCreator` permission before Phase 1 testing. If not, Phase 1 can implement routes, but end-to-end sync testing will fail.

**[ASSUMPTION]**: Token encryption key (`.env.GOOGLE_TASKS_TOKEN_KEY`) is a 32-byte hex string. Operator must provision this; Phase 1 assumes it's present and valid. If missing, all OAuth token storage will fail.

**[DUDA ABIERTA]**: Should conflict resolution UI allow three-way merge (local + remote + base) or only keep-local / keep-remote? Phase 0 decided two-way (keep-local or keep-remote); Phase 1 implements that. If operator requires three-way, Phase 2 scope change.

**[DUDA ABIERTA]**: What is the Cloud Scheduler cron expression for sync pull? Phase 0 decided 15-minute intervals; Phase 1 assumes operator configures this. If different interval desired, Phase 2 adjusts.

## Blockers

**[BLOCKER: DATABASE_URL not provisioned in Cloud Run]**
- **Status**: Open (operator responsibility).
- **Impact**: Phase 1 can write backend routes and tests, but contract tests (`npm run test:api`) will fail if database is unreachable. Frontend development possible offline.
- **Resolution**: Operator must provision `DATABASE_URL` in Cloud Run service environment variables pointing to Supabase PostgreSQL. Verify with `curl https://panelin-calc.run.app/health` after provisioning.
- **Verification**: `echo $DATABASE_URL` in Cloud Run container returns non-empty PostgreSQL URI.

**[BLOCKER: Google Tasks OAuth credentials not provisioned in Secret Manager]**
- **Status**: Open (operator responsibility).
- **Impact**: OAuth endpoints cannot complete token exchange. Phase 1 can implement routes, but end-to-end OAuth testing will fail.
- **Resolution**: Operator must create GCP OAuth 2.0 credentials (client ID + secret) in Google Cloud Console, then provision in Secret Manager (`GOOGLE_TASKS_CLIENT_ID`, `GOOGLE_TASKS_CLIENT_SECRET`) and inject into Cloud Run environment via `./scripts/provision-secrets.sh` or manual configuration.
- **Verification**: `gcloud secrets versions access latest --secret=GOOGLE_TASKS_CLIENT_ID` returns non-empty value.

**[BLOCKER: Cloud Scheduler service account not configured for OIDC token generation]**
- **Status**: Open (operator responsibility).
- **Impact**: Cloud Scheduler cannot authenticate to Cloud Run (sync pull endpoint). Phase 1 implements endpoint, but sync automation will not work.
- **Resolution**: Operator must grant service account `iam.serviceAccountTokenCreator` and `iam.serviceAccountUser` roles; configure Cloud Scheduler job to use OIDC auth with service account token.
- **Verification**: Cloud Scheduler job for `POST /sync/google-tasks/pull` can reach endpoint and receives valid 200 or 503 (not 403/401).

---

**Blockers must be resolved by operator before Phase 1 can be fully tested. Phase 1 implementation can proceed in parallel with blocker resolution, but end-to-end testing is blocked until all three are cleared.**

## Next Steps

1. **Before piping to `/goal`**: Review blockers list and confirm with operator that they will be resolved during Phase 1 implementation window (parallel work is OK; testing is blocked until resolution).
2. **In `/goal` session**: Follow the sequence: document blockers explicitly → invoke /mcp-builder → invoke /theme-factory → invoke /web-artifacts-builder → implement backend routes → wire frontend → add tests → commit + push atomically after each goal.
3. **Exit criteria**: All 6 atomic commits pushed to `feat/tasks-module`, all contract tests passing, PHASE-1-COMPLETE.md filled, blockers documented (or resolved if operator provisioned).
