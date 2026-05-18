// ═══════════════════════════════════════════════════════════════════════════
// server/routes/tasks.js — Tareas (Tasks) CRUD operations
// ───────────────────────────────────────────────────────────────────────────
// Routes for reading and mutating task lists and individual tasks.
// All routes require Bearer JWT via requireUser middleware.
// Phase 0: Stub only (no business logic; routes are recognized by Express).
// Phase 1: Implement CRUD with Supabase queries, Google Tasks API calls, and
//          conflict detection.
//
// Routes:
//   GET    /api/tasks/lists               — List user's task lists
//   POST   /api/tasks/lists               — Create new task list
//   GET    /api/tasks/lists/:id           — Get single task list metadata
//   DELETE /api/tasks/lists/:id           — Delete task list (soft-delete)
//   GET    /api/tasks/lists/:id/tasks     — List tasks in a list (with pagination)
//   POST   /api/tasks/lists/:id/tasks     — Create task in list
//   GET    /api/tasks/lists/:id/tasks/:taskId — Get single task
//   PATCH  /api/tasks/lists/:id/tasks/:taskId — Update task
//   DELETE /api/tasks/lists/:id/tasks/:taskId — Delete task (soft-delete)
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import { requireUser } from "../lib/identityAuth.js";

const router = express.Router();

// Middleware: All tasks routes require authenticated user
router.use(requireUser);

// ─────────────────────────────────────────────────────────────────────────────
// Task Lists
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/tasks/lists
// List user's task lists (from Supabase cache or Google API with sync fallback)
router.get("/lists", async (req, res) => {
  const userId = req.user.id;
  // TODO Phase 1: Query tasks.task_lists for user_id; paginate with nextPageToken
  res.json({
    ok: true,
    lists: [],
    nextPageToken: null,
  });
});

// POST /api/tasks/lists
// Create new task list (POST to Google Tasks API + sync to Supabase)
router.post("/lists", async (req, res) => {
  const userId = req.user.id;
  const { title, description } = req.body;
  // TODO Phase 1: Validate input; POST to Google Tasks API; upsert tasks.task_lists
  res.status(201).json({
    ok: true,
    list: {
      id: "uuid",
      googleId: "google-task-list-id",
      title,
      description,
      updated_at: new Date().toISOString(),
    },
  });
});

// GET /api/tasks/lists/:id
// Get single task list metadata (from cache or API)
router.get("/lists/:id", async (req, res) => {
  const userId = req.user.id;
  const { id: listId } = req.params;
  // TODO Phase 1: Query tasks.task_lists for user_id + id; return metadata
  res.json({
    ok: true,
    list: {
      id: listId,
      googleId: "google-task-list-id",
      title: "Task List Title",
      description: "Optional description",
      taskCount: 0,
      updated_at: new Date().toISOString(),
    },
  });
});

// DELETE /api/tasks/lists/:id
// Delete task list (soft-delete: mark as is_deleted = true)
router.delete("/lists/:id", async (req, res) => {
  const userId = req.user.id;
  const { id: listId } = req.params;
  // TODO Phase 1: Soft-delete tasks.task_lists row; propagate to tasks.tasks via CASCADE
  res.json({
    ok: true,
    deleted: true,
    resolvedAt: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tasks within Lists
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/tasks/lists/:id/tasks
// List tasks in a task list (paginated with nextPageToken)
router.get("/lists/:id/tasks", async (req, res) => {
  const userId = req.user.id;
  const { id: listId } = req.params;
  const { pageToken } = req.query;
  // TODO Phase 1: Query tasks.tasks for user_id + list_id; paginate
  res.json({
    ok: true,
    tasks: [],
    nextPageToken: null,
  });
});

// POST /api/tasks/lists/:id/tasks
// Create task in list (POST to Google Tasks API + sync to Supabase)
router.post("/lists/:id/tasks", async (req, res) => {
  const userId = req.user.id;
  const { id: listId } = req.params;
  const { title, notes, due, parent } = req.body;
  // TODO Phase 1: Validate input; POST to Google Tasks API; upsert tasks.tasks
  res.status(201).json({
    ok: true,
    task: {
      id: "uuid",
      googleId: "google-task-id",
      listId,
      title,
      notes,
      due,
      status: "needsAction",
      parent,
      updated_at: new Date().toISOString(),
    },
  });
});

// GET /api/tasks/lists/:id/tasks/:taskId
// Get single task
router.get("/lists/:id/tasks/:taskId", async (req, res) => {
  const userId = req.user.id;
  const { id: listId, taskId } = req.params;
  // TODO Phase 1: Query tasks.tasks for user_id + list_id + id; return task
  res.json({
    ok: true,
    task: {
      id: taskId,
      googleId: "google-task-id",
      listId,
      title: "Task Title",
      notes: "Optional notes",
      due: null,
      status: "needsAction",
      updated_at: new Date().toISOString(),
    },
  });
});

// PATCH /api/tasks/lists/:id/tasks/:taskId
// Update task (PATCH on Google Tasks API + sync to Supabase)
router.patch("/lists/:id/tasks/:taskId", async (req, res) => {
  const userId = req.user.id;
  const { id: listId, taskId } = req.params;
  const { title, notes, due, status } = req.body;
  // TODO Phase 1: Validate input; PATCH Google Tasks API; update tasks.tasks
  res.json({
    ok: true,
    task: {
      id: taskId,
      googleId: "google-task-id",
      listId,
      title,
      notes,
      due,
      status,
      updated_at: new Date().toISOString(),
    },
  });
});

// DELETE /api/tasks/lists/:id/tasks/:taskId
// Delete task (soft-delete; optionally soft-mark complete on Google)
router.delete("/lists/:id/tasks/:taskId", async (req, res) => {
  const userId = req.user.id;
  const { id: listId, taskId } = req.params;
  // TODO Phase 1: Soft-delete tasks.tasks row; PATCH Google Tasks to mark complete
  res.json({
    ok: true,
    deleted: true,
    resolvedAt: new Date().toISOString(),
  });
});

export default router;
