# HANDOFF — Tareas Phase D (Rich Task Fields: time / all-day / repeat)

**Date:** 2026-06-05 · **Branch:** `main` · **Author:** Claude (Opus 4.8)

## Status

- ✅ **All code written + gate green** (`npm run gate:local`: lint 0 errors / 10 warnings = baseline, all tests `0 failed`).
- ✅ **Migration applied LIVE** to Supabase `htnwozvopveibwppyjhg` (4 columns + `calendar_drift` CHECK verified present).
- ⛔ **Git commits/push/deploy BLOCKED** — the harness permission mode declined every `git` write (`add`/`restore`/`commit`). Nothing is committed yet. Work is durable on disk only.
- ⛔ **Live E2E verification BLOCKED: operador** — needs GCP Console action + per-user re-consent (see Operator blockers).

## ⚠️ First, clean up one accidental change

While capturing the gate baseline I redirected output into a **pre-existing tracked** file `.gate_baseline.log`, clobbering it (it is unrelated to Phase D). Revert it before committing:

```bash
git restore .gate_baseline.log
```

Do **not** include `.gate_baseline.log` in any Phase D commit.

## Atomic commits to make (in order)

Run `npm run gate:local` before each push. For backend-touching commits, deploy with
`gh workflow run deploy-calc-api.yml --ref main` (watch: `gh run list --workflow="Deploy Calculator API to Cloud Run" --limit 2`). Recommendation: push commits 2–4 then trigger **one** deploy (not three) to avoid redundant Cloud Run builds.

| # | Message | Files |
|---|---------|-------|
| 1 | `feat(tasks-module): add Phase D schema columns for time, all-day, repeat, calendar event link` | `supabase/migrations/20260605000001_tasks_phase_d_richfields.sql` (migration already applied to prod DB) |
| 2 | `feat(tasks-module): expand OAuth scope to include google.calendar.events` | `server/routes/tasksOAuth.js`, `docs/hub-tasks-module/OPERATOR-CHECKLIST.md` |
| 3 | `feat(tasks-module): add googleCalendarClient.js outbound helper` | `server/lib/googleCalendarClient.js`, `server/config.js` |
| 4 | `feat(tasks-module): wire CRUD routes + sync to Calendar for time/repeat` | `server/routes/tasks.js`, `server/routes/tasksSync.js` |
| 5 | `feat(tasks-module): TaskCreateModal matching Google Tasks UI` | `src/components/hub/tasks/TaskCreateModal.jsx`, `src/components/hub/tasks/TasksModule.jsx`, `src/components/hub/tasks/hooks/useTasks.js` |
| 6 | `docs(project-state): Tareas Phase D rich fields landed` | `docs/team/PROJECT-STATE.md`, this handoff |

> Note: commit 2 references OPERATOR-CHECKLIST and commit 6 references PROJECT-STATE — both docs are already edited. If you prefer strict per-commit doc grouping, stage the checklist with #2 and PROJECT-STATE with #6 as listed.

## What changed (design)

- BMC stays **system-of-record**: `due_time`/`is_all_day`/`recurrence_rule` live in `tasks.tasks`. Google Calendar is a **mirror** for the time/repeat dimensions (Tasks REST API can't store them).
- A task pairs a Calendar event only when it has a due date **and** (a recurrence rule **or** a real time-of-day). Calendar failure (incl. **403 missing-scope**) is **non-fatal**: the task saves with `calendar_event_id = NULL` + a soft `calendar_error` flag. 403 deliberately does **not** enter the 401-refresh path.
- Sync (`tasksSync.js`) does read-only **drift detection** → `calendar_drift` conflict (de-duped per task, BMC wins, no auto-resolver), and reports `calendar_events_touched` in `sync_completed`.
- `GET /auth/tasks/scope-probe` is a pure DB read of the stored `scope` column → drives the UI "Reconectar" CTA. No new Express path prefix (lives under existing `/auth/*` + `/api/*` rewrites; CSP already allows `www.googleapis.com`).

## Operator blockers (do in GCP Console — see OPERATOR-CHECKLIST.md §Phase D Supplement)

1. `gcloud services enable calendar-json.googleapis.com --project=chatbot-bmc-live`
2. Add scope `https://www.googleapis.com/auth/calendar.events` to the OAuth consent screen.
3. Existing connected users must **re-consent** (Tareas UI shows the CTA when `scope-probe` returns `hasCalendar:false`). Until then Calendar calls 403 and tasks save without an event.

## Live verification (after operator + re-consent)

```bash
# Consent URL includes both scopes:
curl -s -H "Authorization: Bearer $JWT" https://<host>/auth/tasks/init | grep -o 'scope=[^&]*'
# Probe flips to hasCalendar:true after re-consent:
curl -s -H "Authorization: Bearer $JWT" https://<host>/auth/tasks/scope-probe
# Create a task with time=10:00 → expect a Calendar event + tasks.tasks.calendar_event_id populated,
# and within 60s a sync_log 'sync_completed' with details.calendar_events_touched > 0.
```

## Resume prompt

> Continue Tareas Phase D: `git restore .gate_baseline.log`, then make the 6 atomic commits in `docs/team/HANDOFF-TAREAS-PHASE-D.md` (gate:local before each push; one Cloud Run deploy after commits 2–4). Then ping the operator to enable the Calendar API + add the calendar.events scope per OPERATOR-CHECKLIST §Phase D.
