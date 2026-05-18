// ═══════════════════════════════════════════════════════════════════════════
// server/routes/tasks.js — Task CRUD operations
// ───────────────────────────────────────────────────────────────────────────
// Handles task list and task item management.
//
// Routes:
//   GET    /api/tasks/lists           — Fetch user's task lists
//   POST   /api/tasks/lists           — Create new task list
//   PATCH  /api/tasks/lists/:id       — Update task list
//   DELETE /api/tasks/lists/:id       — Delete task list
//   GET    /api/tasks/lists/:id/tasks — Fetch tasks for a list
//   POST   /api/tasks/lists/:id/tasks — Create new task
//   PATCH  /api/tasks/lists/:id/tasks/:taskId — Update task
//   DELETE /api/tasks/lists/:id/tasks/:taskId — Delete task
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import { config } from "../config.js";
import { requireUser } from "../lib/identityAuth.js";

const router = express.Router();

/**
 * GET /api/tasks/lists
 * Fetch all task lists for authenticated user.
 */
router.get("/api/tasks/lists", requireUser(), async (req, res) => {
  try {
    // TODO: Query identity.tasks WHERE user_id = req.user.id AND is_list = true
    // TODO: Return { ok: true, lists: [...] }
    res.status(501).json({ ok: false, error: "not_implemented" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/tasks/lists
 * Create new task list for authenticated user.
 */
router.post("/api/tasks/lists", requireUser(), async (req, res) => {
  try {
    const { title, description } = req.body || {};
    if (!title) {
      return res.status(400).json({ ok: false, error: "Missing title" });
    }

    // TODO: INSERT into identity.tasks (user_id, title, description, is_list=true)
    // TODO: Return { ok: true, list: { task_id, title, ... } }
    res.status(501).json({ ok: false, error: "not_implemented" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * PATCH /api/tasks/lists/:id
 * Update task list metadata.
 */
router.patch("/api/tasks/lists/:id", requireUser(), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body || {};

    // TODO: UPDATE identity.tasks WHERE task_id = id AND user_id = req.user.id AND is_list = true
    // TODO: Return { ok: true, list: { ... } }
    res.status(501).json({ ok: false, error: "not_implemented" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * DELETE /api/tasks/lists/:id
 * Delete task list and all its tasks.
 */
router.delete("/api/tasks/lists/:id", requireUser(), async (req, res) => {
  try {
    const { id } = req.params;

    // TODO: DELETE from identity.tasks WHERE task_id = id AND user_id = req.user.id AND is_list = true
    // TODO: Cascade will delete child tasks via ON DELETE CASCADE on parent_task_id
    // TODO: Return { ok: true }
    res.status(501).json({ ok: false, error: "not_implemented" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/tasks/lists/:id/tasks
 * Fetch all tasks in a list.
 */
router.get("/api/tasks/lists/:id/tasks", requireUser(), async (req, res) => {
  try {
    const { id } = req.params;

    // TODO: Query identity.tasks WHERE user_id = req.user.id AND google_list_id = id AND is_list = false
    // TODO: Return { ok: true, tasks: [...] }
    res.status(501).json({ ok: false, error: "not_implemented" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/tasks/lists/:id/tasks
 * Create new task in a list.
 */
router.post("/api/tasks/lists/:id/tasks", requireUser(), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, due_date } = req.body || {};
    if (!title) {
      return res.status(400).json({ ok: false, error: "Missing title" });
    }

    // TODO: INSERT into identity.tasks (user_id, google_list_id=id, title, description, due_date, is_list=false)
    // TODO: Return { ok: true, task: { ... } }
    res.status(501).json({ ok: false, error: "not_implemented" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * PATCH /api/tasks/lists/:id/tasks/:taskId
 * Update task (title, description, due_date, status, completed_at).
 */
router.patch("/api/tasks/lists/:id/tasks/:taskId", requireUser(), async (req, res) => {
  try {
    const { id, taskId } = req.params;
    const { title, description, due_date, status, completed_at } = req.body || {};

    // TODO: UPDATE identity.tasks WHERE task_id = taskId AND user_id = req.user.id AND google_list_id = id
    // TODO: Return { ok: true, task: { ... } }
    res.status(501).json({ ok: false, error: "not_implemented" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * DELETE /api/tasks/lists/:id/tasks/:taskId
 * Delete a task.
 */
router.delete("/api/tasks/lists/:id/tasks/:taskId", requireUser(), async (req, res) => {
  try {
    const { id, taskId } = req.params;

    // TODO: DELETE from identity.tasks WHERE task_id = taskId AND user_id = req.user.id AND google_list_id = id
    // TODO: Return { ok: true }
    res.status(501).json({ ok: false, error: "not_implemented" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
