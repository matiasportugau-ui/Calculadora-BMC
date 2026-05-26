// ═══════════════════════════════════════════════════════════════════════════
// server/lib/tasksClient.js — Google Tasks API client helpers
// ═══════════════════════════════════════════════════════════════════════════

import { google } from "googleapis";

/**
 * Get an authenticated Google Tasks client for a user.
 * Decrypts the stored OAuth token via pgp_sym_decrypt.
 * Returns { client, accessToken } or throws if no active token.
 */
export async function getTasksClient(pool, userId, encryptionKey) {
  const { rows } = await pool.query(
    `SELECT
       pgp_sym_decrypt(access_token_encrypted::bytea, $2) AS access_token,
       pgp_sym_decrypt(refresh_token_encrypted::bytea, $2) AS refresh_token,
       expires_at
     FROM tasks.oauth_tokens
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId, encryptionKey],
  );

  if (rows.length === 0) {
    const err = new Error("no_active_token");
    err.status = 401;
    throw err;
  }

  const { access_token, refresh_token, expires_at } = rows[0];

  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({
    access_token,
    refresh_token: refresh_token || undefined,
    expiry_date: new Date(expires_at).getTime(),
  });

  const client = google.tasks({ version: "v1", auth: oauth2 });
  return { client, accessToken: access_token, refreshToken: refresh_token };
}

/**
 * Refresh an expired access token using the stored refresh_token.
 * Updates tasks.oauth_tokens with the new encrypted token.
 * Returns the new access token or throws.
 */
export async function refreshTokenIfNeeded(pool, userId, encryptionKey, config) {
  const { rows } = await pool.query(
    `SELECT
       pgp_sym_decrypt(refresh_token_encrypted::bytea, $2) AS refresh_token,
       expires_at
     FROM tasks.oauth_tokens
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId, encryptionKey],
  );

  if (rows.length === 0 || !rows[0].refresh_token) {
    const err = new Error("no_refresh_token");
    err.status = 401;
    throw err;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.googleTasksClientId,
      client_secret: config.googleTasksClientSecret,
      refresh_token: rows[0].refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    // Refresh failed — mark token as revoked
    await pool.query(
      `UPDATE tasks.oauth_tokens SET revoked_at = now() WHERE user_id = $1`,
      [userId],
    );
    const err = new Error("refresh_failed");
    err.status = 401;
    throw err;
  }

  const tokens = await tokenRes.json();
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

  await pool.query(
    `UPDATE tasks.oauth_tokens SET
       access_token_encrypted = pgp_sym_encrypt($2, $3),
       expires_at = $4
     WHERE user_id = $1`,
    [userId, tokens.access_token, encryptionKey, expiresAt],
  );

  return tokens.access_token;
}

/**
 * Execute a Google Tasks API call with automatic token refresh on 401.
 * `fn` receives a tasks client and should return the API result.
 */
export async function withTasksClient(pool, userId, encryptionKey, config, fn) {
  try {
    const { client } = await getTasksClient(pool, userId, encryptionKey);
    return await fn(client);
  } catch (err) {
    if (err?.code === 401 || err?.status === 401 || err?.response?.status === 401) {
      await refreshTokenIfNeeded(pool, userId, encryptionKey, config);
      const { client } = await getTasksClient(pool, userId, encryptionKey);
      return await fn(client);
    }
    throw err;
  }
}

/** Map Google Tasks API task object to DB row shape. */
export function mapGoogleTaskToDb(googleTask, listId, userId) {
  return {
    list_id: listId,
    user_id: userId,
    google_id: googleTask.id,
    title: googleTask.title || "",
    notes: googleTask.notes || null,
    due: googleTask.due ? googleTask.due.split("T")[0] : null,
    status: googleTask.status || "needsAction",
    parent_id: null,
    synced_at: new Date().toISOString(),
  };
}

/** Map DB task row to Google Tasks API request body. */
export function mapDbTaskToGoogle(dbTask) {
  const body = { title: dbTask.title };
  if (dbTask.notes != null) body.notes = dbTask.notes;
  if (dbTask.due != null) body.due = `${dbTask.due}T00:00:00.000Z`;
  if (dbTask.status != null) body.status = dbTask.status;
  return body;
}

/** Classify Google API errors for upstream handling. */
export function classifyGoogleError(err) {
  const status = err?.code || err?.response?.status || err?.status;
  if (status === 401) return { type: "auth", status: 401 };
  if (status === 429) return { type: "rate_limit", status: 503 };
  if (status >= 500) return { type: "upstream", status: 503 };
  if (status === 404) return { type: "not_found", status: 404 };
  return { type: "unknown", status: 500 };
}
