// ═══════════════════════════════════════════════════════════════════════════
// server/routes/tasks.js — Tareas (Tasks) CRUD operations
// ───────────────────────────────────────────────────────────────────────────
// Routes for reading and mutating task lists and individual tasks.
// All routes require Bearer JWT via requireUser middleware.
//
// Implementation status (2026-05-18):
//   READ endpoints: real implementation against tasks.* schema in Supabase.
//   WRITE endpoints: return 503 because schema requires google_id (NOT NULL),
//     which only the Google Tasks sync can supply. Once OAuth + sync are
//     provisioned (see docs/hub-tasks-module/PHASE-1-INFRASTRUCTURE.md),
//     these can be expanded to optimistically insert HUB rows with a
//     placeholder google_id and queue a Google API push.
//
// Routes:
//   GET    /api/tasks/lists               — list user's task lists
//   POST   /api/tasks/lists               — 503 until sync configured
//   GET    /api/tasks/lists/:id           — get single task list
//   DELETE /api/tasks/lists/:id           — 503 until sync configured
//   GET    /api/tasks/lists/:id/tasks     — list tasks in a list (paginated)
//   POST   /api/tasks/lists/:id/tasks     — 503 until sync configured
//   GET    /api/tasks/lists/:id/tasks/:taskId — get single task
//   PATCH  /api/tasks/lists/:id/tasks/:taskId — 503 until sync configured
//   DELETE /api/tasks/lists/:id/tasks/:taskId — 503 until sync configured
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import { config } from "../config.js";
import { requireUser } from "../lib/identityAuth.js";
import { getTasksPool } from "../lib/tasksDb.js";
import * as googleTasks from "../lib/googleTasksClient.js";
import * as googleCalendar from "../lib/googleCalendarClient.js";

const router = express.Router();

// Columns returned to the client for a task row (single source so POST/PATCH/GET
// stay in lockstep; Phase D added due_time/is_all_day/recurrence_rule/calendar_event_id).
const TASK_RETURN_COLS = `id, list_id, google_id, title, notes, due,
              due_time, is_all_day, recurrence_rule, calendar_event_id,
              status, parent_id, updated_at, created_at, synced_at, is_deleted`;

// All tasks routes require authenticated user (factory must be called)
router.use(requireUser());

const SYNC_NOT_CONFIGURED = {
  ok: false,
  error: "sync_not_configured",
  message:
    "Google Tasks sync is not yet provisioned. Connect a Google account at /auth/tasks/init first. See docs/hub-tasks-module/PHASE-1-INFRASTRUCTURE.md for operator setup.",
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function poolOr503(res) {
  const pool = getTasksPool(config.databaseUrl);
  if (!pool) {
    res.status(503).json({ ok: false, error: "database_unavailable" });
    return null;
  }
  return pool;
}

// ─────────────────────────────────────────────────────────────────────────────
// Task Lists — READ
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/tasks/lists
router.get("/lists", async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  try {
    const { rows } = await pool.query(
      `SELECT id, google_id, title, description, updated_at, created_at, synced_at
       FROM tasks.task_lists
       WHERE user_id = $1
       ORDER BY updated_at DESC NULLS LAST, created_at DESC`,
      [req.user.id],
    );
    res.json({ ok: true, lists: rows });
  } catch (err) {
    console.error("[tasks] GET /lists failed:", err.message);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// GET /api/tasks/lists/:id
router.get("/lists/:id", async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  try {
    const { rows } = await pool.query(
      `SELECT id, google_id, title, description, updated_at, created_at, synced_at
       FROM tasks.task_lists
       WHERE user_id = $1 AND id = $2`,
      [req.user.id, req.params.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "list_not_found" });
    }
    res.json({ ok: true, list: rows[0] });
  } catch (err) {
    console.error("[tasks] GET /lists/:id failed:", err.message);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Tasks — READ
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/tasks/lists/:id/tasks?pageSize=50&afterId=<uuid>
router.get("/lists/:id/tasks", async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;

  const listId = req.params.id;
  const pageSize = Math.min(
    parseInt(req.query.pageSize, 10) || DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const afterId = req.query.afterId || null;

  try {
    // Verify list belongs to user
    const list = await pool.query(
      `SELECT id FROM tasks.task_lists WHERE id = $1 AND user_id = $2`,
      [listId, req.user.id],
    );
    if (list.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "list_not_found" });
    }

    // Keyset pagination by (updated_at, id) DESC
    const params = [req.user.id, listId, pageSize];
    let cursorClause = "";
    if (afterId) {
      params.push(afterId);
      cursorClause = `AND id < $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT ${TASK_RETURN_COLS}
       FROM tasks.tasks
       WHERE user_id = $1 AND list_id = $2 AND is_deleted = FALSE ${cursorClause}
       ORDER BY updated_at DESC NULLS LAST, id DESC
       LIMIT $3`,
      params,
    );

    const nextAfterId = rows.length === pageSize ? rows[rows.length - 1].id : null;
    res.json({ ok: true, tasks: rows, nextAfterId });
  } catch (err) {
    console.error("[tasks] GET /lists/:id/tasks failed:", err.message);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// GET /api/tasks/lists/:id/tasks/:taskId
router.get("/lists/:id/tasks/:taskId", async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  try {
    const { rows } = await pool.query(
      `SELECT ${TASK_RETURN_COLS}
       FROM tasks.tasks
       WHERE user_id = $1 AND list_id = $2 AND id = $3 AND is_deleted = FALSE`,
      [req.user.id, req.params.id, req.params.taskId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "task_not_found" });
    }
    res.json({ ok: true, task: rows[0] });
  } catch (err) {
    console.error("[tasks] GET /lists/:id/tasks/:taskId failed:", err.message);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Task Lists — WRITE (BMC source of truth; pushes through to Google Tasks)
// ─────────────────────────────────────────────────────────────────────────────

function handleGoogleError(err, res) {
  // Local errors (not Google) — discriminate by err.message before falling
  // into the status-based mapping. Surfaces clearer codes the frontend can
  // route on: oauth_required (user has not connected) vs google_token_revoked
  // (was connected, now invalid) vs decrypt_failed (our crypto/config issue).
  if (err?.message === "no_oauth_token") {
    return res.status(401).json({ ok: false, error: "oauth_required" });
  }
  if (err?.message === "decrypt_failed") {
    return res.status(500).json({ ok: false, error: "decrypt_failed" });
  }
  if (err?.status === 504 || err?.message === "google_timeout") {
    return res.status(504).json({ ok: false, error: "google_timeout" });
  }
  if (err?.status === 401) {
    return res.status(401).json({ ok: false, error: "google_token_revoked" });
  }
  if (err?.status === 429) {
    return res.status(429).json({ ok: false, error: "google_rate_limit" });
  }
  if (err?.status === 404) {
    return res.status(404).json({ ok: false, error: "google_resource_not_found" });
  }
  if (err?.status === 403) {
    return res.status(403).json({ ok: false, error: "google_forbidden" });
  }
  console.error("[tasks] google api error:", err?.message, err?.body);
  return res.status(502).json({ ok: false, error: "google_upstream_error" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase D — rich field normalizers + Google Calendar pairing
// ───────────────────────────────────────────────────────────────────────────
// Time-of-day + recurrence are mirrored into a paired Calendar event. BMC is
// system-of-record: these fields live in tasks.tasks regardless of Calendar,
// so a Calendar failure (incl. 403 missing-scope) is NON-FATAL to the write.
// ─────────────────────────────────────────────────────────────────────────────

const RRULE_FREQ_MAP = {
  daily: "RRULE:FREQ=DAILY",
  weekly: "RRULE:FREQ=WEEKLY",
  monthly: "RRULE:FREQ=MONTHLY",
  yearly: "RRULE:FREQ=YEARLY",
};

function maskUserId(id) {
  if (!id || typeof id !== "string") return "***";
  return "***" + id.slice(-4);
}

// null/''/'none'/'does_not_repeat' → null. RRULE:* passes through. Bare freq
// words (daily/weekly/…) map to canonical RRULE. Anything else → null (defensive,
// matches the DB CHECK recurrence_rule LIKE 'RRULE:%').
function normalizeRecurrence(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || /^(none|does_not_repeat)$/i.test(s)) return null;
  if (/^RRULE:/i.test(s)) return s;
  return RRULE_FREQ_MAP[s.toLowerCase()] || null;
}

// Returns 'HH:MM:SS' | null (cleared) | undefined (invalid → caller sends 400).
function normalizeDueTime(raw) {
  if (raw == null || raw === "") return null;
  const m = String(raw).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return undefined;
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  if (h > 23 || mi > 59) return undefined;
  return `${String(h).padStart(2, "0")}:${m[2]}:${m[3] || "00"}`;
}

function classifyCalendarError(err) {
  if (err?.status === 403) return "calendar_scope_missing";
  if (err?.status === 504 || err?.message === "google_timeout") return "calendar_timeout";
  if (err?.message === "no_oauth_token") return "calendar_not_connected";
  return "calendar_unavailable";
}

async function logCalendarFailure(pool, userId, err, meta) {
  // Diagnostic visibility is non-negotiable (the f1d4bb5 lesson): a silent
  // Calendar catch must leave a sync_log breadcrumb with the real error. No
  // token/PII — only status + message + masked user.
  await pool
    .query(
      `INSERT INTO tasks.sync_log (user_id, cycle_id, event_type, details, http_status_code)
       VALUES ($1, gen_random_uuid()::text, 'sync_failed', $2::jsonb, $3)`,
      [
        userId,
        JSON.stringify({
          reason: `calendar_${meta?.stage || "op"}_failed`,
          calendar_error: String(err?.message || err).slice(0, 300),
          user_id_mask: maskUserId(userId),
        }),
        Number.isInteger(err?.status) ? err.status : null,
      ],
    )
    .catch(() => {});
}

// Reconcile the paired Calendar event with the task's effective fields.
// Returns { calendarEventId, calendarError }. A task pairs an event when it has
// a due date AND (a recurrence rule OR a real time-of-day). Otherwise any prior
// event is deleted and the link cleared. NEVER throws — Calendar is a mirror.
async function reconcileCalendarEvent({
  pool, userId, existingEventId = null,
  title, notes, due, dueTime, isAllDay, recurrenceRule,
}) {
  if (!config.googleCalendarEnabled) {
    return { calendarEventId: existingEventId, calendarError: null };
  }
  const needsEvent = !!due && (!!recurrenceRule || (!isAllDay && !!dueTime));
  try {
    if (needsEvent) {
      const { start, end } = googleCalendar.buildEventTimes({ due, dueTime, isAllDay });
      if (existingEventId) {
        await googleCalendar.updateEvent({
          pool, userId, eventId: existingEventId,
          summary: title, description: notes ?? null,
          start, end, recurrence: recurrenceRule ? [recurrenceRule] : [],
        });
        return { calendarEventId: existingEventId, calendarError: null };
      }
      const ev = await googleCalendar.createEvent({
        pool, userId, summary: title, description: notes ?? null,
        start, end, recurrence: recurrenceRule ? [recurrenceRule] : undefined,
      });
      return { calendarEventId: ev?.id || null, calendarError: null };
    }
    // No event needed — remove a prior one (404/410 = already gone).
    if (existingEventId) {
      try {
        await googleCalendar.deleteEvent({ pool, userId, eventId: existingEventId });
      } catch (e) {
        if (e?.status !== 404 && e?.status !== 410) throw e;
      }
    }
    return { calendarEventId: null, calendarError: null };
  } catch (err) {
    const stage = needsEvent ? (existingEventId ? "update" : "create") : "delete";
    await logCalendarFailure(pool, userId, err, { stage });
    // Preserve the link on update/delete failure (so a later sync can repair);
    // a failed create has no id to keep.
    const keepId = stage === "create" ? null : existingEventId;
    return { calendarEventId: keepId, calendarError: classifyCalendarError(err) };
  }
}

// POST /api/tasks/lists { title }
router.post("/lists", async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  const title = (req.body?.title || "").toString().trim().slice(0, 200);
  if (!title) return res.status(400).json({ ok: false, error: "missing_title" });
  let gList;
  try {
    gList = await googleTasks.createList({ pool, userId: req.user.id, title });
  } catch (err) {
    return handleGoogleError(err, res);
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO tasks.task_lists (user_id, google_id, title, synced_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (google_id) DO UPDATE
         SET title = EXCLUDED.title, synced_at = now()
       RETURNING id, google_id, title, description, updated_at, created_at, synced_at`,
      [req.user.id, gList.id, gList.title || title],
    );
    res.status(201).json({ ok: true, list: rows[0] });
  } catch (err) {
    console.error("[tasks] POST /lists persist failed:", err.message);
    res.status(500).json({ ok: false, error: "persist_failed" });
  }
});

// DELETE /api/tasks/lists/:id
router.delete("/lists/:id", async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  const r = await pool.query(
    `SELECT google_id FROM tasks.task_lists WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.id],
  );
  if (!r.rows.length) {
    return res.status(404).json({ ok: false, error: "list_not_found" });
  }
  try {
    await googleTasks.deleteList({
      pool, userId: req.user.id, googleListId: r.rows[0].google_id,
    });
  } catch (err) {
    // 404 from Google means already gone; treat as success
    if (err?.status !== 404) return handleGoogleError(err, res);
  }
  await pool.query(
    `DELETE FROM tasks.task_lists WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.id],
  );
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tasks — WRITE
// ─────────────────────────────────────────────────────────────────────────────

async function loadListWithGoogleId(pool, listId, userId) {
  const r = await pool.query(
    `SELECT google_id FROM tasks.task_lists WHERE id = $1 AND user_id = $2`,
    [listId, userId],
  );
  return r.rows[0] || null;
}

// POST /api/tasks/lists/:id/tasks { title, notes?, due?, due_time?, is_all_day?, recurrence_rule? }
router.post("/lists/:id/tasks", async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  const list = await loadListWithGoogleId(pool, req.params.id, req.user.id);
  if (!list) return res.status(404).json({ ok: false, error: "list_not_found" });

  const title = (req.body?.title || "").toString().trim().slice(0, 1024);
  if (!title) return res.status(400).json({ ok: false, error: "missing_title" });
  const notes = req.body?.notes ? String(req.body.notes).slice(0, 8192) : undefined;
  const due = req.body?.due || undefined;

  // Phase D rich fields. is_all_day defaults TRUE (Google Tasks default). A
  // timed task forces is_all_day=false; an all-day task drops any time.
  const isAllDay = req.body?.is_all_day === undefined ? true : !!req.body.is_all_day;
  let dueTime = normalizeDueTime(req.body?.due_time);
  if (dueTime === undefined) {
    return res.status(400).json({ ok: false, error: "invalid_due_time" });
  }
  if (isAllDay) dueTime = null;
  const effectiveAllDay = isAllDay && dueTime == null;
  const recurrenceRule = normalizeRecurrence(req.body?.recurrence_rule);

  // 1) Google Tasks holds title/notes/due(date) — the canonical task resource.
  let gTask;
  try {
    gTask = await googleTasks.createTask({
      pool, userId: req.user.id, googleListId: list.google_id, title, notes, due,
    });
  } catch (err) {
    return handleGoogleError(err, res);
  }

  // 2) Pair a Calendar event for time/recurrence (non-fatal if it fails).
  const { calendarEventId, calendarError } = await reconcileCalendarEvent({
    pool, userId: req.user.id,
    title: gTask.title || title, notes: gTask.notes ?? notes ?? null,
    due, dueTime, isAllDay: effectiveAllDay, recurrenceRule,
  });

  try {
    const { rows } = await pool.query(
      `INSERT INTO tasks.tasks
         (user_id, list_id, google_id, title, notes, due,
          due_time, is_all_day, recurrence_rule, calendar_event_id, status, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
       RETURNING ${TASK_RETURN_COLS}`,
      [
        req.user.id, req.params.id, gTask.id,
        gTask.title || title, gTask.notes || notes || null,
        gTask.due || (due ? new Date(due) : null),
        dueTime, effectiveAllDay, recurrenceRule, calendarEventId,
        gTask.status || "needsAction",
      ],
    );
    res.status(201).json({ ok: true, task: rows[0], ...(calendarError ? { calendar_error: calendarError } : {}) });
  } catch (err) {
    console.error("[tasks] POST .../tasks persist failed:", err.message);
    res.status(500).json({ ok: false, error: "persist_failed" });
  }
});

// PATCH /api/tasks/lists/:id/tasks/:taskId
router.patch("/lists/:id/tasks/:taskId", async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  const list = await loadListWithGoogleId(pool, req.params.id, req.user.id);
  if (!list) return res.status(404).json({ ok: false, error: "list_not_found" });

  const tr = await pool.query(
    `SELECT google_id, title, notes, due, due_time, is_all_day,
            recurrence_rule, calendar_event_id
       FROM tasks.tasks
      WHERE id = $1 AND user_id = $2 AND list_id = $3 AND is_deleted = FALSE`,
    [req.params.taskId, req.user.id, req.params.id],
  );
  if (!tr.rows.length) {
    return res.status(404).json({ ok: false, error: "task_not_found" });
  }
  const current = tr.rows[0];

  const body = req.body || {};
  const patch = {};
  if (typeof body.title === "string") patch.title = body.title.slice(0, 1024);
  if ("notes" in body) patch.notes = body.notes == null ? null : String(body.notes).slice(0, 8192);
  if ("due" in body) patch.due = body.due;
  if (body.status === "needsAction" || body.status === "completed") {
    patch.status = body.status;
  }

  // Phase D rich-field patch. Presence flags distinguish "absent" (keep current)
  // from explicit clear (null). Providing a time implies the task is no longer
  // all-day; setting all-day clears the time.
  const hasDue = "due" in body;
  const hasDueTime = "due_time" in body;
  const hasAllDay = "is_all_day" in body;
  const hasRecur = "recurrence_rule" in body;

  let newDueTime;
  if (hasDueTime) {
    newDueTime = normalizeDueTime(body.due_time);
    if (newDueTime === undefined) {
      return res.status(400).json({ ok: false, error: "invalid_due_time" });
    }
  }

  let effDueTime = hasDueTime ? newDueTime : current.due_time;
  let effAllDay = hasAllDay ? !!body.is_all_day : current.is_all_day;
  if (hasDueTime && effDueTime != null) effAllDay = false;
  if (effAllDay) effDueTime = null;
  const effRecur = hasRecur ? normalizeRecurrence(body.recurrence_rule) : current.recurrence_rule;
  const effDue = hasDue ? patch.due : current.due;
  const effTitle = "title" in patch ? patch.title : current.title;
  const effNotes = "notes" in patch ? patch.notes : current.notes;

  // 1) Google Tasks update (title/notes/due/status).
  let gTask;
  try {
    gTask = await googleTasks.updateTask({
      pool, userId: req.user.id,
      googleListId: list.google_id, googleTaskId: current.google_id,
      ...patch,
    });
  } catch (err) {
    return handleGoogleError(err, res);
  }

  // 2) Calendar reconciliation — only when a scheduling- or content-relevant
  // field changed. A bare status toggle (☐/☑) must NOT burn a Calendar API call.
  const scheduleChanged = hasDue || hasDueTime || hasAllDay || hasRecur;
  const shouldReconcile = scheduleChanged || "title" in patch || "notes" in patch;
  let calendarEventId = current.calendar_event_id;
  let calendarError = null;
  if (shouldReconcile) {
    const r = await reconcileCalendarEvent({
      pool, userId: req.user.id, existingEventId: current.calendar_event_id,
      title: gTask.title ?? effTitle, notes: gTask.notes ?? effNotes,
      due: effDue, dueTime: effDueTime, isAllDay: effAllDay, recurrenceRule: effRecur,
    });
    calendarEventId = r.calendarEventId;
    calendarError = r.calendarError;
  }

  try {
    // Build SET clause dynamically so explicit `null` in the patch (e.g.
    // clearing notes or due) propagates immediately to BMC instead of being
    // absorbed by COALESCE — which would keep the old value and leave a
    // ~60s desync window until the sync cycle pulled Google's null state.
    const setClauses = ["synced_at = now()", "updated_at = now()"];
    const params = [req.params.taskId, req.user.id];
    if ("title" in patch) {
      params.push(gTask.title ?? patch.title);
      setClauses.push(`title = $${params.length}`);
    }
    if ("notes" in patch) {
      params.push(gTask.notes ?? null);
      setClauses.push(`notes = $${params.length}`);
    }
    if ("due" in patch) {
      params.push(gTask.due ? new Date(gTask.due) : null);
      setClauses.push(`due = $${params.length}`);
    }
    if ("status" in patch) {
      params.push(gTask.status ?? patch.status);
      setClauses.push(`status = $${params.length}`);
    }
    if (scheduleChanged) {
      params.push(effDueTime);
      setClauses.push(`due_time = $${params.length}`);
      params.push(effAllDay);
      setClauses.push(`is_all_day = $${params.length}`);
      params.push(effRecur);
      setClauses.push(`recurrence_rule = $${params.length}`);
    }
    if (shouldReconcile) {
      params.push(calendarEventId);
      setClauses.push(`calendar_event_id = $${params.length}`);
    }

    const { rows } = await pool.query(
      `UPDATE tasks.tasks SET ${setClauses.join(", ")}
       WHERE id = $1 AND user_id = $2
       RETURNING ${TASK_RETURN_COLS}`,
      params,
    );
    res.json({ ok: true, task: rows[0], ...(calendarError ? { calendar_error: calendarError } : {}) });
  } catch (err) {
    console.error("[tasks] PATCH task persist failed:", err.message);
    res.status(500).json({ ok: false, error: "persist_failed" });
  }
});

// DELETE /api/tasks/lists/:id/tasks/:taskId (soft delete in BMC + push to Google)
router.delete("/lists/:id/tasks/:taskId", async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  const list = await loadListWithGoogleId(pool, req.params.id, req.user.id);
  if (!list) return res.status(404).json({ ok: false, error: "list_not_found" });

  const tr = await pool.query(
    `SELECT google_id, calendar_event_id FROM tasks.tasks
      WHERE id = $1 AND user_id = $2 AND list_id = $3 AND is_deleted = FALSE`,
    [req.params.taskId, req.user.id, req.params.id],
  );
  if (!tr.rows.length) {
    return res.status(404).json({ ok: false, error: "task_not_found" });
  }

  try {
    await googleTasks.deleteTask({
      pool, userId: req.user.id,
      googleListId: list.google_id, googleTaskId: tr.rows[0].google_id,
    });
  } catch (err) {
    if (err?.status !== 404) return handleGoogleError(err, res);
  }

  // Best-effort: drop the paired Calendar event too. Non-fatal — the task
  // delete still succeeds (404/410 = already gone; other errors logged).
  const eventId = tr.rows[0].calendar_event_id;
  if (eventId && config.googleCalendarEnabled) {
    try {
      await googleCalendar.deleteEvent({ pool, userId: req.user.id, eventId });
    } catch (err) {
      if (err?.status !== 404 && err?.status !== 410) {
        await logCalendarFailure(pool, req.user.id, err, { stage: "delete" });
      }
    }
  }

  await pool.query(
    `UPDATE tasks.tasks SET is_deleted = TRUE, updated_at = now()
      WHERE id = $1 AND user_id = $2`,
    [req.params.taskId, req.user.id],
  );
  res.json({ ok: true });
});

export default router;
