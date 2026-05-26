// ═══════════════════════════════════════════════════════════════════════════
// server/routes/tasksOAuth.js — Tareas (Tasks) OAuth PKCE flow
// ───────────────────────────────────────────────────────────────────────────
// Obtains a Google Tasks API access_token via authorization-code grant with
// PKCE challenge/verifier. Separate from identity.authGoogle (user login).
//
// Routes:
//   GET  /auth/tasks/init         — redirect to Google consent (PKCE)
//   GET  /auth/tasks/callback     — exchange code for tokens, store encrypted
//   POST /auth/tasks/revoke       — revoke token + mark revoked_at
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import crypto from "node:crypto";
import { config } from "../config.js";
import { requireUser } from "../lib/identityAuth.js";
import { getTasksPool } from "../lib/tasksDb.js";

const router = express.Router();

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";

function redirectUri() {
  const base = config.publicBaseUrl.replace(/\/$/, "");
  return `${base}/auth/tasks/callback`;
}

function poolOr503(res) {
  const pool = getTasksPool(config.databaseUrl);
  if (!pool) {
    res.status(503).json({ ok: false, error: "database_unavailable" });
    return null;
  }
  return pool;
}

function configOr503(res) {
  if (!config.googleTasksClientId || !config.googleTasksClientSecret) {
    res.status(503).json({
      ok: false,
      error: "tasks_oauth_not_configured",
      message: "GOOGLE_TASKS_CLIENT_ID / GOOGLE_TASKS_CLIENT_SECRET not set.",
    });
    return false;
  }
  if (!config.tasksEncryptionKey) {
    res.status(503).json({
      ok: false,
      error: "encryption_key_missing",
      message: "ENCRYPTION_KEY not set — cannot store tokens securely.",
    });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/tasks/init — redirect to Google consent with PKCE
// ─────────────────────────────────────────────────────────────────────────────
router.get("/init", requireUser, async (req, res) => {
  if (!configOr503(res)) return;
  const pool = poolOr503(res);
  if (!pool) return;

  const userId = req.user.id;

  try {
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64url");
    const stateNonce = crypto.randomBytes(16).toString("hex");

    // Cleanup expired states for this user, then insert new one.
    // The `challenge` column stores the PKCE verifier (needed at callback);
    // the column name in the migration is a misnomer — see PHASE-1-DRIFT-NOTE.md.
    await pool.query(
      `DELETE FROM tasks.oauth_state WHERE user_id = $1 OR expires_at < now()`,
      [userId],
    );
    await pool.query(
      `INSERT INTO tasks.oauth_state (user_id, state_nonce, challenge, expires_at)
       VALUES ($1, $2, $3, now() + interval '10 minutes')`,
      [userId, stateNonce, verifier],
    );

    const params = new URLSearchParams({
      client_id: config.googleTasksClientId,
      redirect_uri: redirectUri(),
      response_type: "code",
      scope: TASKS_SCOPE,
      state: stateNonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
      access_type: "offline",
      prompt: "consent",
    });

    req.log.info({ userId }, "Tasks OAuth PKCE flow initiated");
    res.redirect(302, `${GOOGLE_AUTH_URL}?${params}`);
  } catch (err) {
    req.log.error({ err: err?.message }, "Tasks OAuth init failed");
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/tasks/callback?code=X&state=Y
// ─────────────────────────────────────────────────────────────────────────────
router.get("/callback", async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    req.log.warn({ error, error_description }, "Tasks OAuth denied by user");
    return res.redirect(`/hub/tareas?auth=error&reason=${encodeURIComponent(String(error))}`);
  }
  if (!code || !state) {
    return res.status(400).json({ ok: false, error: "missing_code_or_state" });
  }

  if (!configOr503(res)) return;
  const pool = poolOr503(res);
  if (!pool) return;

  try {
    // Lookup + consume state nonce (single-use)
    const { rows } = await pool.query(
      `DELETE FROM tasks.oauth_state
       WHERE state_nonce = $1 AND expires_at > now()
       RETURNING user_id, challenge`,
      [String(state)],
    );
    if (rows.length === 0) {
      return res.status(400).json({ ok: false, error: "invalid_or_expired_state" });
    }

    const { user_id: userId, challenge: verifier } = rows[0];

    // Exchange authorization code for tokens
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: config.googleTasksClientId,
        client_secret: config.googleTasksClientSecret,
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });

    if (!tokenRes.ok) {
      req.log.error({ status: tokenRes.status, userId }, "Google token exchange failed");
      return res.redirect("/hub/tareas?auth=error&reason=token_exchange_failed");
    }

    const tokens = await tokenRes.json();
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

    // Store encrypted tokens via pgp_sym_encrypt
    await pool.query(
      `INSERT INTO tasks.oauth_tokens
         (user_id, access_token_encrypted, refresh_token_encrypted, expires_at, scope)
       VALUES (
         $1,
         pgp_sym_encrypt($2, $3),
         pgp_sym_encrypt($4, $3),
         $5,
         $6
       )
       ON CONFLICT (user_id) DO UPDATE SET
         access_token_encrypted = pgp_sym_encrypt($2, $3),
         refresh_token_encrypted = pgp_sym_encrypt($4, $3),
         expires_at = $5,
         scope = $6,
         revoked_at = NULL`,
      [
        userId,
        tokens.access_token,
        config.tasksEncryptionKey,
        tokens.refresh_token || "",
        expiresAt,
        tokens.scope || TASKS_SCOPE,
      ],
    );

    // Log sync event
    await pool.query(
      `INSERT INTO tasks.sync_log (user_id, cycle_id, event_type, details)
       VALUES ($1, $2, 'token_refreshed', $3::jsonb)`,
      [
        userId,
        crypto.randomUUID(),
        JSON.stringify({ event: "token_acquired", scope: tokens.scope }),
      ],
    );

    req.log.info({ userId }, "Tasks OAuth tokens stored successfully");
    res.redirect("/hub/tareas?auth=success");
  } catch (err) {
    req.log.error({ err: err?.message }, "Tasks OAuth callback failed");
    res.redirect("/hub/tareas?auth=error&reason=internal_error");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/tasks/revoke — revoke token + mark revoked_at
// ─────────────────────────────────────────────────────────────────────────────
router.post("/revoke", requireUser, async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  const userId = req.user.id;

  try {
    // Decrypt access token to revoke at Google
    const { rows } = await pool.query(
      `SELECT pgp_sym_decrypt(access_token_encrypted::bytea, $2) AS access_token
       FROM tasks.oauth_tokens
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId, config.tasksEncryptionKey],
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "no_active_token" });
    }

    // Best-effort revoke at Google (don't fail if Google is down)
    try {
      await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(rows[0].access_token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    } catch (revokeErr) {
      req.log.warn({ err: revokeErr?.message }, "Google token revocation request failed");
    }

    await pool.query(
      `UPDATE tasks.oauth_tokens SET revoked_at = now() WHERE user_id = $1`,
      [userId],
    );

    await pool.query(
      `INSERT INTO tasks.sync_log (user_id, cycle_id, event_type)
       VALUES ($1, $2, 'token_revoked')`,
      [userId, crypto.randomUUID()],
    );

    req.log.info({ userId }, "Tasks OAuth token revoked");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err: err?.message }, "Tasks OAuth revoke failed");
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

export default router;
