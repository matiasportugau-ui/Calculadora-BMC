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
// Task Lists — WRITE (503 until sync provisioned)
// ─────────────────────────────────────────────────────────────────────────────

router.post("/lists", (_req, res) => res.status(503).json(SYNC_NOT_CONFIGURED));
router.delete("/lists/:id", (_req, res) => res.status(503).json(SYNC_NOT_CONFIGURED));

// ─────────────────────────────────────────────────────────────────────────────
// Tasks — WRITE (503 until sync provisioned)
// ─────────────────────────────────────────────────────────────────────────────

router.post("/lists/:id/tasks", (_req, res) => res.status(503).json(SYNC_NOT_CONFIGURED));
router.patch("/lists/:id/tasks/:taskId", (_req, res) => res.status(503).json(SYNC_NOT_CONFIGURED));
router.delete("/lists/:id/tasks/:taskId", (_req, res) => res.status(503).json(SYNC_NOT_CONFIGURED));

export default router;
