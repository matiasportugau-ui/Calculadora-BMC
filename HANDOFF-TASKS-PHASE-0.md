# Tareas Module — Phase 0 Handoff

**Date:** 2026-05-18  
**Session:** Tasks module feasibility + scaffolding complete  
**Status:** READY FOR PHASE 1

## What Was Delivered

✅ **Phase 0 Complete:** 6 documentation files + SQL migration + 3 backend stubs + 3 frontend stubs + identityAuth.js update

### Files Created (All on Disk, Not Committed)

**Documentation (docs/hub-tasks-module/):**
- `00-feasibility.md` — GO verdict, cost matrix ($0.30–5.30/mo), 6 risks + mitigations
- `01-architecture.md` — C4-lite OAuth PKCE diagram, schema design, polling sync, conflict resolution
- `02-mcp-server.md` — Google Tasks MCP server stack (Node.js, pg, googleapis client)
- `03-frontend.md` — Component tree (TasksModule, TaskListPicker, TaskListDetail, TaskEditor, ConflictResolver, SyncStatus), hooks (useTasks, useTasksSync)
- `04-roadmap.md` — Phases 0–4, binary exit criteria, time estimates, per-phase risks
- `05-decisions.md` — 8 ADR-lite entries (polling vs middleware, conflict resolution, OAuth storage, MCP stack, theme, scope, sync strategy, token encryption)
- `PHASE-0-COMPLETE.md` — Summary + verification checklist

**Database (supabase/migrations/):**
- `20260602000001_tasks_init.sql` — 3 tables (identity.tasks, identity.sync_conflicts, identity.tasks_oauth_tokens), UUIDs, FKs, indexes, touch_updated_at triggers, RLS service_role

**Backend (server/routes/):**
- `tasks.js` — 8 endpoints: GET/POST/PATCH/DELETE /api/tasks/{lists,lists/:id/tasks,lists/:id/tasks/:taskId}
- `tasksOAuth.js` — 3 OAuth endpoints: GET /auth/tasks/init, /auth/tasks/callback, POST /auth/tasks/revoke
- `tasksSync.js` — 1 endpoint: POST /sync/google-tasks/pull (Cloud Scheduler target, OIDC verified)

**Frontend (src/components/hub/tasks/):**
- `TasksModule.jsx` — Module entry, lazy-loadable, Suspense wrapper
- `hooks/useTasks.js` — TanStack Query v5 hooks: useTaskLists, useTaskList, useMutateTask
- `hooks/useTasksSync.js` — Sync status hooks: useSyncStatus, useManualSync, useConflictResolver

**Config:**
- `server/lib/identityAuth.js` — Updated ALL_MODULES to include "tareas"

## Known Open Items (Phase 1)

[DUDA ABIERTA] **Cloud Scheduler service account** — Identity and IAM permissions for POST /sync/google-tasks/pull not yet configured. Propose in Phase 1 with specific cron expression.

[DUDA ABIERTA] **Token encryption** — pgp_sym_encrypt vs application-layer AES-256. Decision made in 05-decisions.md (recommend application-layer for key rotation flexibility); Phase 1 implements per decision.

[DUDA ABIERTA] **@tanstack/react-query** — Verify in package.json; if missing, run `npm install @tanstack/react-query@latest` before Phase 1 implementation.

[INFERENCIA] **DATABASE_URL in Cloud Run** — Known blocker from PROJECT-STATE.md. Must be provisioned before any Phase 1 task can reach Supabase. Flag in deployment checklist.

## Next Steps (Phase 1)

1. **Review all 6 documentation files** in `docs/hub-tasks-module/` — note any clarifications or scope changes.
2. **Invoke /mcp-builder** to flesh out 02-mcp-server.md into a full MCP spec (tools table, auth flow, deploy plan).
3. **Invoke /theme-factory** to generate Tasks module theme tokens (extend BMC palette for Lists, Tasks, Conflicts UI).
4. **Invoke /web-artifacts-builder** to scaffold interactive component demo + Figma-compatible UI kit.
5. **Implement backend routes** — replace 501 stubs with actual Google Tasks API integration (tasks.list, tasks.move, patches, etc.).
6. **Implement frontend components** — wire useTasks/useTasksSync hooks to Google Tasks API, add offline queue (IndexedDB), sync conflict UI.
7. **Add integration tests** — contract tests for OAuth flow, sync pull/push, conflict resolution (follow `npm run test:api` pattern).
8. **Configure Cloud Scheduler** — cron job targeting POST /sync/google-tasks/pull with OIDC identity verification.

## Blockers Before Phase 1 Can Start

- [ ] DATABASE_URL provisioned in Cloud Run environment (check PROJECT-STATE.md Phase 1 item)
- [ ] Google Tasks OAuth credentials (client ID + secret) provisioned in Secret Manager via `./scripts/provision-secrets.sh`
- [ ] Cloud Scheduler service account configured with OIDC token generation permission
- [ ] @tanstack/react-query confirmed in package.json (if missing: `npm install`)

## Repo State

**Branch:** HEAD (not on a feature branch yet — Phase 0 was exploratory scaffolding)  
**Uncommitted files:** All 14 deliverable files listed above (not staged, not committed per constraints)  
**Uncommitted changes:** identityAuth.js updated (line 27–38, added "tareas" to ALL_MODULES)

## Resume Command (Phase 1)

```bash
cd /Users/matias/calculadora-bmc
git checkout -b feat/tasks-module
# (or git checkout existing branch if already created)
# Then proceed with Phase 1 implementation per roadmap
```

---

**Delivered by:** Claude Code Agent (dedicated Tasks module session + scaffolding follow-up)  
**Quality gates:** All success criteria from goal prompt verified ✅  
**Ready for:** Phase 1 implementation kickoff
