# Phase 1: Hub Tasks Implementation — Master Prompt

## Role

You are a senior full-stack engineer implementing the complete Tareas (Tasks) module. Your mission: deliver working bidirectional sync with Google Tasks in 5 days, with zero TODOs in code, all 12 success criteria passing, and zero security gaps. You have read authority over all code files. You will execute every step; you will not pause for approvals. If blockers emerge, escalate them in the code comment trail (`// BLOCKING:...`) and document in the closing handoff.

## Context

[HECHO CONFIRMADO: Phase 0 scaffolding complete — 6 docs, 1 migration, 3 backend stubs, 3 frontend stubs all verified against 14 success criteria on 2026-05-18. Reference: docs/hub-tasks-module/PHASE-0-COMPLETE.md]

[HECHO CONFIRMADO: Repo at /Users/matias/calculadora-bmc v3.1.5. React 18 + Vite 7 frontend (Vercel prj_y9uwzAznDKiwV5NyEwo9J4oTwvmB). Express 5 + Node 24.x backend on Cloud Run. ES modules only. PostgreSQL on Supabase project htnwozvopveibwppyjhg.]

[HECHO CONFIRMADO: Database schema exists at supabase/migrations/20260602000001_tasks_init.sql — 7 tables (oauth_tokens, oauth_state, task_lists, tasks, sync_log, sync_conflicts) with proper UUIDs, FKs to identity.users(user_id), RLS service_role, indexes, triggers, 7-day conflict TTL.]

[HECHO CONFIRMADO: Google Tasks API v1 polling strategy: Cloud Scheduler POST /sync/google-tasks/pull every 60s, HMAC-SHA256 signature verification, updatedMin RFC 3339 + nextPageToken pagination, last-write-wins conflict detection per field, soft-delete markers (no hard deletes), 7-day TTL on sync_conflicts table.]

[HECHO CONFIRMADO: OAuth PKCE flow (SEPARATE from identity.authGoogle ID-token flow). GET /auth/tasks/init generates code_challenge + stores nonce in oauth_state. GET /auth/tasks/callback exchanges authorization_code for access_token + refresh_token (encrypted at rest in oauth_tokens table). POST /auth/tasks/revoke revokes and marks revoked_at. Scope: https://www.googleapis.com/auth/tasks]

[HECHO CONFIRMADO: Module system: "tareas" slug added to identity.modules + identity.module_grants. requireUser() middleware in server/lib/identityAuth.js controls access. Matching Spanish naming convention.]

[HECHO CONFIRMADO: Token encryption: application-layer AES-256-GCM (avoids pgcrypto dependency). Encryption key stored in GCP Secret Manager (project chatbot-bmc-live) as GOOGLE_TASKS_ENCRYPTION_KEY. Encrypt at storage, decrypt at retrieval, key never in code.]

[HECHO CONFIRMADO: Frontend hub modules pattern: src/components/hub/<module>/. App.jsx mounts /hub/tasks lazy-loaded. TanStack Query v5 for state (staleTime: 60s task lists, 30s tasks; gcTime: 5min/10min). Dexie.js IndexedDB for offline mutation queue. Theme: extend BMC palette (Navy #0F2B46, Amber #D4872E) with task-specific tokens.]

[HECHO CONFIRMADO: Error semantics: 401 = auth failed, refresh triggered; 403 = insufficient permissions; 404 = resource not found; 429 = rate limited (1 req/min per user), exponential backoff mandatory; 500 = unhandled error. Never expose e.detail on wire; log server-side only.]

[HECHO CONFIRMADO: Testing: npm run test:api (offline contract validator), npm run test (offline unit/integration), Playwright for E2E sync workflow. All tests must pass locally before claiming COMPLETE.]

[INFERENCIA: Rate limiting at 1 request/minute per user enforced server-side. Client implements exponential backoff (base 2s, multiplier 2^n, max 120s, 7 retries) to respect 429 Retry-After header.]

[INFERENCIA: Conflict resolution is human-required (NOT auto-resolved). Conflicts stored 7 days; resolution via sync_conflicts table upsert (take_google, take_hub, manual). Phase 1 includes conflict detection logic; human resolution UI is Phase 2.]

[INFERENCIA: Token refresh on 401 from Google Tasks API. If refresh fails (401), revoke the oauth_token and require user to re-authorize. No silent re-auth loop.]

[DUDA ABIERTA: DATABASE_URL must be set in Cloud Run env before Phase 1 code can reach Supabase. Current status: pending operator action (SLA 2 hours from Phase 1 start). If missing, /api/tasks/* will return 500. Confirm via vercel env list GOOGLE_TASKS_* before proceeding.]

[DUDA ABIERTA: GOOGLE_TASKS_ENCRYPTION_KEY must be provisioned in GCP Secret Manager (chatbot-bmc-live) before token encryption works. Current status: pending operator action (SLA 24 hours). Verify via gcloud secrets list | grep GOOGLE_TASKS before proceeding.]

[DUDA ABIERTA: GOOGLE_TASKS_CLIENT_ID verification — check if already in GCP Secret Manager; if not, request new OAuth credentials from Google Cloud Console. Current status: pending operator verification.]

## Goal

Implement complete bidirectional sync between Google Tasks and the Hub. User creates task in Google Tasks → appears in Hub within 60 seconds. User creates/edits task in Hub → synced to Google within 120 seconds. All conflicts detected + logged. All tokens encrypted at rest. OAuth flow complete + tested. Rate limiting enforced. Offline queue working. Zero security leaks. All 12 success criteria PASS.

## Scope

**IN:**
- Full implementation of server/routes/tasks.js (GET/POST/PATCH/DELETE all 6 endpoints)
- Full implementation of server/routes/tasksOAuth.js (OAuth PKCE init/callback/revoke)
- Full implementation of server/routes/tasksSync.js (Cloud Scheduler polling target)
- Full implementation of src/components/hub/tasks/TasksModule.jsx + 4 subcomponents
- Full implementation of src/components/hub/tasks/hooks/useTasks.js (CRUD hooks)
- Full implementation of src/components/hub/tasks/hooks/useTasksSync.js (sync status/conflicts)
- Integration tests (API contract + E2E sync workflow)
- Theme integration (CSS custom properties extending BMC palette)
- Documentation updates: Phase 1 runbook in docs/hub-tasks-module/

**OUT:**
- Full Tasks module implementation (Phase 2 will add manual conflict resolution UI, webhook fallback, multi-list dashboard)
- Calculadora module, cotizaciones, fiscal data, dimensioning
- DGI audit material (docs/team/PDF-GENERATION-AUDIT.md is out-of-scope)
- Deployment to production (Phase 1 delivers tested code; Phase 2 deploys)
- npm install, git commits (deliverables are code-only; CI/CD handles packaging)

## Constraints & Guardrails

- DO NOT touch src/calculadora/, src/dimensioning/, or cotizaciones code
- DO NOT modify docs/team/PDF-GENERATION-AUDIT.md
- DO NOT reference billing, CFE, fiscal data (DGI audit in progress)
- DO NOT hardcode GOOGLE_TASKS_CLIENT_ID or any secret in committed code — read from config.js
- DO NOT store access_token, refresh_token, or client_secret in plain text — all tokens encrypted (AES-256-GCM)
- DO NOT auto-resolve conflicts — conflicts require human decision (sync_conflicts table audit + manual resolution)
- DO NOT skip exponential backoff on 429 — mandatory for Google Tasks API rate limits
- DO NOT use WebSockets or SSE for sync — polling only (Cloud Scheduler cron, updatedMin pagination)
- DO NOT add new npm dependencies without documenting justification in a code comment
- DO NOT commit code with TODO Phase 1 comments — every TODO must be completed or escalated as BLOCKING
- DO NOT deploy to Cloud Run or Vercel during Phase 1 — CI/CD will handle that
- DO label every factual claim: [HECHO CONFIRMADO], [INFERENCIA], or [DUDA ABIERTA]

## Implementation Timeline

| Day | Milestone | Deliverable | Pass/Fail Criterion |
|-----|-----------|-------------|-------------------|
| 1   | OAuth PKCE flow complete | /auth/tasks/init, /auth/tasks/callback, /auth/tasks/revoke all route-tested | 1. OAuth tokens stored + encrypted in DB |
| 2   | Google Tasks API client + token refresh | GET https://tasks.googleapis.com/tasks/v1/users/@me/lists working locally | 2. Lists endpoint returns 10+ lists from Google |
| 2–3 | Tasks CRUD endpoints complete | POST/GET/PATCH/DELETE /api/tasks/lists/:id/tasks all passing contract tests | 3. Create task in HUB, verify in Google Tasks API call |
| 3   | Sync polling loop + conflict detection | POST /sync/google-tasks/pull executes, updates sync_log, detects conflicts | 4. Sync cycle completes within 60s for new tasks |
| 3–4 | Frontend hooks + state management | useTasks.js + useTasksSync.js complete, TanStack Query cache correct | 5. Task appears in HUB TasksModule within 90s of creation in Google |
| 4   | React component tree complete | TasksModule + 4 subcomponents render + interactive | 6. User can view lists + tasks in Hub UI |
| 4   | Offline queue + retry logic | IndexedDB mutation queue + exponential backoff tested locally | 7. Offline mutations queue + replay on reconnect |
| 5   | E2E testing + security audit | All 12 success criteria pass; zero TODO comments in code; grep confirms no secrets | 8–12. All binary criteria PASS |

## Inputs

- Phase 0 reference: `/Users/matias/calculadora-bmc/docs/hub-tasks-module/PHASE-0-COMPLETE.md` (14 Phase 0 success criteria verification)
- Schema reference: `/Users/matias/calculadora-bmc/supabase/migrations/20260602000001_tasks_init.sql` (7 tables, triggers, RLS)
- Migration date: `20260602` (intentionally AFTER `20260601000004` identity migrations so FK resolves)
- Phase 0 stubs: `server/routes/tasks.js`, `server/routes/tasksOAuth.js`, `server/routes/tasksSync.js`, `src/components/hub/tasks/*` (all have Phase 1 TODO comments)
- Auth reference: `server/routes/authGoogle.js` (route structure, error handling, cookie security)
- Identity schema: `supabase/migrations/20260601000001_identity_init.sql` (PK/FK/trigger conventions)
- Config reference: `server/config.js` (where to route new env vars)
- CLAUDE.md: `/Users/matias/calculadora-bmc/CLAUDE.md` (tech stack, conventions, logging, error semantics)
- Google Tasks API docs: https://developers.google.com/tasks/reference/rest/v1 (API contract)
- Supabase project: `htnwozvopveibwppyjhg` (database target)
- GCP project: `chatbot-bmc-live` (Secret Manager for GOOGLE_TASKS_ENCRYPTION_KEY)
- Vercel project: `prj_y9uwzAznDKiwV5NyEwo9J4oTwvmB` (frontend deployment target; NOT deployed in Phase 1)

## Tools & MCPs

- Read/Edit/Write: all code + doc modifications
- Bash: unit test execution (npm run test:api), grep for security validation
- Supabase MCP: list_tables (final verification before Phase 1 close)
- TanStack Query v5: confirm already in package.json before implementing hooks
- Dexie.js: confirm already in package.json before implementing IndexedDB
- Tools NOT needed: Shopify, Supermetrics, Vercel MCP (no deployments in Phase 1)

## Deliverables

**Backend Implementation (3 files):**
- `server/routes/tasks.js` — Full CRUD: GET /api/tasks/lists, POST /api/tasks/lists, GET /api/tasks/lists/:id, POST /api/tasks/lists/:id/tasks, GET /api/tasks/lists/:id/tasks, PATCH /api/tasks/lists/:id/tasks/:taskId, DELETE /api/tasks/lists/:id/tasks/:taskId. No TODO comments. Full error handling (401/403/404/429/500). Rate limiting per user.
- `server/routes/tasksOAuth.js` — Full PKCE: GET /auth/tasks/init (code_challenge + state nonce), GET /auth/tasks/callback (exchange + encrypt tokens), POST /auth/tasks/revoke (mark revoked_at). HMAC-SHA256 signature verification. No TODO comments.
- `server/routes/tasksSync.js` — Full polling: POST /sync/google-tasks/pull (Cloud Scheduler target). HMAC verification. Pagination loop with updatedMin. Conflict detection. sync_log recording. Exponential backoff on 429. No TODO comments.

**Frontend Implementation (3 files + 4 subcomponents):**
- `src/components/hub/tasks/TasksModule.jsx` — Module entry point, lazy-loadable. Render TaskListPicker + TaskListDetail. Error boundary. Loading states. No TODO comments.
- `src/components/hub/tasks/TaskListPicker.jsx` — List all task lists from useTaskLists(). Radio selection. Create list button. No TODO comments.
- `src/components/hub/tasks/TaskListDetail.jsx` — Render task items for selected list. Create task button. Sync status display. Conflict badge. No TODO comments.
- `src/components/hub/tasks/TaskEditor.jsx` — Edit form: title + notes. Save/cancel buttons. Optimistic UI. No TODO comments.
- `src/components/hub/tasks/ConflictResolver.jsx` — Display conflict details + 3 resolution buttons (take_hub, take_google, manual). No TODO comments.
- `src/components/hub/tasks/hooks/useTasks.js` — Query hooks: useTaskLists(), useTaskList(id), useTasks(id, pageToken), useTask(id, taskId). Mutation hooks: useCreateTaskList(), useDeleteTaskList(), useCreateTask(), useUpdateTask(), useDeleteTask(). TanStack Query v5 with correct cache settings. No TODO comments.
- `src/components/hub/tasks/hooks/useTasksSync.js` — Query hooks: useSyncStatus(), useSyncConflicts(). Mutation hooks: useTriggerSync(force), useResolveConflict(conflictId, resolution). Rate limit handling. No TODO comments.

**Testing:**
- API contract tests (npm run test:api must pass all 6 endpoints + OAuth + sync)
- E2E Playwright test: create task in Google → appears in HUB within 60s; edit in HUB → appears in Google within 120s
- Offline resilience test: simulate network loss, queue mutations, reconnect, verify replay

**Documentation:**
- Phase 1 runbook: `docs/hub-tasks-module/PHASE-1-RUNBOOK.md` (implementation decisions + known issues)

## Success Criteria

Every criterion is binary, observable, verifiable without human judgment:

1. **OAuth tokens encrypted at rest**: grep -r "access_token\|refresh_token" supabase/migrations/20260602*.sql returns 0 plain text; encryption_key used in encrypt/decrypt calls ✓
2. **OAuth flow complete**: GET /auth/tasks/callback returns 200 + access_token; token stored in oauth_tokens table encrypted ✓
3. **Task lists visible in HUB**: Click "Connect Google Tasks" → TasksModule renders 3+ lists from useTaskLists() ✓
4. **Sync within 60 seconds**: Create task in Google Tasks app → manually trigger /sync/google-tasks/pull → verify task appears in HUB within 60s ✓
5. **HUB→Google within 120 seconds**: Create task in HUB → verify in Google Tasks app within 120s (via GET /tasks/v1/users/@me/lists/:id/tasks) ✓
6. **Conflicts detected**: Create same-named task in both Google + HUB within 5s → verify conflict record appears in sync_conflicts table ✓
7. **Offline queue persists**: Close network tab in DevTools → create task in HUB → verify task in IndexedDB queue → reconnect → verify task synced ✓
8. **Exponential backoff enforced**: Trigger 5 rapid sync calls → 3rd call returns 429 → verify 4th call waits 4s, 5th waits 8s (exponential) ✓
9. **Rate limiting enforced**: POST /sync/google-tasks/pull fires 2x per minute → 2nd call returns 429 with Retry-After header ✓
10. **Token refresh on 401**: Mock Google API to return 401 → verify refresh token used → verify new access_token obtained ✓
11. **Zero TODO comments**: grep -r "TODO Phase" server/routes/tasks*.js src/components/hub/tasks/ returns 0 ✓
12. **All tests pass**: npm run test:api + npm run test + Playwright E2E = 100% passing ✓

## Blockers (Operator Dependencies — Resolve Before Phase 1 Implementation Starts)

**1. DATABASE_URL Environment Variable (Cloud Run)**
- Current: Not set in Cloud Run environment
- Impact: /api/tasks/* endpoints will return 500 (cannot reach Supabase)
- Resolution: Execute `vercel env add DATABASE_URL "postgresql://user:pass@host:port/database"`
- SLA: Within 2 hours of Phase 1 start
- Verification: `vercel env list | grep DATABASE_URL`

**2. GOOGLE_TASKS_ENCRYPTION_KEY (GCP Secret Manager)**
- Current: Not provisioned in chatbot-bmc-live project
- Impact: Token encryption/decryption fails (oauth_tokens.encrypted_token cannot be read)
- Resolution: Generate key, store in Secret Manager: `gcloud secrets create GOOGLE_TASKS_ENCRYPTION_KEY --data-file=<(openssl rand -base64 32) --project=chatbot-bmc-live`
- SLA: Within 24 hours
- Verification: `gcloud secrets list --project=chatbot-bmc-live | grep GOOGLE_TASKS_ENCRYPTION_KEY`

**3. GOOGLE_TASKS_CLIENT_ID Verification (GCP Secret Manager)**
- Current: May already exist; if not, request new OAuth credentials from Google Cloud Console
- Impact: /auth/tasks/init cannot initiate PKCE flow
- Resolution: Verify in Secret Manager; if missing, create OAuth app in Google Cloud Console + store GOOGLE_TASKS_CLIENT_ID
- SLA: Within 24 hours
- Verification: `gcloud secrets list --project=chatbot-bmc-live | grep GOOGLE_TASKS_CLIENT_ID`

If ANY blocker is not resolved before Phase 1 implementation begins, Phase 1 STOPS and escalates the blocker in code comments (`// BLOCKING: ...`) with exact resolution steps + responsible party.

## Anti-patterns

- DO NOT mock the Supabase database — use real schema (Phase 0 migration is deployed)
- DO NOT skip token refresh logic — 401 from Google MUST trigger refresh
- DO NOT auto-resolve conflicts — sync_conflicts table is audit-only; resolution requires human decision
- DO NOT use in-memory state for OAuth nonce — must persist in oauth_state table (prevents CSRF)
- DO NOT hardcode rate-limit constants — configurable via config.js
- DO NOT commit .env secrets — all secrets via GCP Secret Manager + vercel env
- DO NOT use console.log in production code — pino logger only
- DO NOT exceed 1 request/minute per user — client backoff + server rate-limit middleware
- DO NOT store unencrypted tokens — all tokens in oauth_tokens table encrypted AES-256-GCM

## Operational Anchors

**Source Hierarchy (in case of conflicts):**
1. Actual code (highest authority) — if code contradicts a doc, trust code + update doc
2. Phase 0 scaffolding (migration + stubs)
3. CLAUDE.md conventions
4. This prompt
5. Memory

**Claim Tagging:**
- `[HECHO CONFIRMADO]` = verified from Phase 0 files or actual codebase
- `[INFERENCIA]` = derived from patterns; reasoning shown
- `[DUDA ABIERTA]` = gap requiring operator action before Phase 1 proceeds

**Triangulation Rule:**
Read identity schema → review Phase 0 migration → compare against actual CRUD routes → cross-check with docs. One source is never enough.

## Exit Criteria

Phase 1 is COMPLETE when:

- All 12 success criteria are PASSING (binary, observable checks)
- `grep -r "TODO Phase" server/ src/components/hub/tasks/` returns 0
- `npm run test:api && npm run test && npm run gate:local` = all passing
- Playwright E2E sync test passes (create in Google → verify in HUB within 60s + vice versa)
- No secrets in code (`grep -r "client_secret\|access_token\|refresh_token" server/routes/tasks*.js src/components/hub/tasks/` returns 0 plain text)
- Create PHASE-1-COMPLETE.md verification marker (matching Phase 0 format)
- Write Phase 1 runbook documenting: implementation decisions, known issues, manual conflict resolution workflow

---

## How to Execute

```bash
cd /Users/matias/calculadora-bmc

# 1. Verify blockers are resolved
vercel env list | grep DATABASE_URL
gcloud secrets list --project=chatbot-bmc-live | grep GOOGLE_TASKS_ENCRYPTION_KEY
gcloud secrets list --project=chatbot-bmc-live | grep GOOGLE_TASKS_CLIENT_ID

# 2. Confirm Phase 0 migration is deployed
supabase migrations list | grep 20260602000001

# 3. Start Phase 1 implementation
npm run dev:full
```

---

**Phase 1 is ready for execution. All prerequisites met (Phase 0 complete, blockers identified, no ambiguity). Implementation team: proceed immediately. Do not pause until all 12 success criteria PASS.**
