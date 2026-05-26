// ═══════════════════════════════════════════════════════════════════════════
// server/routes/tasksSync.js — Tareas (Tasks) sync polling endpoint
// ───────────────────────────────────────────────────────────────────────────
// Cloud Scheduler target for bidirectional sync (Google → HUB).
// POST /sync/google-tasks/pull — HMAC-verified, pulls all users.
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import crypto from "node:crypto";
import { config } from "../config.js";
import { getTasksPool } from "../lib/tasksDb.js";
import {
  getTasksClient,
  refreshTokenIfNeeded,
  mapGoogleTaskToDb,
  classifyGoogleError,
} from "../lib/tasksClient.js";

const router = express.Router();

function verifyHmacSignature(body, signature, secret) {
  if (!secret) return false;
  if (!signature) return false;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(typeof body === "string" ? body : JSON.stringify(body || ""));
  const computed = hmac.digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

async function syncUserTasks(pool, userId, encryptionKey, cycleId) {
  const stats = { lists: 0, synced: 0, conflicts: 0, errors: [] };

  let client;
  try {
    ({ client } = await getTasksClient(pool, userId, encryptionKey));
  } catch (err) {
    if (err.status === 401) {
      try {
        await refreshTokenIfNeeded(pool, userId, encryptionKey, config);
        ({ client } = await getTasksClient(pool, userId, encryptionKey));
      } catch {
        stats.errors.push("token_refresh_failed");
        return stats;
      }
    } else {
      stats.errors.push(err.message);
      return stats;
    }
  }

  // Get last sync time for this user
  const lastSyncRow = await pool.query(
    `SELECT MAX(synced_at) AS last_sync FROM tasks.task_lists WHERE user_id = $1`,
    [userId],
  );
  const updatedMin = lastSyncRow.rows[0]?.last_sync
    ? new Date(lastSyncRow.rows[0].last_sync).toISOString()
    : undefined;

  // Sync task lists
  let listsRes;
  try {
    listsRes = await client.tasklists.list({ maxResults: 100 });
  } catch (err) {
    const c = classifyGoogleError(err);
    stats.errors.push(`tasklists.list: ${c.type}`);
    return stats;
  }

  const googleLists = listsRes.data.items || [];
  for (const gList of googleLists) {
    stats.lists++;

    // Upsert task list
    const listUpsert = await pool.query(
      `INSERT INTO tasks.task_lists (user_id, google_id, title, synced_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (google_id) DO UPDATE SET
         title = EXCLUDED.title,
         synced_at = now()
       RETURNING id`,
      [userId, gList.id, gList.title],
    );
    const listId = listUpsert.rows[0].id;

    // Fetch tasks for this list
    let pageToken;
    do {
      let tasksRes;
      try {
        const params = { tasklist: gList.id, maxResults: 100, showCompleted: true, showHidden: true };
        if (updatedMin) params.updatedMin = updatedMin;
        if (pageToken) params.pageToken = pageToken;
        tasksRes = await client.tasks.list(params);
      } catch (err) {
        const c = classifyGoogleError(err);
        if (c.type === "rate_limit") {
          stats.errors.push(`tasks.list rate_limited for list ${gList.id}`);
          await pool.query(
            `INSERT INTO tasks.sync_log (user_id, cycle_id, event_type, http_status_code, details)
             VALUES ($1, $2, 'rate_limit_hit', 429, $3::jsonb)`,
            [userId, cycleId, JSON.stringify({ list_id: gList.id })],
          );
        } else {
          stats.errors.push(`tasks.list: ${c.type} for list ${gList.id}`);
        }
        break;
      }

      const googleTasks = tasksRes.data.items || [];
      for (const gTask of googleTasks) {
        const mapped = mapGoogleTaskToDb(gTask, listId, userId);

        // Check for conflict: local soft-deleted but Google shows active
        const existing = await pool.query(
          `SELECT id, is_deleted, updated_at, synced_at FROM tasks.tasks
           WHERE list_id = $1 AND google_id = $2`,
          [listId, gTask.id],
        );

        if (existing.rowCount > 0) {
          const local = existing.rows[0];

          if (local.is_deleted && gTask.status !== "deleted") {
            // Conflict: locally deleted but still active in Google
            stats.conflicts++;
            await pool.query(
              `INSERT INTO tasks.sync_conflicts
                 (task_id, list_id, user_id, conflict_type, hub_version, google_version)
               VALUES ($1, $2, $3, 'soft_delete_mismatch', $4::jsonb, $5::jsonb)`,
              [
                local.id, listId, userId,
                JSON.stringify({ is_deleted: true, updated_at: local.updated_at }),
                JSON.stringify({ title: gTask.title, status: gTask.status, updated: gTask.updated }),
              ],
            );
            continue;
          }

          // Check for concurrent edit conflict
          if (
            local.synced_at &&
            local.updated_at > local.synced_at &&
            gTask.updated &&
            new Date(gTask.updated) > new Date(local.synced_at)
          ) {
            stats.conflicts++;
            await pool.query(
              `INSERT INTO tasks.sync_conflicts
                 (task_id, list_id, user_id, conflict_type, hub_version, google_version)
               VALUES ($1, $2, $3, 'concurrent_edit', $4::jsonb, $5::jsonb)`,
              [
                local.id, listId, userId,
                JSON.stringify({ title: local.title, updated_at: local.updated_at }),
                JSON.stringify({ title: gTask.title, status: gTask.status, updated: gTask.updated }),
              ],
            );
            continue;
          }

          // Normal update
          await pool.query(
            `UPDATE tasks.tasks SET
               title = $1, notes = $2, due = $3, status = $4, synced_at = now()
             WHERE id = $5`,
            [mapped.title, mapped.notes, mapped.due, mapped.status, local.id],
          );
          stats.synced++;
        } else {
          // New task from Google
          await pool.query(
            `INSERT INTO tasks.tasks (list_id, user_id, google_id, title, notes, due, status, synced_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
            [listId, userId, gTask.id, mapped.title, mapped.notes, mapped.due, mapped.status],
          );
          stats.synced++;
        }
      }

      pageToken = tasksRes.data.nextPageToken;
    } while (pageToken);
  }

  return stats;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /sync/google-tasks/pull
// ─────────────────────────────────────────────────────────────────────────────
router.post("/google-tasks/pull", async (req, res) => {
  const signature = req.headers["x-sync-signature"];
  if (!verifyHmacSignature(req.body, signature, config.syncHmacSecret)) {
    return res.status(403).json({ ok: false, error: "invalid_signature" });
  }

  const pool = getTasksPool(config.databaseUrl);
  if (!pool) {
    return res.status(503).json({ ok: false, error: "database_unavailable" });
  }

  const jobId = req.headers["x-goog-cloud-tasks-taskname"] || "local-test";
  const cycleId = req.body?.cycleId || crypto.randomUUID();
  const startedAt = new Date().toISOString();

  // Get all users with active tokens
  const { rows: users } = await pool.query(
    `SELECT user_id FROM tasks.oauth_tokens WHERE revoked_at IS NULL`,
  );

  let totalSynced = 0;
  let totalConflicts = 0;
  const userErrors = [];

  for (const { user_id: userId } of users) {
    await pool.query(
      `INSERT INTO tasks.sync_log (user_id, cycle_id, event_type)
       VALUES ($1, $2, 'sync_started')`,
      [userId, cycleId],
    );

    const stats = await syncUserTasks(pool, userId, config.tasksEncryptionKey, cycleId);
    totalSynced += stats.synced;
    totalConflicts += stats.conflicts;

    const eventType = stats.errors.length > 0 ? "sync_failed" : "sync_completed";
    await pool.query(
      `INSERT INTO tasks.sync_log (user_id, cycle_id, event_type, details)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [userId, cycleId, eventType, JSON.stringify(stats)],
    );

    if (stats.errors.length > 0) {
      userErrors.push({ userId, errors: stats.errors });
    }

    // Log conflicts
    if (stats.conflicts > 0) {
      await pool.query(
        `INSERT INTO tasks.sync_log (user_id, cycle_id, event_type, details)
         VALUES ($1, $2, 'conflict_detected', $3::jsonb)`,
        [userId, cycleId, JSON.stringify({ count: stats.conflicts })],
      );
    }
  }

  res.json({
    ok: true,
    jobId,
    cycleId,
    usersProcessed: users.length,
    itemsSynced: totalSynced,
    conflicts: totalConflicts,
    errors: userErrors.length,
    startedAt,
    completedAt: new Date().toISOString(),
  });
});

export default router;
