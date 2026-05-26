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
import { withTasksClient, mapDbTaskToGoogle, classifyGoogleError } from "../lib/tasksClient.js";

const router = express.Router();

// All tasks routes require authenticated user
router.use(requireUser);

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
// Task Lists — WRITE
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/tasks/lists — create a new task list
router.post("/lists", async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  const { title } = req.body || {};
  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ ok: false, error: "title_required" });
  }
  try {
    const result = await withTasksClient(
      pool, req.user.id, config.tasksEncryptionKey, config,
      (client) => client.tasklists.insert({ requestBody: { title: title.trim() } }),
    );
    const gList = result.data;
    const { rows } = await pool.query(
      `INSERT INTO tasks.task_lists (user_id, google_id, title, synced_at)
       VALUES ($1, $2, $3, now())
       RETURNING id, google_id, title, updated_at, created_at, synced_at`,
      [req.user.id, gList.id, gList.title],
    );
    res.json({ ok: true, list: rows[0] });
  } catch (err) {
    const c = classifyGoogleError(err);
    if (c.type === "auth") return res.status(401).json({ ok: false, error: "token_expired" });
    req.log.error({ err: err?.message }, "POST /lists failed");
    res.status(c.status).json({ ok: false, error: c.type });
  }
});

// DELETE /api/tasks/lists/:id
router.delete("/lists/:id", async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  try {
    const { rows } = await pool.query(
      `SELECT google_id FROM tasks.task_lists WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "list_not_found" });
    await withTasksClient(
      pool, req.user.id, config.tasksEncryptionKey, config,
      (client) => client.tasklists.delete({ tasklist: rows[0].google_id }),
    );
    await pool.query(`DELETE FROM tasks.task_lists WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    const c = classifyGoogleError(err);
    if (c.type === "auth") return res.status(401).json({ ok: false, error: "token_expired" });
    req.log.error({ err: err?.message }, "DELETE /lists/:id failed");
    res.status(c.status).json({ ok: false, error: c.type });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Tasks — WRITE
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/tasks/lists/:id/tasks — create a task
router.post("/lists/:id/tasks", async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  const { title, notes, due, status } = req.body || {};
  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ ok: false, error: "title_required" });
  }
  try {
    const listRow = await pool.query(
      `SELECT google_id FROM tasks.task_lists WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );
    if (listRow.rowCount === 0) return res.status(404).json({ ok: false, error: "list_not_found" });

    const requestBody = mapDbTaskToGoogle({ title: title.trim(), notes, due, status });
    const result = await withTasksClient(
      pool, req.user.id, config.tasksEncryptionKey, config,
      (client) => client.tasks.insert({ tasklist: listRow.rows[0].google_id, requestBody }),
    );
    const gTask = result.data;

    const { rows } = await pool.query(
      `INSERT INTO tasks.tasks (list_id, user_id, google_id, title, notes, due, status, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       RETURNING id, list_id, google_id, title, notes, due, status, updated_at, created_at, synced_at, is_deleted`,
      [
        req.params.id, req.user.id, gTask.id,
        gTask.title || title.trim(),
        gTask.notes || notes || null,
        gTask.due ? gTask.due.split("T")[0] : (due || null),
        gTask.status || "needsAction",
      ],
    );
    res.json({ ok: true, task: rows[0] });
  } catch (err) {
    const c = classifyGoogleError(err);
    if (c.type === "auth") return res.status(401).json({ ok: false, error: "token_expired" });
    req.log.error({ err: err?.message }, "POST /lists/:id/tasks failed");
    res.status(c.status).json({ ok: false, error: c.type });
  }
});

// PATCH /api/tasks/lists/:id/tasks/:taskId — update a task
router.patch("/lists/:id/tasks/:taskId", async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  const { title, notes, due, status } = req.body || {};
  if (!title && notes === undefined && due === undefined && !status) {
    return res.status(400).json({ ok: false, error: "no_fields_to_update" });
  }
  try {
    const taskRow = await pool.query(
      `SELECT t.google_id AS task_google_id, tl.google_id AS list_google_id
       FROM tasks.tasks t
       JOIN tasks.task_lists tl ON tl.id = t.list_id
       WHERE t.id = $1 AND t.list_id = $2 AND t.user_id = $3 AND t.is_deleted = FALSE`,
      [req.params.taskId, req.params.id, req.user.id],
    );
    if (taskRow.rowCount === 0) return res.status(404).json({ ok: false, error: "task_not_found" });

    const { task_google_id, list_google_id } = taskRow.rows[0];
    const requestBody = {};
    if (title) requestBody.title = title.trim();
    if (notes !== undefined) requestBody.notes = notes;
    if (due !== undefined) requestBody.due = due ? `${due}T00:00:00.000Z` : null;
    if (status) requestBody.status = status;

    const result = await withTasksClient(
      pool, req.user.id, config.tasksEncryptionKey, config,
      (client) => client.tasks.patch({
        tasklist: list_google_id,
        task: task_google_id,
        requestBody,
      }),
    );
    const gTask = result.data;

    const setClauses = [];
    const params = [req.params.taskId];
    let idx = 2;
    if (gTask.title != null) { setClauses.push(`title = $${idx++}`); params.push(gTask.title); }
    if (gTask.notes != null) { setClauses.push(`notes = $${idx++}`); params.push(gTask.notes); }
    if (gTask.due != null) { setClauses.push(`due = $${idx++}`); params.push(gTask.due.split("T")[0]); }
    else if (due === null) { setClauses.push(`due = $${idx++}`); params.push(null); }
    if (gTask.status != null) { setClauses.push(`status = $${idx++}`); params.push(gTask.status); }
    setClauses.push(`synced_at = now()`);

    const { rows } = await pool.query(
      `UPDATE tasks.tasks SET ${setClauses.join(", ")} WHERE id = $1
       RETURNING id, list_id, google_id, title, notes, due, status, updated_at, created_at, synced_at, is_deleted`,
      params,
    );
    res.json({ ok: true, task: rows[0] });
  } catch (err) {
    const c = classifyGoogleError(err);
    if (c.type === "auth") return res.status(401).json({ ok: false, error: "token_expired" });
    req.log.error({ err: err?.message }, "PATCH /lists/:id/tasks/:taskId failed");
    res.status(c.status).json({ ok: false, error: c.type });
  }
});

// DELETE /api/tasks/lists/:id/tasks/:taskId — soft-delete + push to Google
router.delete("/lists/:id/tasks/:taskId", async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  try {
    const taskRow = await pool.query(
      `SELECT t.google_id AS task_google_id, tl.google_id AS list_google_id
       FROM tasks.tasks t
       JOIN tasks.task_lists tl ON tl.id = t.list_id
       WHERE t.id = $1 AND t.list_id = $2 AND t.user_id = $3 AND t.is_deleted = FALSE`,
      [req.params.taskId, req.params.id, req.user.id],
    );
    if (taskRow.rowCount === 0) return res.status(404).json({ ok: false, error: "task_not_found" });

    const { task_google_id, list_google_id } = taskRow.rows[0];
    await withTasksClient(
      pool, req.user.id, config.tasksEncryptionKey, config,
      (client) => client.tasks.delete({ tasklist: list_google_id, task: task_google_id }),
    );
    await pool.query(
      `UPDATE tasks.tasks SET is_deleted = TRUE WHERE id = $1`,
      [req.params.taskId],
    );
    res.json({ ok: true });
  } catch (err) {
    const c = classifyGoogleError(err);
    if (c.type === "auth") return res.status(401).json({ ok: false, error: "token_expired" });
    req.log.error({ err: err?.message }, "DELETE /lists/:id/tasks/:taskId failed");
    res.status(c.status).json({ ok: false, error: c.type });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Sync Status + Conflicts (user-scoped queries for the frontend)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/tasks/sync/status — last sync info for current user
router.get("/sync/status", async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  try {
    const { rows } = await pool.query(
      `SELECT event_type, details, created_at
       FROM tasks.sync_log
       WHERE user_id = $1 AND event_type IN ('sync_completed', 'sync_failed')
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id],
    );
    const hasToken = await pool.query(
      `SELECT 1 FROM tasks.oauth_tokens WHERE user_id = $1 AND revoked_at IS NULL`,
      [req.user.id],
    );
    const conflicts = await pool.query(
      `SELECT COUNT(*)::int AS count FROM tasks.sync_conflicts
       WHERE user_id = $1 AND resolution IS NULL AND expires_at > now()`,
      [req.user.id],
    );
    res.json({
      ok: true,
      connected: hasToken.rowCount > 0,
      lastSync: rows[0]?.created_at || null,
      lastStatus: rows[0]?.event_type || null,
      conflicts: conflicts.rows[0]?.count || 0,
    });
  } catch (err) {
    req.log.error({ err: err?.message }, "GET /sync/status failed");
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// GET /api/tasks/sync/conflicts — unresolved conflicts for current user
router.get("/sync/conflicts", async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  try {
    const { rows } = await pool.query(
      `SELECT id, task_id, list_id, conflict_type, hub_version, google_version,
              created_at, expires_at
       FROM tasks.sync_conflicts
       WHERE user_id = $1 AND resolution IS NULL AND expires_at > now()
       ORDER BY created_at DESC`,
      [req.user.id],
    );
    res.json({ ok: true, conflicts: rows, totalCount: rows.length });
  } catch (err) {
    req.log.error({ err: err?.message }, "GET /sync/conflicts failed");
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// PATCH /api/tasks/sync/conflicts/:id — resolve a conflict
router.patch("/sync/conflicts/:id", async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  const { resolution } = req.body || {};
  if (!["take_google", "take_hub", "manual"].includes(resolution)) {
    return res.status(400).json({ ok: false, error: "invalid_resolution" });
  }
  try {
    const { rowCount } = await pool.query(
      `UPDATE tasks.sync_conflicts
       SET resolution = $1, resolved_by = $2, resolved_at = now()
       WHERE id = $3 AND user_id = $2 AND resolution IS NULL`,
      [resolution, req.user.id, req.params.id],
    );
    if (rowCount === 0) return res.status(404).json({ ok: false, error: "conflict_not_found" });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err: err?.message }, "PATCH /sync/conflicts/:id failed");
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

export default router;
