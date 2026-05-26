// ═══════════════════════════════════════════════════════════════════════════
// server/routes/tasksSync.js — Tareas (Tasks) sync polling endpoint
// ───────────────────────────────────────────────────────────────────────────
// Cloud Scheduler target for bidirectional sync (Google → HUB).
// Triggered via POST /sync/google-tasks/pull every 60s (Cloud Scheduler cron).
// Request must include HMAC-256 signature (header: X-Sync-Signature) to prevent
// unauthorized invocation.
//
// Flow:
//   1) Verify HMAC signature against SYNC_HMAC_SECRET
//   2) For each user with active oauth_tokens:
//      a) Query Google Tasks API with updatedMin (RFC 3339) + nextPageToken
//      b) Upsert into tasks.task_lists + tasks.tasks
//      c) Detect conflicts (soft-delete vs Google active version)
//      d) Log sync cycle in tasks.sync_log
//   3) Return { ok: true, jobId, cycleId, itemsSynced, conflicts }
//
// Phase 0: Stub only (no business logic).
// Phase 1: Implement polling, conflict detection, and sync_log recording.
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import { createHmac } from "crypto";
import { config } from "../config.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Verify HMAC signature
// ─────────────────────────────────────────────────────────────────────────────
function verifyHmacSignature(signature, expectedSecret) {
  const hmac = createHmac("sha256", expectedSecret || "");
  const computed = hmac.digest("hex");
  // TODO Phase 1: Compare-constant-time verification (not ==)
  return computed === signature;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /sync/google-tasks/pull
// Cloud Scheduler cron endpoint (requires HMAC verification)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/google-tasks/pull", async (req, res) => {
  const signature = req.headers["x-sync-signature"];
  const syncSecret = config.syncHmacSecret;

  // Verify HMAC signature
  if (!verifyHmacSignature(signature, syncSecret)) {
    return res.status(403).json({
      ok: false,
      error: "invalid_signature",
      message: "HMAC signature verification failed",
    });
  }

  // TODO Phase 1:
  //   1) Generate unique cycleId (UUID or Job ID from Cloud Scheduler request)
  //   2) Query tasks.oauth_tokens WHERE revoked_at IS NULL (active tokens)
  //   3) For each user:
  //      a) Decrypt access_token (pgp_sym_decrypt)
  //      b) Query Google Tasks API (GET /tasks/v1/users/@me/lists)
  //      c) For each list: GET /tasks/v1/lists/{listId}/tasks?updatedMin=RFC3339&pageToken=X
  //      d) Upsert tasks.task_lists + tasks.tasks (ON CONFLICT ... DO UPDATE)
  //      e) Detect conflicts: tasks with is_deleted=true but Google version active
  //      f) Insert into tasks.sync_conflicts for human resolution
  //      g) Log: tasks.sync_log(event_type='sync_completed', user_id, cycle_id)
  //   4) Handle errors:
  //      - 401: Trigger token refresh; if refresh fails, mark token revoked
  //      - 429: Exponential backoff (log, skip this user, retry in next cron window)
  //      - 500-503: Log, skip, continue to next user
  //   5) Return aggregate summary

  const jobId = req.headers["x-goog-cloud-tasks-taskname"] || "local-test";
  const cycleId = req.body?.cycleId || jobId;

  res.json({
    ok: true,
    jobId,
    cycleId,
    status: "not_implemented",
    message: "Phase 1: Sync polling to be implemented",
    itemsSynced: 0,
    conflicts: 0,
    startedAt: new Date().toISOString(),
  });
});

export default router;
