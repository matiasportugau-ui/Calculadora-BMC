// ═══════════════════════════════════════════════════════════════════════════
// server/routes/tasksSync.js — Google Tasks sync endpoint (Cloud Scheduler)
// ───────────────────────────────────────────────────────────────────────────
// Handles scheduled sync pulls from Google Tasks API.
// Expected to be called by Cloud Scheduler with HMAC authentication.
//
// Routes:
//   POST /sync/google-tasks/pull — Pull latest tasks from Google Tasks API
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import crypto from "node:crypto";
import { config } from "../config.js";

const router = express.Router();

/**
 * POST /sync/google-tasks/pull
 * Cloud Scheduler endpoint (HMAC-verified) to sync tasks from Google Tasks API.
 *
 * Expected request from Cloud Scheduler:
 *   Authorization: Bearer <OIDC_TOKEN>
 *   Body: { user_id: <uuid> } or empty for all users
 *
 * Verifies OIDC token via Google's public key, then syncs tasks.
 */
router.post("/sync/google-tasks/pull", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    if (!token) {
      return res.status(401).json({ ok: false, error: "missing_authorization" });
    }

    // TODO: Verify OIDC token signature using Google's public key cache
    // TODO: Decode token and extract user_id (if present in payload)
    // TODO: Determine target users: single user if user_id in body, else all with active tokens
    // TODO: For each user with identity.tasks_oauth_tokens where revoked_at IS NULL:
    //   - Check token expiry, refresh if needed
    //   - Call Google Tasks API with syncToken for incremental pull
    //   - Upsert tasks into identity.tasks
    //   - Update sync_token and last_synced_at
    //   - Log conflicts to identity.sync_conflicts
    // TODO: Return { ok: true, synced_users: count, conflicts: count }
    res.status(501).json({ ok: false, error: "not_implemented" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
