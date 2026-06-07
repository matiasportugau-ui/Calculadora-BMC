// ═══════════════════════════════════════════════════════════════════════════
// server/lib/googleTasksClient.js — outbound writes BMC → Google Tasks
// ───────────────────────────────────────────────────────────────────────────
// BMC is the system of record. Every CRUD operation from /api/tasks/* writes
// through here so the resource lives in BOTH BMC's tasks.* schema AND in the
// user's Google Tasks account.
//
// Pattern: push-first synchronous — call Google API, then persist the result
// (with returned google_id) in BMC. If Google fails, the BMC write also fails
// (returned to the user). This trades availability for simplicity. A future
// iteration can introduce an outbox pattern (BMC writes immediately, async
// worker pushes to Google, retries on transient failure).
//
// Token handling: access token is decrypted via SQL pgp_sym_decrypt — never
// touches JS in plaintext form except for the ~1 RTT inside this module.
// ═══════════════════════════════════════════════════════════════════════════

import { config } from "../config.js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const TASKS_LISTS_URL = "https://www.googleapis.com/tasks/v1/users/@me/lists";
const TASKS_LIST_URL = (listId) =>
  `https://www.googleapis.com/tasks/v1/users/@me/lists/${encodeURIComponent(listId)}`;
const TASKS_BY_LIST_URL = (listId) =>
  `https://www.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks`;
const TASK_URL = (listId, taskId) =>
  `https://www.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`;

export class GoogleTasksError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

// Decrypt user's access token via SQL — never log it in plaintext.
async function getAccessToken(pool, userId) {
  const r = await pool.query(
    `SELECT access_token_encrypted
       FROM tasks.oauth_tokens
      WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
  if (!r.rows.length) {
    throw new GoogleTasksError("no_oauth_token", 401, null);
  }
  const dec = await pool.query(
    `SELECT pgp_sym_decrypt($1::bytea, $2)::text AS token`,
    [r.rows[0].access_token_encrypted, config.supabasePgpEncryptKey],
  );
  const token = dec.rows[0]?.token;
  if (!token) throw new GoogleTasksError("decrypt_failed", 500, null);
  return token;
}

// Refresh the user's access_token using their stored refresh_token. Returns
// the new access token and updates tasks.oauth_tokens in place. Used by:
//   - call() retry-on-401 path (outbound writes BMC→Google)
//   - server/routes/tasksSync.js retry-on-401 path (inbound pulls)
// Throws GoogleTasksError on failure so callers can decide whether to mark
// the token revoked (when Google rejects the refresh_token too).
export async function refreshAccessToken(pool, userId) {
  const r = await pool.query(
    `SELECT pgp_sym_decrypt(refresh_token_encrypted::bytea, $2)::text AS rt
       FROM tasks.oauth_tokens
      WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId, config.supabasePgpEncryptKey],
  );
  if (!r.rows.length) {
    throw new GoogleTasksError("no_oauth_token_for_refresh", 401, null);
  }
  const refreshToken = r.rows[0].rt;
  if (!refreshToken || refreshToken.length < 10) {
    // No refresh_token stored — user must re-consent. Surface as 401 so the
    // caller can fall through to its existing mark-revoked path.
    throw new GoogleTasksError("no_refresh_token_stored", 401, null);
  }
  if (!config.googleTasksClientId || !config.googleTasksClientSecret) {
    throw new GoogleTasksError("oauth_client_not_configured", 503, null);
  }

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.googleTasksClientId,
      client_secret: config.googleTasksClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenRes.ok) {
    const body = await tokenRes.json().catch(() => null);
    throw new GoogleTasksError(
      `refresh_failed_http_${tokenRes.status}`,
      tokenRes.status,
      body,
    );
  }
  const tokenJson = await tokenRes.json();
  const {
    access_token: newAccessToken,
    expires_in: expiresIn,
    refresh_token: newRefreshToken,
  } = tokenJson;
  if (!newAccessToken) {
    throw new GoogleTasksError("refresh_no_access_token", 502, tokenJson);
  }

  // Encrypt + persist via SQL. Google usually omits refresh_token on refresh;
  // COALESCE preserves the existing one so we don't orphan the user.
  // The ::text casts match the TEXT column type — pgp_sym_encrypt returns
  // bytea, and COALESCE refuses to reconcile bytea with the column's text.
  // Without the casts, the entire UPDATE aborts with "COALESCE types bytea
  // and text cannot be matched" — silently breaking the refresh loop.
  await pool.query(
    `UPDATE tasks.oauth_tokens
        SET access_token_encrypted = pgp_sym_encrypt($1::text, $3)::text,
            refresh_token_encrypted = COALESCE(pgp_sym_encrypt($2::text, $3)::text, refresh_token_encrypted),
            expires_at = $4,
            updated_at = now()
      WHERE user_id = $5`,
    [
      newAccessToken,
      newRefreshToken || null,
      config.supabasePgpEncryptKey,
      new Date(Date.now() + (expiresIn || 3600) * 1000),
      userId,
    ],
  );

  await pool
    .query(
      `INSERT INTO tasks.sync_log (user_id, cycle_id, event_type, details)
       VALUES ($1, gen_random_uuid()::text, 'token_refreshed', $2::jsonb)`,
      [userId, JSON.stringify({ source: "refresh_helper", expires_in: expiresIn || 3600 })],
    )
    .catch(() => {});

  return newAccessToken;
}

// Generic Google Tasks API caller. Combines:
//   - transparent 401-refresh retry (refresh access_token, replay once)
//   - 30s AbortController guard so a hung Google upstream surfaces as
//     google_timeout (504) rather than tying up a Cloud Run worker
// Non-401 4xx/5xx surface as GoogleTasksError so the route can map to
// user-facing HTTP. If the refresh itself fails, the original 401 falls
// through so the route can decide to mark the token revoked.
async function call({ pool, userId, method, url, body, timeoutMs = 30000 }) {
  const doFetch = (tok) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    return fetch(url, {
      method,
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${tok}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }).finally(() => clearTimeout(timer));
  };

  try {
    let token = await getAccessToken(pool, userId);
    let res = await doFetch(token);

    if (res.status === 401) {
      try {
        token = await refreshAccessToken(pool, userId);
        res = await doFetch(token);
      } catch {
        // Refresh itself failed — fall through with the original 401 below.
      }
    }

    if (res.status === 204) return null; // DELETE success
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new GoogleTasksError(
        `google_tasks_http_${res.status}`,
        res.status,
        json,
      );
    }
    return json;
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new GoogleTasksError("google_timeout", 504, null);
    }
    throw err;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────

export async function createList({ pool, userId, title }) {
  return call({ pool, userId, method: "POST", url: TASKS_LISTS_URL, body: { title } });
}

export async function deleteList({ pool, userId, googleListId }) {
  return call({ pool, userId, method: "DELETE", url: TASKS_LIST_URL(googleListId) });
}

export async function createTask({ pool, userId, googleListId, title, notes, due }) {
  const body = { title };
  if (notes !== undefined) body.notes = notes;
  if (due !== undefined && due !== null) {
    body.due =
      typeof due === "string" && due.length === 10
        ? `${due}T00:00:00.000Z`
        : new Date(due).toISOString();
  }
  return call({ pool, userId, method: "POST", url: TASKS_BY_LIST_URL(googleListId), body });
}

export async function updateTask({
  pool, userId, googleListId, googleTaskId,
  title, notes, due, status,
}) {
  const body = {};
  if (title !== undefined) body.title = title;
  if (notes !== undefined) body.notes = notes;
  if (status !== undefined) body.status = status;
  if (due !== undefined) {
    body.due = due === null
      ? null
      : typeof due === "string" && due.length === 10
        ? `${due}T00:00:00.000Z`
        : new Date(due).toISOString();
  }
  return call({
    pool, userId, method: "PATCH", url: TASK_URL(googleListId, googleTaskId), body,
  });
}

export async function deleteTask({ pool, userId, googleListId, googleTaskId }) {
  return call({
    pool, userId, method: "DELETE", url: TASK_URL(googleListId, googleTaskId),
  });
}
