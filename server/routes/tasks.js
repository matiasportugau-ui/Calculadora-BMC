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

const router = express.Router();

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
      `SELECT id, list_id, google_id, title, notes, due, status,
              parent_id, updated_at, created_at, synced_at, is_deleted
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
      `SELECT id, list_id, google_id, title, notes, due, status,
              parent_id, updated_at, created_at, synced_at, is_deleted
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

// POST /api/tasks/lists/:id/tasks { title, notes?, due? }
router.post("/lists/:id/tasks", async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  const list = await loadListWithGoogleId(pool, req.params.id, req.user.id);
  if (!list) return res.status(404).json({ ok: false, error: "list_not_found" });

  const title = (req.body?.title || "").toString().trim().slice(0, 1024);
  if (!title) return res.status(400).json({ ok: false, error: "missing_title" });
  const notes = req.body?.notes ? String(req.body.notes).slice(0, 8192) : undefined;
  const due = req.body?.due || undefined;

  let gTask;
  try {
    gTask = await googleTasks.createTask({
      pool, userId: req.user.id, googleListId: list.google_id, title, notes, due,
    });
  } catch (err) {
    return handleGoogleError(err, res);
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO tasks.tasks
         (user_id, list_id, google_id, title, notes, due, status, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       RETURNING id, list_id, google_id, title, notes, due, status,
                 parent_id, updated_at, created_at, synced_at, is_deleted`,
      [
        req.user.id, req.params.id, gTask.id,
        gTask.title || title, gTask.notes || notes || null,
        gTask.due || (due ? new Date(due) : null),
        gTask.status || "needsAction",
      ],
    );
    res.status(201).json({ ok: true, task: rows[0] });
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
    `SELECT google_id FROM tasks.tasks
      WHERE id = $1 AND user_id = $2 AND list_id = $3 AND is_deleted = FALSE`,
    [req.params.taskId, req.user.id, req.params.id],
  );
  if (!tr.rows.length) {
    return res.status(404).json({ ok: false, error: "task_not_found" });
  }

  const patch = {};
  if (typeof req.body?.title === "string") patch.title = req.body.title.slice(0, 1024);
  if ("notes" in (req.body || {})) patch.notes = req.body.notes == null ? null : String(req.body.notes).slice(0, 8192);
  if ("due" in (req.body || {})) patch.due = req.body.due;
  if (req.body?.status === "needsAction" || req.body?.status === "completed") {
    patch.status = req.body.status;
  }

  let gTask;
  try {
    gTask = await googleTasks.updateTask({
      pool, userId: req.user.id,
      googleListId: list.google_id, googleTaskId: tr.rows[0].google_id,
      ...patch,
    });
  } catch (err) {
    return handleGoogleError(err, res);
  }

  try {
    const { rows } = await pool.query(
      `UPDATE tasks.tasks SET
         title    = COALESCE($3, title),
         notes    = COALESCE($4, notes),
         due      = $5,
         status   = COALESCE($6, status),
         synced_at = now(),
         updated_at = now()
       WHERE id = $1 AND user_id = $2
       RETURNING id, list_id, google_id, title, notes, due, status,
                 parent_id, updated_at, created_at, synced_at, is_deleted`,
      [
        req.params.taskId, req.user.id,
        gTask.title ?? null,
        "notes" in patch ? (gTask.notes ?? null) : null,
        "due" in patch ? (gTask.due ? new Date(gTask.due) : null) : tr.rows[0].due ?? null,
        gTask.status ?? null,
      ],
    );
    res.json({ ok: true, task: rows[0] });
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
    `SELECT google_id FROM tasks.tasks
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
  await pool.query(
    `UPDATE tasks.tasks SET is_deleted = TRUE, updated_at = now()
      WHERE id = $1 AND user_id = $2`,
    [req.params.taskId, req.user.id],
  );
  res.json({ ok: true });
});

export default router;
