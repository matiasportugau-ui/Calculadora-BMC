# Role
Full-stack research+design+build engineer for the Calculadora BMC user platform. Combines
investigative work (industry best practices on RBAC, team collaboration, activity logging)
with concrete schema design and implementation across `identity.*` schema, the Mi Espacio
user-facing surface, and a new analytics surface.

---

# Context

Repo: `/Users/matias/calculadora-bmc` [CONFIRMED]
Production state at session start (2026-05-21):
- Cloud Run rev `panelin-calc-00400-m7n` [CONFIRMED]
- Vercel `calculadora-o80e6p6a9-matprompts-projects.vercel.app` Ready [CONFIRMED]
- Supabase project `htnwozvopveibwppyjhg` [CONFIRMED]
- 17 tables in `identity.*` schema: users, sessions, modules, role_grants, module_grants,
  access_requests, quotes, quote_events, special_quote_requests, notifications,
  crm_personal_contacts, crm_personal_leads, audit_log, mfa_secrets, message_threads,
  message_thread_members, messages [CONFIRMED]

Existing audit / logging patterns in the codebase (these are the building blocks — do NOT
build a parallel system, extend these):
- `identity.audit_log` table — schema: `audit_id, actor_user_id, actor_kind, action, resource,
  resource_id, ip, user_agent, payload, at`. **Currently only captures admin/auth actions**
  (`auth.login`, `auth.logout`, `auth.refresh`, `auth.token_reuse_detected`, `auth.mfa_required`,
  `admin.role_grant.add`, `admin.module_grant.set`, `user.revoke`). [CONFIRMED]
- `identity.quote_events` table — append-only audit per quote, schema: `event_id, quote_id,
  kind, actor_user_id, payload, at`. [CONFIRMED]
- `server/lib/identityAuth.js` `_audit()` helper — used internally; not exported. [CONFIRMED]
- `server/routes/identityAdmin.js` `audit()` helper — direct INSERT to `audit_log`,
  audit-on-write pattern. [CONFIRMED]
- TraKtiMe `tkAudit(pool, {...})` in `server/routes/traktime.js` — logs to `tk_audit_log`
  (separate table in `public` schema, NOT `identity.*`). [CONFIRMED]
- `tasks.sync_log` in tasks schema — Google Tasks sync events. [CONFIRMED]

**The gap**: none of these capture *business actions* (cotización guardada, plano importado,
WA respuesta aprobada, Tarea creada, etc.) and none feed a *user-facing history view*. There is
NO way for a user to see "what did I do today" or for analytics to ask "what features get
used vs. abandoned".

User instruction (paraphrased to English from the Spanish original):
> "Investigate best practices in team collaboration and user-role permission structures.
> Build a user environment with expert info management: per-user history each user can browse
> + classify + use to find recent edits, plus a main activity logbook updated at every session
> end, capturing a complete log of user activity. Design a special structure for that log so
> it can power data analysis on interactions to drive improvement of tools, workflows, and
> features."

---

# Goal

Design and ship a unified user-activity logbook + per-user history view that powers two
distinct audiences: the user (finding their own recent work) and the product team (analyzing
behavior to drive improvements).

- **Phase 0 — Research** [INFERRED: 2-4 hrs | basis: comparable best-practice surveys]: audit
  the 5 existing audit patterns in the repo + survey industry best practices for activity
  logging (event sourcing, CQRS-lite, OpenTelemetry conventions, RBAC + ABAC hybrids, team
  collaboration UX patterns from Linear/Notion/Cal.com). Produce a written `RESEARCH.md` with
  recommendations + tradeoffs.
- **Phase 1 — Schema design**: new `identity.user_activity_log` table (or extension of
  `audit_log`) capturing the union of admin events, business actions, and frontend navigation
  events. Define an action taxonomy (e.g. `auth.login`, `quote.create`, `quote.send.pdf`,
  `tareas.list.sync`, `wa.message.send`, …). Lock the schema before building writers.
- **Phase 2 — Backend instrumentation**: a `logActivity()` helper in
  `server/lib/userActivityLog.js` callable from every route + worker. Backfill the existing
  admin actions to use it (keep `identity.audit_log` as legacy alias view if needed).
  Frontend telemetry endpoint `POST /api/me/activity` for client-emitted events (debounced,
  rate-limited).
- **Phase 3 — Per-user history view**: new tab in `/mi-espacio` ("Historial") with timeline
  + filters by module/date/outcome, action taxonomy chips, and a search box (find "the
  cotización I edited yesterday" pattern).
- **Phase 4 — Session-end flush**: hook into `BmcAuthProvider` logout + `beforeunload` to flush
  any pending client-side activity buffer + post a `session.end` row with session-level stats
  (duration, modules touched, actions count). Server-side: a job that closes orphan sessions
  on a TTL.
- **Phase 5 — Analytics surface**: `/hub/admin/analytics` page (role=admin) with cohort
  metrics, action funnels, and "most-used / least-used module" cards. Built using the same
  `admin-cotizaciones` design system.

---

# Scope

IN:
- Phase 0 deliverable: `docs/team/activity-log-research.md` with industry survey, repo audit,
  and final recommendation (single `user_activity_log` table vs. extending `audit_log` vs.
  event_id pointer pattern).
- Phase 1: one Supabase migration (`20260522000001_user_activity_log.sql`) creating the chosen
  schema. Applied via Supabase MCP `apply_migration`.
- Phase 2: `server/lib/userActivityLog.js` + 1 endpoint `POST /api/me/activity` + retrofit
  ~6 existing audit call sites to also write to the new table.
- Phase 3: new "Historial" tab in `MySpacePage.jsx` + backend `GET /api/me/activity` (paginated,
  filterable).
- Phase 4: client buffer flush on logout + `beforeunload`; server-side TTL job (cron or
  Cloud Scheduler).
- Phase 5: `/hub/admin/analytics` page + 4-6 `GET /api/admin/analytics/*` endpoints; mirror
  the admin-cotizaciones design system.
- Per-track verification (`npm run gate:local` + manual E2E in browser).

OUT:
- Replacing or deprecating `identity.audit_log` — the new table is additive; the legacy table
  stays for security-audit specifically. Migration includes a view to keep backward-compat.
- Full OpenTelemetry adoption — Phase 0 may discuss it; implementation stays Postgres-native.
- Real-time streaming (SSE/WebSockets) — analytics polls at user-controlled cadence.
- Mobile-app SDK — instrumentation lives in the existing React SPA only.
- GDPR data-deletion automation — Phase 0 should mention it; out-of-scope to implement now.
- AI summarization of activity ("you spent 2 hrs on cotizaciones this week") — defer to a
  follow-up once base data accumulates.
- Replacing TraKtiMe's `tk_audit_log` or `tasks.sync_log` (each has domain-specific shape;
  the new log captures higher-level events, those stay for low-level domain debugging).

---

# Inputs

**Repo paths to read first** (Phase 0 audit):
- `server/lib/identityAuth.js` lines 248-388 (verifyGoogleAndUpsert + _audit) [CONFIRMED]
- `server/routes/identityAdmin.js` lines 39-52 (audit helper) [CONFIRMED]
- `server/routes/traktime.js` (search for `tkAudit`) [CONFIRMED]
- `server/routes/tasksSync.js` (sync_log writes) [CONFIRMED]
- `server/routes/identityMe.js` lines 1-100 (notifications + access requests) [CONFIRMED]
- `src/components/MySpacePage.jsx` (extend with new Historial tab) [CONFIRMED]
- `src/components/admin/users/UserAdminModule.jsx` (pattern to mirror for /hub/admin/analytics)
  [CONFIRMED]
- `src/components/admin-cotizaciones/styles.css` (token system to reuse)

**Existing tables to inventory** (Supabase MCP `list_tables verbose=true schemas=["identity","tasks","public"]`):
- `identity.audit_log` (50+ rows already)
- `identity.quote_events`
- `tasks.sync_log`
- `tk_audit_log` (if exists)
- `identity.users.last_active_at` (per-user activity timestamp — currently bumped on requireUser)

**Industry references to web-search in Phase 0** (executor performs):
- "event sourcing vs audit log Postgres"
- "user activity tracking schema best practices"
- "RBAC vs ABAC tradeoffs SaaS"
- "Linear product analytics activity feed UX"
- "Notion activity history per page schema"
- "Cal.com team activity audit"
- OpenTelemetry resource semantic conventions (`actor.id`, `resource.id`, `event.outcome`, etc.)

---

# Tools & MCPs

- **WebSearch**: industry best-practices survey (Phase 0). Required.
- **Supabase MCP** (`list_tables`, `execute_sql`, `apply_migration`): schema audit + migration.
  Required.
- **Bash**: `gh` for CI dispatch, `gcloud` for Cloud Run status, `git`, `npm run gate:local`,
  `npm run build`.
- **Read / Edit / Write**: code edits across server + src.
- **Playwright MCP**: E2E verify the new Historial tab + admin analytics page render correctly.
- **TaskCreate / TaskUpdate**: track the 5-phase progress.
- **advisor()**: call BEFORE writing the schema migration (irreversible once data accumulates)
  and BEFORE declaring each phase done.
- Tools NOT needed: WebFetch (use WebSearch), Shopify MCP, BigQuery MCP, Gmail MCP, Notion MCP.

---

# Constraints & Guardrails

- **DO** treat the schema design (Phase 1) as a one-way door: get the columns, indexes, and
  partitioning right before any data lands. Call `advisor()` before applying the migration.
- **DO** add row-level security (RLS) policies on the new table: users can SELECT their own
  rows; admin/superadmin can SELECT any.
- **DO** rate-limit `POST /api/me/activity` aggressively (e.g. 600 events / 15 min / user) to
  prevent client-side abuse or runaway loops.
- **DO** validate the `action` field against a server-side enum (action taxonomy in code,
  validated on every write). Adding a new action name requires a code change, not a runtime
  configuration toggle.
- **DO** PII-scrub the `payload` jsonb before insert (no plaintext tokens, no full message
  bodies, no quote totals — log shape/IDs, not contents).
- **DO** index `(actor_user_id, at DESC)` for the per-user history view, and `(action, at)`
  for analytics queries.
- **DO** use `printf '%s'` (never `echo`) when writing any new GCP secret values.
- **DO** call `npm run gate:local` per commit; accept pre-existing `sheetsCsvGuard.test.js`
  failures as baseline (confirm via `git stash` + re-run).
- **DO NOT** log raw email bodies, message contents, or quote payloads. Log IDs + counts +
  timing only.
- **DO NOT** instrument logging of every keystroke or every page render — debounce
  client-emitted events to "intent" granularity (user clicked Save, navigated to a route, opened
  a drawer). Otherwise the table grows orders of magnitude too fast.
- **DO NOT** introduce a separate analytics database (BigQuery, Snowflake, ClickHouse) in this
  iteration. Postgres is sufficient for the first 10M-100M rows; revisit only if `EXPLAIN
  ANALYZE` shows pain.
- **DO NOT** add new CSS frameworks. Reuse `.adminCot` namespace + `--ac-*` tokens for the
  analytics page (admin-cotizaciones pattern).
- **DO NOT** modify `identity.audit_log` schema. Make the new table additive; if legacy
  consumers exist, layer a SQL view over both.
- **DO NOT** push to `main` without confirming with the user per `~/.claude/CLAUDE.md`.

---

# Anti-patterns

- DO NOT replicate the TraKtiMe `tk_audit_log` pattern of using `public` schema — keep the
  new table in `identity.*` for consistency and RLS coupling.
- DO NOT roll a separate `crypto.randomUUID()` for `event_id` — use Postgres
  `extensions.uuid_generate_v4()` like every other table in `identity.*`.
- DO NOT log session start as a duplicate of `auth.login` — pick one canonical action name
  and document the choice. Same for `auth.logout` vs `session.end`.
- DO NOT add the new "Historial" tab anywhere except `/mi-espacio` — it's user-facing,
  belongs in the personal workspace.
- DO NOT skip the Phase 0 research step "because the schema seems obvious." Activity logging
  is a domain with well-known pitfalls (event sourcing vs audit, schema-on-write vs schema-on-read,
  partition strategy). Industry conventions matter.
- DO NOT instrument backend writes via middleware that auto-fires on every Express route —
  that captures noise (health checks, refresh polls) and dilutes the signal. Be explicit:
  call `logActivity()` from the route handler when the business action happens.
- DO NOT confuse the two existing OAuth clients of this project (web-app login
  `642127786762-hbkkonaqp9vvfk2qa9sv5go4bd8u4sj3`, Google Tasks
  `642127786762-p7siclqkr1c7spm24423t4313tqvv8ul`) — only the first one is relevant here.
- DO NOT push to `main` without confirming with the user. Smoke-gate workaround is
  `gh workflow run deploy-calc-api.yml --ref main` (pre-existing Anthropic key issue).

---

# Deliverables

### Phase 0 — Research & recommendation
- `docs/team/activity-log-research.md` (~3-5 pages): industry survey, repo audit, final
  recommendation with rationale. Cites at least 5 external sources.
- Decision logged: single `user_activity_log` table vs. extending `audit_log`. Document the
  why.
- Action taxonomy v1 (enumerated list of `<domain>.<resource>.<verb>` strings, e.g.
  `auth.session.start`, `quote.draft.create`, `wa.message.send`, `tareas.list.sync`).

### Phase 1 — Schema
- `supabase/migrations/20260522000001_user_activity_log.sql` — applied via Supabase MCP
  `apply_migration`. Includes table, indexes, RLS policies, and (if recommended) a SQL view
  over `audit_log` + `user_activity_log` for backward-compat.
- Server-side action taxonomy constants in `server/lib/userActivityLog.js`.
- Commit: `feat(activity-log): schema + helper`

### Phase 2 — Instrumentation
- `server/lib/userActivityLog.js` — `logActivity({ actorId, action, resourceType, resourceId,
  outcome, payload, req })` helper. PII-scrubbing + action enum validation built in.
- `server/routes/identityMe.js` — adds `POST /api/me/activity` (rate-limited 600/15min) and
  `GET /api/me/activity?from=&to=&module=&action=&limit=&cursor=`.
- Retrofit existing audit sites (identityAdmin.js, identityAuth.js _audit calls, traktime.js
  selective) to also call `logActivity()` for business-relevant events.
- Commit: `feat(activity-log): logActivity helper + 6 retrofits + me/activity endpoints`

### Phase 3 — Per-user Historial tab
- `src/components/me/HistorialTab.jsx` — timeline grouped by date, filter chips (module,
  outcome), search box, infinite scroll. Renders `GET /api/me/activity`.
- Update `src/components/MySpacePage.jsx` — add `historial` tab between bandeja and mensajes;
  add KPI tile "Eventos hoy" / "Eventos esta semana".
- Commit: `feat(me): Historial tab + activity timeline in Mi Espacio`

### Phase 4 — Session-end flush
- `src/contexts/BmcAuthProvider.jsx` — buffer client-side events, flush on logout +
  `beforeunload`; emit `session.end` with stats `{ duration_ms, modules, action_count }`.
- `server/routes/identityMe.js` — handle `session.end` action specially (idempotent on
  `session_id`).
- `server/jobs/closeOrphanSessions.js` (or a Cloud Scheduler cron at hourly cadence) — closes
  sessions idle > 24h with a synthetic `session.end` row.
- Commit: `feat(activity-log): session-end flush + orphan close job`

### Phase 5 — Admin analytics
- `server/routes/identityAdmin.js` (or new `identityAnalytics.js`) — endpoints:
  `GET /api/admin/analytics/cohorts`, `/funnel`, `/module-usage`, `/error-rate`,
  `/active-users` (DAU/WAU/MAU).
- `src/components/admin/analytics/AnalyticsModule.jsx` + sub-components mirroring the
  admin-cotizaciones pattern.
- Route in `src/App.jsx`: `/hub/admin/analytics` gated `RequireGrant role="admin"`.
- Nav link in `BmcModuleNav.jsx` (visible to admin).
- Commit: `feat(admin): analytics dashboard at /hub/admin/analytics`

### Closing
- `docs/team/PROJECT-STATE.md` — combined "Cambios recientes" entry.
- `docs/team/HANDOFF-2026-05-22.md` (or current date) — closeout handoff.

---

# Success Criteria

### Phase 0
- `docs/team/activity-log-research.md` exists with: industry survey (≥5 sources), audit of
  the 5 existing patterns in the repo, final recommendation with explicit pros/cons.

### Phase 1
- `mcp__claude_ai_Supabase__list_tables schemas=["identity"]` shows `user_activity_log`
  table with the recommended schema.
- `EXPLAIN ANALYZE SELECT * FROM identity.user_activity_log WHERE actor_user_id=$1 ORDER BY
  at DESC LIMIT 50` returns a Bitmap Index Scan, not Seq Scan, on a row count of ≥1000
  test events.
- RLS policy proven: signed in as user A, `SELECT count(*) FROM identity.user_activity_log
  WHERE actor_user_id != $1` returns 0 rows.

### Phase 2
- `curl -H "Authorization: Bearer <jwt>" -X POST .../api/me/activity -d '{"action":"foo"}'`
  returns 400 (unknown action) — proves enum validation.
- Triggering an admin action (e.g. role grant via `/hub/admin/users` drawer) writes a row
  to BOTH `identity.audit_log` (legacy) AND `identity.user_activity_log` (new).
- Rate limit kicks in at ≥600 POSTs/15min and returns 429.

### Phase 3
- Sign in, open `/mi-espacio` → Historial tab → see at least 1 row (the session start).
- Filter by module → list narrows correctly.
- Search "cotizaci" → finds quote-related events.
- "Eventos hoy" KPI tile counts match a manual `SELECT count(*) FROM
  identity.user_activity_log WHERE actor_user_id=$1 AND at::date=current_date`.

### Phase 4
- Log out via the AuthHeader avatar dropdown → DB has a fresh `session.end` row with
  `payload.duration_ms` set.
- Close the browser tab without logging out → after a delay, the orphan-close job (run
  manually) writes a `session.end` row for the abandoned session.

### Phase 5
- `/hub/admin/analytics` loads as superadmin; sub-route metrics render with non-zero counts
  (Cohorts, Module usage, Funnel, Active users).
- Tested as non-admin → RequireGrant 403 page.
- All endpoints rate-limited; the AnalyticsModule respects abort signals on filter changes.

### Global
- `npm run gate:local` exits 0 per commit (modulo pre-existing sheetsCsvGuard failures).
- `npm run build` exit 0; new code-split chunks: `HistorialTab-*.js`, `AnalyticsModule-*.js`.
- Cloud Run latest revision serves the new endpoints (`/api/me/activity` and
  `/api/admin/analytics/*`) returning 401 without auth (proves route mounted).
- Vercel production deployment Ready.

---

# Operational Anchors

- Source hierarchy: existing repo code (audit_log, _audit helper, identityAdmin pattern) >
  industry research > documentation. Always check what already exists before designing new.
- State labeling: every claim wears `hecho confirmado` | `inferencia` | `duda abierta`.
- Triangulation: when an industry source contradicts repo convention, surface the conflict in
  `activity-log-research.md` and recommend explicitly which to follow and why.
- Read-only by default: `identity.audit_log` is sacred legacy data. Never modify the schema
  or backfill into it. The new table is additive only.
- One-way doors get advisor() calls: BEFORE applying the migration, BEFORE declaring Phase 1
  done, BEFORE pushing the Phase 5 frontend (analytics is high-visibility).
- Atomic commits: one PR-sized commit per phase. Each independently revertable.
- Push gate per `~/.claude/CLAUDE.md`: do NOT push to `main` without explicit user approval
  each time. Cloud Run deploys require `gh workflow run deploy-calc-api.yml --ref main` for
  the moment (Anthropic key still invalid in Secret Manager).

---

# Open Items

- [ASSUMPTION: a single `user_activity_log` table is preferable to extending `audit_log` |
  Phase 0 research must reach a written recommendation before Phase 1]
- [ASSUMPTION: per-event payload jsonb is sufficient — no need for typed columns per event
  kind | revisit if EXPLAIN ANALYZE shows JSONB filter perf issues at >10M rows]
- [ASSUMPTION: client-side debouncing at ~5s + flush on route change is the right
  granularity | tune in Phase 4 once first wave of real data lands]
- [ASSUMPTION: TTL for orphan sessions = 24h | confirm with user before locking in. Could be
  4h (aggressive, matches average work session) or 7d (matches refresh-token rotation
  window)]
- [ASSUMPTION: analytics page is admin-only — no per-user "your stats" surface in v1 |
  user-self-stats is a Phase 6 follow-up]
- [ASSUMPTION: GDPR-style export/delete is out-of-scope for this iteration | Phase 0 must
  mention this in the research doc as a known follow-up]
- [ASSUMPTION: action taxonomy v1 will be 30-50 string constants | exact list is a Phase 1
  deliverable]

---

# Blockers

None — all Phase 0 inputs are read-only audits. The first state-mutating step is the
Phase 1 migration, which is gated by advisor() and user push approval.
