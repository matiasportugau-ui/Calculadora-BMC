# Tareas (Tasks) Module — Documentation Index

Bidirectional Google Tasks mirror for the Calculadora-BMC hub.

## Status

**Phase 0**: ✅ Complete — scaffolding, schema, route stubs, frontend stubs, docs.
**Phase 1**: ⏸ Blocked on infrastructure (see `PHASE-1-INFRASTRUCTURE.md`).

## Deliverables

### Documentation
- `00-feasibility.md` — GO verdict, cost matrix, risks
- `01-architecture.md` — C4 diagram, schema, OAuth PKCE flow, polling strategy
- `02-mcp-server.md` — Optional MCP server spec (Phase 2+)
- `03-frontend.md` — Component tree, theme tokens, TanStack Query patterns
- `04-roadmap.md` — Phases 0–4, binary exit criteria, time estimates
- `05-decisions.md` — 8 ADRs (encryption, schema, sync, conflicts, etc.)
- `PHASE-0-COMPLETE.md` — Phase 0 verification checklist
- `PHASE-1-INFRASTRUCTURE.md` — Operator blockers + checklist for Phase 1
- `PHASE-1-MASTER-PROMPT.md` — Master prompt for `/goal` execution of Phase 1
- `demo/index.html` — Interactive zero-dependency demo

### SQL Migration
- File: `supabase/migrations/20260602000001_tasks_init.sql`
- Schema: `tasks.*` (6 tables: task_lists, tasks, oauth_tokens, oauth_state, sync_log, sync_conflicts)
- **NOT YET APPLIED** to production — pending operator action

### Backend Routes (mounted in `server/index.js`)
- `server/routes/tasksOAuth.js` — OAuth PKCE flow (mounted at `/auth/tasks/*`)
- `server/routes/tasks.js` — Task CRUD (mounted at `/api/tasks/*`, requires Bearer JWT)
- `server/routes/tasksSync.js` — Cloud Scheduler sync target (mounted at `/sync/*`, HMAC-verified)

### Frontend Components
- `src/components/hub/tasks/TasksModule.jsx` — Module entry (lazy-loadable)
- `src/components/hub/tasks/hooks/useTasks.js` — TanStack Query hooks for task CRUD
- `src/components/hub/tasks/hooks/useTasksSync.js` — Sync polling + conflict resolution

### Identity wiring
- `server/lib/identityAuth.js` — `"tareas"` added to `ALL_MODULES`

## Architecture decisions in force

See `05-decisions.md` for full ADRs. Key decisions:
- **ADR-01**: Tokens encrypted via `pgp_sym_encrypt` (PostgreSQL native)
- **ADR-02**: OAuth PKCE separate from `identity.authGoogle` (isolates Tasks scope)
- **ADR-03**: 60s polling via Cloud Scheduler (no webhook support in Tasks API v1)
- **ADR-04**: Conflicts require manual resolution (7-day TTL, no auto-resolve)
- **ADR-05**: 1 req/min per user rate limit on manual sync triggers
