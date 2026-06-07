# Role
Full-stack engineer executing four sequential workstreams for the Calculadora BMC user platform —
admin user management, Tareas navigation surfacing, TraKtiMe user picker, and Mi Espacio polish.

---

# Context

Repo: `/Users/matias/calculadora-bmc` [CONFIRMED]
Frontend: `https://calculadora-bmc.vercel.app` (Vite SPA, project `matprompts-projects/calculadora-bmc`) [CONFIRMED]
Backend: Cloud Run `panelin-calc` revision `00396-q88` in GCP project `chatbot-bmc-live`, region `us-central1` [CONFIRMED]
Supabase: project `htnwozvopveibwppyjhg` — 14 tables in `identity.*` + 6 tables in `tasks.*`, 9 modules seeded [CONFIRMED]
Vercel deployment `calculadora-9l52lr1se` Ready (production) [CONFIRMED]

The auth foundation is live: any Google user signs in, gets `comprador` role + default `calc:write`
and `tareas:read` grants automatically. Superadmin bypasses module checks per
`src/components/auth/RequireGrant.jsx:88`. The 4 tracks here build the user-facing platform around
that foundation.

Source plan with full sequencing, file lists, and architecture: `/Users/matias/.claude/plans/eager-roaming-dawn.md` [CONFIRMED]

---

# Goal

Ship four tracks that complete the user platform: surface Tareas in navigation, build a superadmin
user management UI (zero-SQL role + grant assignment), replace the TraKtiMe UUID-paste with an
autocomplete user picker, and polish Mi Espacio with a Mensajes tab + KPI strip.

- Track C — Add Tareas to `BmcModuleNav` + `BmcWolfboardHub` (gated on `tareas:read` grant); lights up already-deployed `/auth/tasks/init` OAuth flow.
- Track A — New backend `server/routes/identityAdmin.js` with 8 endpoints + new frontend page `/hub/admin/users` mirroring the `admin-cotizaciones` pattern (SkinProvider, Topbar, StatStrip, Toolbar, UsersTable, UserDetailDrawer, CommandPalette).
- Track D — Swap UUID-paste input in `src/components/traktime/Projects/ProjectsPanel.jsx:256-284` for `<UserCombobox>` that consumes Track A's `GET /api/admin/users?search=` endpoint; modify TraKtiMe member endpoint to JOIN `identity.users` so emails render instead of UUIDs.
- Track B — Add `identity.message_threads`, `identity.message_thread_members`, `identity.messages` migration + 5 endpoints on `server/routes/identityMe.js`; rewrite `MySpacePage.jsx` with KPI strip + 6 tabs (Cotizaciones, Bandeja, Mensajes, Tareas, Solicitudes, Preferencias).
- Dependency order: **C → A → D → B**. Track D consumes Track A; Track B can run parallel to A/D but defer for highest impact ordering.

---

# Scope

IN:
- Track C navigation entries (BmcModuleNav, BmcWolfboardHub)
- Track A backend (`identityAdmin.js`, mount in `server/index.js`, route in `src/App.jsx`)
- Track A frontend (`src/components/admin/users/UserAdminModule.jsx` + sub-components + scoped CSS + `useUserAdmin.js` hook)
- Track D combobox swap + 1-line SQL JOIN in `/api/traktime/projects/:id/members`
- Track B migration + Mensajes endpoints + MySpacePage rewrite
- Atomic commits per track with prefix `feat(...)` or `feat(admin):` etc.
- Manual deploy to Cloud Run + Vercel; the smoke gate may block auto-deploy, use `gh workflow run deploy-calc-api.yml --ref main` as needed

OUT:
- Tailwind / shadcn / Radix / Material-UI / any new CSS framework
- Real-time messages (SSE / WebSocket) — polling-based fetches are sufficient v1
- Bulk user invitations / CSV import
- Quote claiming flow rework (`/api/me/quotes/claim` already works)
- TraKtiMe sprint-3 invoicing changes
- New Supabase schemas outside `identity.*`
- Anthropic API key rotation (separate prod issue)
- MFA enrollment UX (already works via existing endpoints; surface in PrefsTab is fine)
- Skin switcher UI for users (admin-cotizaciones has it via ⌘K palette; new admin should too but no top-level toggle)

---

# Inputs

**Reference architecture (read before building)**:
- `src/components/admin-cotizaciones/` — the production pattern to mirror [CONFIRMED]
- `src/components/admin-cotizaciones/styles.css` — 5-skin token system (macOS, BMC, GNOME, Anthropic, Linear)
- `src/components/admin-cotizaciones/Topbar.jsx`, `StatStrip.jsx`, `Toolbar.jsx`, `DetailDrawer.jsx`, `CommandPalette.jsx`, `QuotesTable.jsx`, `QuoteCard.jsx` — sub-component archetype
- `src/hooks/useAdminCotizaciones.js` — state hook pattern (list, filters, mutations, AbortController-based fetch)
- `src/contexts/SkinProvider.jsx` — theming context [CONFIRMED]
- `src/components/help/` — `HelpProvider`, `Tooltip`, `HelpButton`, `Callout` [CONFIRMED]

**Backend helpers to reuse**:
- `server/lib/identityAuth.js` — `requireUser({ role, module, minLevel })`, `_audit()`, `_pool`, `_resolveTopRole`, `ROLE_RANK`, MODULE_LEVELS [CONFIRMED]
- `server/middleware/requireGrant.js` — ergonomic wrappers [CONFIRMED]

**Track C files to modify**:
- `src/components/BmcModuleNav.jsx` lines 48-62 (static array of 5 nav entries) [CONFIRMED]
- `src/components/BmcWolfboardHub.jsx` lines 80-166 (9 module cards) [CONFIRMED]

**Track D files**:
- `src/components/traktime/Projects/ProjectsPanel.jsx` lines 256-284 (Add Member form) [CONFIRMED]
- `server/routes/traktime.js` lines 302-369 (members endpoints) [CONFIRMED]

**Track B current state**:
- `src/components/MySpacePage.jsx` (359 LOC, 4 tabs: cotizaciones, bandeja, solicitudes, preferencias) [CONFIRMED]
- `server/routes/identityMe.js` (existing `/api/me/*` endpoints — quotes, notifications, access-requests, special-quote-requests) [CONFIRMED]

**Supabase**:
- Schema: `identity.users`, `identity.role_grants`, `identity.module_grants`, `identity.modules`, `identity.sessions`, `identity.audit_log`, `identity.notifications` [CONFIRMED]
- Modules seeded: admin, agent-admin, calc, canales, crm-personal, ml, plan-import, tareas, wa [CONFIRMED]

**Module level ordering** (in `src/hooks/useBmcAuth.js`): `none < read < write < admin` [CONFIRMED]
**Role ordering** (in `RequireGrant.jsx:76`): `superadmin(4) > admin(3) > operator(2) > comprador(1)` [CONFIRMED]

---

# Tools & MCPs

- **Bash**: npm scripts (`gate:local`, `build`), `git` operations, `gcloud` for Cloud Run inspection, `gh` for workflow_dispatch
- **Edit / Write / Read**: file mutations and reads
- **Supabase MCP** (`mcp__claude_ai_Supabase__apply_migration`, `execute_sql`, `list_tables`): apply Track B's `identity_messages` migration and verify schema
- **Vercel CLI**: `vercel ls`, `vercel env ls/pull` for env verification
- **Playwright MCP** (`mcp__playwright__browser_navigate`, `browser_console_messages`, `browser_snapshot`): post-deploy smoke of `/`, `/hub`, `/hub/tareas`, `/hub/admin/users`, `/mi-espacio`
- **TaskCreate/TaskUpdate**: track 4-track progress
- **advisor()**: call before declaring each track done, before push of large diffs
- Tools NOT needed: WebSearch, Shopify MCP, BigQuery MCP, Notion MCP, Gmail MCP, Supermetrics MCP, computer-use, HubSpot MCP

---

# Constraints & Guardrails

- **DO** mirror `src/components/admin-cotizaciones/` architecture for Track A: SkinProvider wrapper, `data-skin` attr, `--ua-*` CSS token prefix, namespace `.userAdmin`, scoped `styles.css`, sub-component archetype (Topbar/StatStrip/Toolbar/Drawer/CommandPalette/Table+Card responsive).
- **DO** wrap admin frontend routes with `<RequireGrant role="admin">` (or `role="superadmin"` for the most destructive actions) — see `src/App.jsx` for pattern.
- **DO** call `_audit()` for every write in `identityAdmin.js` — actions like `admin.role_grant.add`, `admin.role_grant.remove`, `admin.module_grant.set`, `admin.user.suspend`, `admin.user.revoke_sessions`.
- **DO** rate-limit each admin endpoint (mirror `_authGoogleLimiter` pattern in `authGoogle.js`).
- **DO** use keyset pagination on `GET /api/admin/users` — `(created_at DESC, user_id DESC)`.
- **DO** use Supabase MCP `apply_migration` for Track B schema; never `execute_sql` for DDL.
- **DO** run `npm run gate:local` before each commit; if pre-existing `sheetsCsvGuard.test.js` failures appear (tab/CR prefix), confirm via `git stash` they pre-date your changes.
- **DO** use `printf '%s'` not `echo -n` for any secret value (CLAUDE.md gotcha).
- **DO NOT** introduce Tailwind, shadcn, Radix, Material-UI, Chakra, Ant Design, or any new CSS framework — the repo uses inline styles + scoped CSS modules. Token system from `admin-cotizaciones/styles.css` IS the design system.
- **DO NOT** demote a `superadmin` from an `admin` actor — guard server-side in `identityAdmin.js`.
- **DO NOT** allow users to modify themselves via admin endpoints — block when `req.user.user_id === target_user_id`.
- **DO NOT** add cross-schema FKs from `tk_project_members.user_id` to `identity.users.user_id` — TraKtiMe intentionally decoupled.
- **DO NOT** rebuild MySpacePage from scratch — refactor and extend (the 4 existing tabs work).
- **DO NOT** push to `main` without confirming with the user. CI smoke gate may fail due to pre-existing `ANTHROPIC_API_KEY` invalid issue; manually trigger Cloud Run via `gh workflow run deploy-calc-api.yml --ref main` after the user approves push.
- **DO NOT** skip `npm run gate:local` to save time.

---

# Anti-patterns

- DO NOT use `echo -n` for secret values — use `printf '%s'` to avoid trailing-newline `===` breakage.
- DO NOT rebuild auth components — `BmcAuthProvider`, `AuthGateModal`, `authGoogle.js`, `identityAuth.js` are production-grade.
- DO NOT confuse the three OAuth client IDs in this project: web-app login (`642127786762-hbkkonaqp9vvfk2qa9sv5go4bd8u4sj3`), Google Tasks sync (`642127786762-p7siclqkr1c7spm24423t4313tqvv8ul`), older test client (`642127786762-6rkar09l6902jog9dvnal6e6m3a44p76`).
- DO NOT touch `/auth/tasks/*` or `/auth/ml/*` routes — they're working.
- DO NOT use `gcloud secrets create` if the secret exists — use `gcloud secrets versions add`.
- DO NOT add a `/auth/*` rewrite to `vercel.json` — `/api/auth/*` is already proxied by `/api/:path*`.
- DO NOT run `npm audit fix --force` — has broken Vite in this repo before.
- DO NOT modify the `main.jsx` ErrorBoundary copy as part of this work — separate concern.
- DO NOT create new schemas outside `identity.*` for the Mensajes tables — keep all user-scoped social data under identity ownership.
- DO NOT introduce a separate React Query Provider — `src/App.jsx` already has one as of commit `e702c73`.
- DO NOT treat `panelin-api-642127786762` as a live service — it's a zombie; the real backend is `panelin-calc`.

---

# Deliverables

### Track C — Tareas Nav Surfacing
- `src/components/BmcModuleNav.jsx` — add 6th entry for `/hub/tareas`, conditional on `useModuleGrants().has("tareas", "read") || role === "superadmin"`
- `src/components/BmcWolfboardHub.jsx` — add Tareas module card (10th card) using existing card pattern + `lucide-react` ListTodo icon
- Atomic commit: `feat(nav): surface Tareas module in nav + hub`

### Track A — Admin User Management
- NEW: `server/routes/identityAdmin.js` (~200 LOC, 8 endpoints, audit-logged, rate-limited)
- NEW: `src/components/admin/users/UserAdminModule.jsx` (entry component)
- NEW: `src/components/admin/users/{Topbar,StatStrip,Toolbar,UsersTable,UserCard,UserDetailDrawer,CommandPalette,UserCombobox}.jsx`
- NEW: `src/components/admin/users/styles.css` (5-skin tokens, `.userAdmin` namespace, copy structure from `admin-cotizaciones/styles.css`)
- NEW: `src/hooks/useUserAdmin.js` (mirror `useAdminCotizaciones.js` pattern)
- MODIFY: `server/index.js` — mount `identityAdminRouter`
- MODIFY: `src/App.jsx` — lazy import `UserAdminModule`, add route `/hub/admin/users` with `<RequireGrant role="admin">`
- MODIFY: `src/components/BmcModuleNav.jsx` — add "Usuarios" entry for admin role
- Atomic commit: `feat(admin): user management page + 8-endpoint backend`

### Track D — TraKtiMe User Picker
- MODIFY: `src/components/traktime/Projects/ProjectsPanel.jsx` lines 256-284 — replace UUID input with `<UserCombobox>` from Track A
- MODIFY: `server/routes/traktime.js` `GET /projects/:id/members` — LEFT JOIN `identity.users` on `user_id` to return `email` and `name`
- MODIFY: Member list display in `ProjectsPanel.jsx` line 241 — render `email (name)` instead of `<code>{uuid}</code>`
- Atomic commit: `feat(traktime): autocomplete user picker for project members`

### Track B — Mi Espacio + Mensajes
- NEW: `supabase/migrations/20260521000001_identity_messages.sql` (3 tables: `message_threads`, `message_thread_members`, `messages`)
- MODIFY: `server/routes/identityMe.js` — add 5 endpoints: `GET /api/me/threads`, `GET /api/me/threads/:id/messages`, `POST /api/me/threads`, `POST /api/me/threads/:id/messages`, `PATCH /api/me/threads/:id/read`
- REWRITE: `src/components/MySpacePage.jsx` — KPI strip + 6 tabs (extend from 4); modularize per-tab into subcomponents
- NEW: `src/components/me/{ThreadList,ThreadView,TareasSummary,KpiStrip}.jsx`
- Atomic commit: `feat(me): Mensajes + Tareas summary + KPI strip on Mi Espacio`

### Per-track verification + cleanup
- Update `docs/team/PROJECT-STATE.md` "Cambios recientes" after each track lands.
- Manual E2E browser smoke after each Vercel + Cloud Run deploy.

---

# Success Criteria

### Track C (after deploy)
- `curl -i https://calculadora-bmc.vercel.app/hub` returns 200; rendered HTML or accessibility snapshot shows "Tareas" navigation entry [CONFIRMED via Playwright snapshot]
- Anonymous visitor at `/hub`: no Tareas entry visible
- Signed-in comprador at `/hub`: Tareas entry visible; click → `/hub/tareas` → EmptyConnectCTA renders
- Click "🔗 Conectar Google Tasks" → fetches `/auth/tasks/init` → receives `{ url: "https://accounts.google.com/..." }` → redirects to Google consent

### Track A
- `curl -H "Authorization: Bearer <admin_jwt>" .../api/admin/users` returns paginated user list
- Sign in as superadmin, navigate `/hub/admin/users` → table renders with KPI strip + filter bar
- Click row → drawer opens with roles + module grants + recent audit log
- Toggle operator role on a test user → row updates → `identity.audit_log` has `admin.role_grant.add` row
- Try as non-admin → `RequireGrant` shows 403 UI
- Browser console: zero errors (only the expected 2x 401 from auth bootstrap)

### Track D
- Sign in as admin, navigate `/hub/traktime/projects` → expand a project → "Miembros" accordion
- Type "matias" in combobox → see suggestions populated from `/api/admin/users?search=matias`
- Select a result → POST hits `/api/traktime/projects/:id/members` → member appears in list **displayed by email, not UUID**
- Remove member: click X → DELETE hits → member removed

### Track B
- `mcp__claude_ai_Supabase__list_tables` shows new `message_threads`, `message_thread_members`, `messages` tables in `identity` schema
- Navigate `/mi-espacio` → KPI strip renders 4 counters
- Mensajes tab: create new thread between user A and user B → user B sees thread with unread badge
- Tareas tab: shows "N listas, M tareas pendientes" + link to `/hub/tareas`

### Global
- `npm run gate:local` exit 0 per commit (ignore pre-existing sheetsCsvGuard failures, verify via git stash)
- `npm run build` exit 0; new code-split chunks appear: `UserAdminModule-*.js`, etc.
- Cloud Run service describe shows latest revision serving traffic, `Ready: True`
- Vercel `ls` shows latest production deployment `Ready` state

---

# Operational Anchors

- Source hierarchy: repo code (identityAuth.js, App.jsx routing, admin-cotizaciones pattern) > migration SQL > docs.
- State labeling: every claim wears `hecho confirmado` | `inferencia` | `duda abierta`.
- Triangulation: cross-check planilla / repo / docs when in doubt; trust live system state over docs.
- Read-only by default: parámetros, logs, automation tabs, master prices, fiscal data, OAuth-related files.
- Atomic commits: each track = one PR-sized commit; small enough to revert independently.
- Push gate: per `~/.claude/CLAUDE.md` — do NOT push without explicit user approval each time, even mid-task.
- Cloud Run deploy gate: smoke check fails on Anthropic key; use `gh workflow run deploy-calc-api.yml --ref main` after each push that needs backend deployed.

---

# Open Items

- [ASSUMPTION: BmcModuleNav.jsx static array pattern accepts grant-conditional entries cleanly | verify by reading lines 48-62 before editing]
- [ASSUMPTION: BmcWolfboardHub.jsx card grid uses inline objects (not driven from identity.modules) | verified by Explore agent — confirmed static]
- [ASSUMPTION: `admin-cotizaciones/styles.css` 5-skin tokens can be copy-paste-renamed with `--ua-*` prefix without breaking | verify by reading styles.css before forking]
- [ASSUMPTION: `identity.notifications` table can host an unread badge query efficiently (no index on read_at) | verify with EXPLAIN before adding badge to header]
- [ASSUMPTION: TraKtiMe `/api/traktime/projects/:id/members` LEFT JOIN to `identity.users` is performant (cross-schema joins in Postgres are fine but indexes need validation)]
- [ASSUMPTION: Pre-existing `sheetsCsvGuard.test.js` failures (tab/CR prefix) remain unrelated to your work | confirm by `git stash` + re-running per commit]
- [ASSUMPTION: User has authority to deploy each track to production; push approval is per-track via AskUserQuestion]
