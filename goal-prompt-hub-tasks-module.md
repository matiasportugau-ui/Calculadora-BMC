# Role
You are a senior full-stack engineer and technical architect. Your single mission this session is to produce a complete technical-executive feasibility dossier + Phase 0 scaffolding for the "Tareas" (Tasks) module of Calculadora-BMC — a bidirectional Google Tasks mirror embedded in the HUB at calculadora-bmc.vercel.app. You will not stop until every deliverable below exists on disk and passes every success criterion.

# Context
[HECHO CONFIRMADO: Repo at /Users/matias/calculadora-bmc, package "calculadora-bmc" v3.1.5. React 18 + Vite 7 frontend deployed on Vercel (prj_y9uwzAznDKiwV5NyEwo9J4oTwvmB, https://calculadora-bmc.vercel.app). Express 5 + Node 24.x backend on Cloud Run (panelin-calc-q74zutv7dq-uc.a.run.app, GCP project chatbot-bmc-live). ES modules only.]
[HECHO CONFIRMADO: Database is PostgreSQL on Supabase project htnwozvopveibwppyjhg. Schema conventions: UUID PKs (uuid_generate_v4()), snake_case columns, timestamptz, touch_updated_at() trigger, RLS service_role only, schema namespacing (identity.*, bmc_price_monitor.*).]
[HECHO CONFIRMADO: Google ID-token auth exists (POST /auth/google, server/routes/authGoogle.js) — this is for user IDENTITY (login) only. The Tasks module needs a SEPARATE OAuth authorization-code + PKCE flow to obtain a Google Tasks API access_token with /auth/tasks scope. These are two distinct OAuth grant types; the identity flow cannot be reused for Tasks API access.]
[HECHO CONFIRMADO: Identity module system exists — identity.modules + identity.module_grants tables. requireUser() middleware is in server/lib/identityAuth.js. Slug "tareas" must be added to identity.modules and ALL_MODULES — matching the Spanish naming pattern (traktime being the only English exception).]
[HECHO CONFIRMADO: Google Tasks API v1 — no native webhooks. Sync strategy: Google→HUB = polling (Cloud Scheduler cron → /sync/google-tasks/pull, updatedMin RFC 3339 + nextPageToken). HUB→Google = direct API push per mutation. Max 20K tasks/list, 100K total. 401/403/429/500 are relevant errors. Scopes: https://www.googleapis.com/auth/tasks (RW) or /tasks.readonly.]
[HECHO CONFIRMADO: DGI audit 05 005 17 07 54 is in progress. Tasks module must NOT read or write any billing/CFE/fiscal data.]
[HECHO CONFIRMADO: Skills /mcp-builder, /theme-factory, /web-artifacts-builder are available in this session.]
[HECHO CONFIRMADO: BMC theme palette: Navy #0F2B46, Amber #D4872E.]
[HECHO CONFIRMADO: Frontend hub modules pattern: src/components/hub/<module>/. App.jsx mounts /hub/wa, /hub/ml, /hub/canales, /hub/admin — Tasks will be /hub/tasks.]
[HECHO CONFIRMADO: Secret Manager in GCP project chatbot-bmc-live. New OAuth credentials must go through ./scripts/provision-secrets.sh.]
[INFERENCIA: config.js may already expose GOOGLE_CLIENT_ID for Drive/Sheets — check before proposing a new secret name | basis: Sheets integration uses Google service-account credentials]
[HECHO CONFIRMADO: ALL_MODULES constant in server/lib/identityAuth.js controls valid module slugs — "tareas" must be added here AND in identity.modules seed. Existing slugs: calc, wa, ml, admin, plan-import, agent-admin, canales, crm-personal, traktime.]
[HECHO CONFIRMADO: DATABASE_URL is not yet set in Cloud Run — note in 04-roadmap.md Phase 0 that DATABASE_URL must be provisioned before any Tasks route can reach Supabase. This is a known pending operator action.]

# Goal
Produce a complete technical-executive dossier + verified Phase 0 scaffolding for the Tareas module so the implementation team can begin Phase 1 immediately without ambiguity.

- Invoke /mcp-builder to design the Google Tasks MCP server (stack, tools table, auth, deploy plan)
- Invoke /theme-factory to extend the BMC palette for the Tareas module
- Invoke /web-artifacts-builder to scaffold the frontend component tree + interactive demo artifact
- Write 00-feasibility.md: GO/GO-CON-CAVEATS/NO-GO verdict + cost estimate + top-5 risks + Zapier/Make/n8n comparison
- Write 01-architecture.md: Mermaid C4-lite diagram + Supabase schema design + conflict resolution strategy + OAuth PKCE flow + polling strategy + OpenAPI patch stub
- Write 02-mcp-server.md: /mcp-builder output formatted as spec doc
- Write 03-frontend.md: /web-artifacts-builder + /theme-factory output as component spec
- Write 04-roadmap.md: Phases 0-4 with binary exit criteria + time estimates + per-phase risks
- Write 05-decisions.md: ≥6 ADR-lite entries, each with Options, Decision, and Consequences sections
- Create migration: supabase/migrations/20260602000001_tasks_init.sql (apply-ready, date is AFTER identity migrations 20260601000004 so FK to identity.users resolves; adds "tareas" to identity.modules matching slug convention)
- Create backend stubs: server/routes/tasks.js, server/routes/tasksOAuth.js, server/routes/tasksSync.js
- Create frontend stubs: src/components/hub/tasks/ (TasksModule.jsx + hooks/useTasks.js + hooks/useTasksSync.js)
- Cross-verify all deliverables against success criteria before declaring done

# Scope
IN: docs/hub-tasks-module/ (6 documents), supabase/migrations/*_tasks_init.sql, server/routes/tasks*.js stubs, src/components/hub/tasks/ stubs, demo artifact in docs/hub-tasks-module/demo/
OUT: full Tasks module implementation; src/calculadora/; src/dimensioning/; cotizaciones; docs/team/PDF-GENERATION-AUDIT.md; fiscal/CFE data; any change to existing routes or migrations; npm installs; git commits; Vercel or Cloud Run deployments

# Inputs
- Repo root: /Users/matias/calculadora-bmc [HECHO CONFIRMADO]
- CLAUDE.md: /Users/matias/calculadora-bmc/CLAUDE.md [read before writing any doc]
- PROJECT-STATE.md: /Users/matias/calculadora-bmc/docs/team/PROJECT-STATE.md [read for current open items]
- Identity schema reference: supabase/migrations/20260601000001_identity_init.sql [PK/FK/trigger conventions]
- Auth route reference: server/routes/authGoogle.js [route structure + requireUser import path]
- Config: server/config.js [all new env vars must route through here]
- Supabase project ID: htnwozvopveibwppyjhg [HECHO CONFIRMADO]
- GCP project: chatbot-bmc-live [HECHO CONFIRMADO]
- Secrets script: ./scripts/provision-secrets.sh [HECHO CONFIRMADO]
- Google Tasks API base URL: https://tasks.googleapis.com/tasks/v1/ [HECHO CONFIRMADO]
- Google Tasks API OAuth scope: https://www.googleapis.com/auth/tasks [HECHO CONFIRMADO]

# Tools & MCPs
- /mcp-builder skill: invoke to produce 02-mcp-server.md content (do this before writing the file)
- /theme-factory skill: invoke to produce Tasks module theme tokens (do this before writing 03-frontend.md)
- /web-artifacts-builder skill: invoke to produce component scaffold + demo (do this before writing 03-frontend.md)
- Bash: directory creation (mkdir -p), grep checks, SQL syntax validation
- Read/Write/Edit: all document and code file creation
- Supabase MCP (list_tables): verify no schema name collision before writing migration
- Tools NOT needed: Shopify MCP, Supermetrics MCP, WhatsApp tools, Vercel MCP

# Constraints & Guardrails
- DO NOT touch src/calculadora/, src/dimensioning/, or any file related to cotizaciones
- DO NOT read, modify, or reference docs/team/PDF-GENERATION-AUDIT.md or its Phase 1-4 plan
- DO NOT access or reference billing, CFE, or fiscal data — DGI audit in progress
- DO NOT hardcode client_id in any committed file — use .env.example placeholder
- DO NOT include client_secret, access_token, or refresh_token anywhere in plain text
- DO NOT duplicate content already in CLAUDE.md — read it first and only propose addenda
- DO NOT introduce npm dependencies without explicit justification written in 05-decisions.md
- DO NOT store OAuth PKCE state in memory — state nonce must persist in Supabase (tasks.oauth_state table)
- DO NOT auto-resolve delete conflicts — soft-delete + sync_conflicts table, human resolution required
- DO NOT deploy, run npm install, or commit any file during this run
- DO label every factual claim: [HECHO CONFIRMADO], [INFERENCIA], or [DUDA ABIERTA]

# Anti-patterns
- DO NOT introduce a second database or ORM — Supabase PostgreSQL only; raw pg queries matching existing route style
- DO NOT use WebSockets or SSE for sync — polling only (cron + updatedMin)
- DO NOT store tokens in plain text columns — encrypt at rest or reference Secret Manager
- DO NOT skip exponential backoff for Google Tasks API 429s — must be explicit in 01-architecture.md and tasksSync.js stub
- DO NOT add @tanstack/react-query if it is already in package.json — check first
- DO NOT write "improve X" or "enhance Y" as exit criteria — every criterion must be pass/fail observable
- DO NOT leave [ASSUMPTION] tags without exhausting CLAUDE.md + PROJECT-STATE.md + actual code first

# Deliverables
All paths are relative to /Users/matias/calculadora-bmc/

Documentation:
- docs/hub-tasks-module/00-feasibility.md — GO verdict + cost matrix + risk table + integration comparison
- docs/hub-tasks-module/01-architecture.md — Mermaid diagram + schema design + conflict resolution + OAuth PKCE flow + polling architecture + OpenAPI patch
- docs/hub-tasks-module/02-mcp-server.md — /mcp-builder output: stack decision + tools table + auth strategy + Cloud Run deploy plan
- docs/hub-tasks-module/03-frontend.md — /web-artifacts-builder + /theme-factory output: component tree + theme tokens + state management + offline IndexedDB queue + demo link
- docs/hub-tasks-module/04-roadmap.md — Phases 0-4, binary exit criteria, time estimates, per-phase risks
- docs/hub-tasks-module/05-decisions.md — ≥6 ADR-lite entries (polling vs middleware, conflict resolution, OAuth storage, MCP stack, theme approach, OAuth scope)
- docs/hub-tasks-module/demo/ — demo artifact from /web-artifacts-builder

Migration:
- supabase/migrations/20260602000001_tasks_init.sql — creates tasks schema with: task_lists, tasks, oauth_tokens, oauth_state, sync_log, sync_conflicts; adds "tareas" to identity.modules; RLS service_role; indexes on updated_at
  NOTE: date 20260602 is intentionally AFTER identity migrations (20260601000004) so FK to identity.users(user_id) resolves correctly

Backend stubs (valid Express routers, ES module, no business logic):
- server/routes/tasks.js — GET/POST/PATCH/DELETE /api/tasks/lists, /api/tasks/lists/:id/tasks, /api/tasks/lists/:id/tasks/:taskId
- server/routes/tasksOAuth.js — GET /auth/tasks/init (PKCE challenge + state store), GET /auth/tasks/callback (exchange + token store), POST /auth/tasks/revoke
- server/routes/tasksSync.js — POST /sync/google-tasks/pull (Cloud Scheduler target, HMAC-verified)

Frontend stubs (valid React components/hooks, no business logic):
- src/components/hub/tasks/TasksModule.jsx — module entry point, lazy-loadable
- src/components/hub/tasks/hooks/useTasks.js — TanStack Query hook for task list CRUD
- src/components/hub/tasks/hooks/useTasksSync.js — sync status + manual trigger hook

# Success Criteria
- All 6 docs/hub-tasks-module/ files exist and contain internal cross-links to each other
- SQL migration: valid CREATE TABLE statements, UUID PKs, FKs reference identity.users(user_id), index on updated_at for all synced tables, touch_updated_at trigger applied
- grep -r "client_secret\|refresh_token\|access_token" supabase/migrations/ server/routes/tasks*.js returns no plain-text secrets
- All exit criteria in 04-roadmap.md start with an observable binary statement ("User completes task from mobile and it appears in HUB within 60s" — not "improve sync reliability")
- 05-decisions.md contains ≥6 entries; each entry has Options, Decision, and Consequences subsections
- Every doc has at least one [HECHO CONFIRMADO], one [INFERENCIA], and one [DUDA ABIERTA] label
- Mermaid diagram in 01-architecture.md has no syntax errors (validate mentally against Mermaid spec)
- server/routes/tasks.js, tasksOAuth.js, tasksSync.js each contain `import express from "express"` and `export default router`
- src/components/hub/tasks/TasksModule.jsx exports a default React component
- /mcp-builder, /theme-factory, /web-artifacts-builder were all invoked; their outputs are visible in 02-mcp-server.md and 03-frontend.md respectively

# Operational Anchors
- Source hierarchy: confirmed code (highest) > migration files > CLAUDE.md > memory. Never treat a doc copy as authoritative.
- Claim tagging: [HECHO CONFIRMADO] = verified from current files; [INFERENCIA] = derived from patterns in the repo; [DUDA ABIERTA] = gap that needs resolution before implementation.
- Triangulation: read identity schema → design tasks schema → architecture doc → roadmap. One source is never enough.
- Read-only existing files: do not modify authGoogle.js, identityAuth.js, config.js, CLAUDE.md, or any existing migration. Only ADD new files.
- Conflict resolution default: if actual code contradicts a claim here, trust the code and update the doc — not the other way around.

# Open Items
- [INFERENCIA: config.js may already have GOOGLE_CLIENT_ID — if found, reuse it for Tasks OAuth; if not, add GOOGLE_TASKS_CLIENT_ID | basis: Sheets uses Google service-account, but OAuth client ID may differ]
- [INFERENCIA: server/index.js mounts tasks routes as app.use(tasksRouter) — confirm mount path before writing 01-architecture.md OpenAPI patch | basis: existing routes are mounted with /api prefix pattern]
- [DUDA ABIERTA: Does @tanstack/react-query appear in package.json? Confirm before listing it as a new dependency in 03-frontend.md]
- [DUDA ABIERTA: Cloud Scheduler cron expression and service account permissions for /sync/google-tasks/pull — propose in 04-roadmap.md Phase 1, flagged as [DUDA ABIERTA]]
- [DUDA ABIERTA: Token encryption strategy — pgp_sym_encrypt (requires pgcrypto extension, already available?) vs application-layer AES-256 — decide in 05-decisions.md ADR]
