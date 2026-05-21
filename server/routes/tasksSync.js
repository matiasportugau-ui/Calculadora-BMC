// ═══════════════════════════════════════════════════════════════════════════
// server/routes/tasksSync.js — Cloud Scheduler bidirectional sync handler
// ───────────────────────────────────────────────────────────────────────────
// POST /sync/google-tasks/pull is invoked every 60s by Cloud Scheduler. The
// scheduler sends the SYNC_HMAC_SECRET value as the static X-Sync-Signature
// header (NOT a body signature — see docs/hub-tasks-module/OPERATOR-CHECKLIST.md
// Step 3.3). Verification is a constant-time equality check.
//
// For each user with an active oauth_tokens row:
//   1. Decrypt access_token via SQL pgp_sym_decrypt (key stays in env, not JS).
//   2. GET /users/@me/lists + /lists/{id}/tasks?updatedMin=ISO&showDeleted=true.
//   3. Upsert lists + tasks; detect soft-delete-vs-Google-active conflicts.
//   4. Audit each cycle in tasks.sync_log; conflicts in tasks.sync_conflicts.
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import crypto from "crypto";
import { config } from "../config.js";
import { getTasksPool } from "../lib/tasksDb.js";
import { refreshAccessToken } from "../lib/googleTasksClient.js";

const router = express.Router();

const TASKS_LISTS_URL = "https://www.googleapis.com/tasks/v1/users/@me/lists";
const TASKS_BY_LIST_URL = (listId) =>
  `https://www.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks`;
const EPOCH_ISO = "1970-01-01T00:00:00.000Z";

function maskUserId(id) {
  if (!id || typeof id !== "string") return "***";
  return "***" + id.slice(-4);
}

// ─────────────────────────────────────────────────────────────────────────────
// Constant-time HMAC verification.
// Cloud Scheduler ships SYNC_HMAC_SECRET as the raw header value, so this is
// a constant-time equality of two buffers, NOT a recomputed signature.
// ─────────────────────────────────────────────────────────────────────────────
function verifyHmacSignature(incoming, secret) {
  if (!incoming || !secret) return false;
  const a = Buffer.from(String(incoming));
  const b = Buffer.from(String(secret));
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-user sync. Resolves to { itemsSynced, conflicts, listsTouched } or
// throws (which is caught by the outer loop so other users still run).
// ─────────────────────────────────────────────────────────────────────────────
async function syncUser({ pool, userId, encryptedAccessToken, cycleId }) {
  // Decrypt via SQL — key never touches JS.
  const decRow = await pool.query(
    `SELECT pgp_sym_decrypt($1::bytea, $2)::text AS token`,
    [encryptedAccessToken, config.supabasePgpEncryptKey],
  );
  let currentToken = decRow.rows[0]?.token;
  if (!currentToken) {
    throw new Error("decrypt_returned_empty");
  }

  // fetchWithRefresh: makes a Google API call with the current access_token.
  // On 401, attempts ONE refresh using the stored refresh_token; on success,
  // retries the request with the new token. Returns BOTH the final response
  // AND any refresh-attempt error so the caller can decide whether the 401
  // is permanent (revoke) or transient (skip-and-retry).
  async function fetchWithRefresh(url) {
    const auth = () => ({ Authorization: `Bearer ${currentToken}` });
    let res = await fetch(url, { headers: auth() });
    let refreshError = null;
    if (res.status === 401) {
      try {
        const newToken = await refreshAccessToken(pool, userId);
        currentToken = newToken;
        res = await fetch(url, { headers: auth() });
      } catch (err) {
        // Capture for the caller's revoke-vs-retry decision. We do NOT
        // re-throw — let the original 401 surface so caller can branch.
        refreshError = err;
      }
    }
    return { res, refreshError };
  }

  // 1) Fetch the user's task lists.
  const listsResult = await fetchWithRefresh(TASKS_LISTS_URL);
  const listsRes = listsResult.res;
  const listsRefreshErr = listsResult.refreshError;

  if (listsRes.status === 401) {
    // Classify: is this a PERMANENT auth failure (revoke + force re-OAuth) or
    // a TRANSIENT one (preserve token, retry next 60s cycle)?
    //
    // Permanent: Google explicitly rejected the refresh_token (invalid_grant,
    // unauthorized_client, invalid_client) OR no refresh_token was stored OR
    // refresh succeeded but the retry STILL returned 401 (token Google
    // just issued is also bad — unusual but treat as permanent).
    //
    // Transient: refresh-attempt itself had a transport/server-side failure
    // (Google 5xx, network blip, timeout). Token is probably still good once
    // Google recovers — don't revoke it, just wait and try again.
    const errBody = listsRefreshErr?.body || null;
    const permanentMessages = new Set([
      "no_oauth_token_for_refresh",
      "no_refresh_token_stored",
      "refresh_no_access_token",
    ]);
    const isPermanent =
      !listsRefreshErr ||
      permanentMessages.has(listsRefreshErr.message) ||
      errBody?.error === "invalid_grant" ||
      errBody?.error === "unauthorized_client" ||
      errBody?.error === "invalid_client";

    const refreshDetails = listsRefreshErr
      ? {
          refresh_attempted: true,
          refresh_status: listsRefreshErr.status,
          refresh_error: listsRefreshErr.message,
          refresh_body: errBody,
        }
      : { refresh_attempted: false };

    if (isPermanent) {
      await pool.query(
        `UPDATE tasks.oauth_tokens
            SET revoked_at = now(), updated_at = now()
          WHERE user_id = $1`,
        [userId],
      );
      await pool
        .query(
          `INSERT INTO tasks.sync_log (user_id, cycle_id, event_type, details, http_status_code)
           VALUES ($1, $2, 'token_revoked', $3::jsonb, 401)`,
          [userId, cycleId, JSON.stringify({ reason: "google_401_permanent", ...refreshDetails })],
        )
        .catch(() => {});
      return { itemsSynced: 0, conflicts: 0, listsTouched: 0, skipped: true };
    }

    // Transient — preserve token, log so operator can see what happened.
    await pool
      .query(
        `INSERT INTO tasks.sync_log (user_id, cycle_id, event_type, details, http_status_code)
         VALUES ($1, $2, 'sync_failed', $3::jsonb, 401)`,
        [userId, cycleId, JSON.stringify({ reason: "google_401_transient_refresh_failure", ...refreshDetails })],
      )
      .catch(() => {});
    return { itemsSynced: 0, conflicts: 0, listsTouched: 0, transient: true };
  }

  if (listsRes.status === 429) {
    await pool
      .query(
        `INSERT INTO tasks.sync_log (user_id, cycle_id, event_type, details, http_status_code)
         VALUES ($1, $2, 'rate_limit_hit', $3::jsonb, 429)`,
        [userId, cycleId, JSON.stringify({ endpoint: "lists" })],
      )
      .catch(() => {});
    return { itemsSynced: 0, conflicts: 0, listsTouched: 0, throttled: true };
  }

  if (!listsRes.ok) {
    throw new Error(`lists_http_${listsRes.status}`);
  }

  const listsJson = await listsRes.json();
  const googleLists = Array.isArray(listsJson.items) ? listsJson.items : [];

  let itemsSynced = 0;
  let conflicts = 0;

  for (const gl of googleLists) {
    if (!gl?.id || !gl?.title) continue;

    // Detect "first sync for this list" BEFORE the upsert clobbers synced_at.
    // - If row doesn't exist yet → backfill from EPOCH (pull full Google history).
    // - If row exists with prior synced_at → incremental pull from that timestamp.
    // This is what allows historical Google tasks (created before the user
    // connected) to be ingested into BMC on the first cycle, instead of
    // being silently filtered out by updatedMin=now().
    const prior = await pool.query(
      `SELECT synced_at FROM tasks.task_lists
        WHERE user_id = $1 AND google_id = $2`,
      [userId, gl.id],
    );
    const priorSyncedAt = prior.rows[0]?.synced_at || null;

    // Upsert the list and capture its internal UUID. synced_at gets bumped to now().
    const listUpsert = await pool.query(
      `INSERT INTO tasks.task_lists (user_id, google_id, title, synced_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (google_id) DO UPDATE
         SET title = EXCLUDED.title, synced_at = now()
       RETURNING id`,
      [userId, gl.id, gl.title],
    );
    const internalListId = listUpsert.rows[0].id;
    const updatedMin = priorSyncedAt
      ? new Date(priorSyncedAt).toISOString()
      : EPOCH_ISO;

    // 2) Fetch tasks for this list, paginated. updatedMin trims the payload.
    let pageToken;
    do {
      const params = new URLSearchParams({
        updatedMin,
        showDeleted: "true",
        showCompleted: "true",
        showHidden: "true",
        maxResults: "100",
      });
      if (pageToken) params.set("pageToken", pageToken);
      // Per-list tasks fetch reuses fetchWithRefresh but only cares about
      // res — any refresh attempt during the loop is best-effort.
      const { res: tasksRes } = await fetchWithRefresh(
        `${TASKS_BY_LIST_URL(gl.id)}?${params.toString()}`,
      );

      if (tasksRes.status === 429) {
        await pool
          .query(
            `INSERT INTO tasks.sync_log (user_id, cycle_id, event_type, details, http_status_code)
             VALUES ($1, $2, 'rate_limit_hit', $3::jsonb, 429)`,
            [
              userId,
              cycleId,
              JSON.stringify({ endpoint: "tasks", listId: gl.id }),
            ],
          )
          .catch(() => {});
        break;
      }
      if (!tasksRes.ok) {
        throw new Error(`tasks_http_${tasksRes.status}`);
      }
      const tasksJson = await tasksRes.json();
      const googleTasks = Array.isArray(tasksJson.items) ? tasksJson.items : [];

      for (const gt of googleTasks) {
        if (!gt?.id || !gt?.title) continue;

        const googleStatus =
          gt.status === "completed" ? "completed" : "needsAction";
        const googleDeleted = !!gt.deleted;

        // Look up local row (regardless of soft-delete state) to detect conflicts.
        const localRow = await pool.query(
          `SELECT id, is_deleted, status, title, notes, due
             FROM tasks.tasks
            WHERE list_id = $1 AND google_id = $2
            LIMIT 1`,
          [internalListId, gt.id],
        );

        if (
          localRow.rows.length &&
          localRow.rows[0].is_deleted === true &&
          !googleDeleted
        ) {
          // Conflict: HUB has soft-deleted but Google still shows it active.
          await pool
            .query(
              `INSERT INTO tasks.sync_conflicts
                 (task_id, list_id, user_id, conflict_type, hub_version, google_version)
               VALUES ($1, $2, $3, 'soft_delete_mismatch', $4::jsonb, $5::jsonb)`,
              [
                localRow.rows[0].id,
                internalListId,
                userId,
                JSON.stringify({
                  title: localRow.rows[0].title,
                  notes: localRow.rows[0].notes,
                  due: localRow.rows[0].due,
                  status: localRow.rows[0].status,
                  is_deleted: true,
                }),
                JSON.stringify({
                  title: gt.title,
                  notes: gt.notes || null,
                  due: gt.due ? gt.due.slice(0, 10) : null,
                  status: googleStatus,
                  is_deleted: false,
                }),
              ],
            )
            .catch(() => {});

          await pool
            .query(
              `INSERT INTO tasks.sync_log (user_id, cycle_id, event_type, details)
               VALUES ($1, $2, 'conflict_detected', $3::jsonb)`,
              [
                userId,
                cycleId,
                JSON.stringify({
                  task_id: localRow.rows[0].id,
                  conflict_type: "soft_delete_mismatch",
                }),
              ],
            )
            .catch(() => {});

          conflicts += 1;
          continue;
        }

        // Upsert via the partial-unique index (list_id, google_id) WHERE NOT is_deleted.
        await pool.query(
          `INSERT INTO tasks.tasks
             (list_id, user_id, google_id, title, notes, due, status, is_deleted, updated_at, synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
           ON CONFLICT (list_id, google_id) WHERE NOT is_deleted
           DO UPDATE SET
             title = EXCLUDED.title,
             notes = EXCLUDED.notes,
             due = EXCLUDED.due,
             status = EXCLUDED.status,
             is_deleted = EXCLUDED.is_deleted,
             updated_at = now(),
             synced_at = now()`,
          [
            internalListId,
            userId,
            gt.id,
            gt.title,
            gt.notes || null,
            gt.due ? gt.due.slice(0, 10) : null,
            googleStatus,
            googleDeleted,
          ],
        );
        itemsSynced += 1;
      }

      pageToken = tasksJson.nextPageToken || null;
    } while (pageToken);
  }

  return { itemsSynced, conflicts, listsTouched: googleLists.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /google-tasks/pull — Cloud Scheduler entrypoint (HMAC-gated).
// ─────────────────────────────────────────────────────────────────────────────
router.post("/google-tasks/pull", async (req, res) => {
  const signature = req.headers["x-sync-signature"];
  if (!verifyHmacSignature(signature, config.syncHmacSecret)) {
    return res.status(403).json({
      ok: false,
      error: "invalid_signature",
    });
  }

  if (!config.supabasePgpEncryptKey) {
    return res
      .status(503)
      .json({ ok: false, error: "pgp_key_not_configured" });
  }
  const pool = getTasksPool(config.databaseUrl);
  if (!pool) {
    return res.status(503).json({ ok: false, error: "db_not_configured" });
  }

  const cycleId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  // Housekeeping: drop expired oauth_state rows. PKCE flows that the user
  // abandoned (closed Google consent screen) leave 5-min-TTL rows here;
  // since this cron fires every 60s, it sweeps them within one TTL window.
  await pool
    .query(`DELETE FROM tasks.oauth_state WHERE expires_at < now()`)
    .catch(() => {});

  let usersProcessed = 0;
  let usersFailed = 0;
  let totalItems = 0;
  let totalConflicts = 0;

  let tokenRows;
  try {
    tokenRows = await pool.query(
      `SELECT user_id, access_token_encrypted
         FROM tasks.oauth_tokens
        WHERE revoked_at IS NULL`,
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      cycleId,
      error: "tokens_query_failed",
      message: err.message,
    });
  }

  for (const row of tokenRows.rows) {
    try {
      const result = await syncUser({
        pool,
        userId: row.user_id,
        encryptedAccessToken: row.access_token_encrypted,
        cycleId,
      });
      totalItems += result.itemsSynced;
      totalConflicts += result.conflicts;
      usersProcessed += 1;

      if (!result.skipped && !result.throttled) {
        await pool
          .query(
            `INSERT INTO tasks.sync_log (user_id, cycle_id, event_type, details)
             VALUES ($1, $2, 'sync_completed', $3::jsonb)`,
            [
              row.user_id,
              cycleId,
              JSON.stringify({
                items_synced: result.itemsSynced,
                conflicts: result.conflicts,
                lists_touched: result.listsTouched,
              }),
            ],
          )
          .catch(() => {});
      }
    } catch (err) {
      usersFailed += 1;
      await pool
        .query(
          `INSERT INTO tasks.sync_log (user_id, cycle_id, event_type, details)
           VALUES ($1, $2, 'sync_failed', $3::jsonb)`,
          [
            row.user_id,
            cycleId,
            JSON.stringify({
              error: String(err?.message || err).slice(0, 500),
              user_id_mask: maskUserId(row.user_id),
            }),
          ],
        )
        .catch(() => {});
    }
  }

  return res.json({
    ok: true,
    cycleId,
    startedAt,
    finishedAt: new Date().toISOString(),
    users: { processed: usersProcessed, failed: usersFailed },
    itemsSynced: totalItems,
    conflicts: totalConflicts,
  });
});

export default router;
