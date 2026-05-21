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

// Generic Google Tasks API caller. Surfaces 401 / 4xx / 5xx as
// GoogleTasksError so the route can map to user-facing HTTP.
async function call({ token, method, url, body }) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
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
}

// ─── Public API ──────────────────────────────────────────────────────────

export async function createList({ pool, userId, title }) {
  const token = await getAccessToken(pool, userId);
  return call({
    token,
    method: "POST",
    url: TASKS_LISTS_URL,
    body: { title },
  });
}

export async function deleteList({ pool, userId, googleListId }) {
  const token = await getAccessToken(pool, userId);
  return call({
    token,
    method: "DELETE",
    url: TASKS_LIST_URL(googleListId),
  });
}

export async function createTask({ pool, userId, googleListId, title, notes, due }) {
  const token = await getAccessToken(pool, userId);
  const body = { title };
  if (notes !== undefined) body.notes = notes;
  if (due !== undefined && due !== null) {
    // Google expects RFC 3339 with Z suffix; accept either YYYY-MM-DD or full ISO
    body.due =
      typeof due === "string" && due.length === 10
        ? `${due}T00:00:00.000Z`
        : new Date(due).toISOString();
  }
  return call({
    token,
    method: "POST",
    url: TASKS_BY_LIST_URL(googleListId),
    body,
  });
}

export async function updateTask({
  pool, userId, googleListId, googleTaskId,
  title, notes, due, status,
}) {
  const token = await getAccessToken(pool, userId);
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
    token,
    method: "PATCH",
    url: TASK_URL(googleListId, googleTaskId),
    body,
  });
}

export async function deleteTask({ pool, userId, googleListId, googleTaskId }) {
  const token = await getAccessToken(pool, userId);
  return call({
    token,
    method: "DELETE",
    url: TASK_URL(googleListId, googleTaskId),
  });
}
