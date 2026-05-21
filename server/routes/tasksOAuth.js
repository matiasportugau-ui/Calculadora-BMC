// ═══════════════════════════════════════════════════════════════════════════
// server/routes/tasksOAuth.js — Tareas (Tasks) OAuth PKCE flow
// ───────────────────────────────────────────────────────────────────────────
// Separate from identity.authGoogle (which handles user login). This flow
// obtains a Google Tasks API access_token via authorization-code grant with
// PKCE challenge/verifier. Tokens are encrypted at rest via SQL pgp_sym_encrypt.
//
// Routes:
//   GET   /auth/tasks/init        Bearer JWT → JSON { ok, url } (no 302; SPA does redirect)
//   GET   /auth/tasks/callback    Google redirect → 302 /hub/tareas
//   POST  /auth/tasks/revoke      Bearer JWT → revoke at Google + mark revoked_at
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import crypto from "crypto";
import { config } from "../config.js";
import { requireUser } from "../lib/identityAuth.js";
import { getTasksPool } from "../lib/tasksDb.js";

const router = express.Router();

// Redirect URI Google sends the user to after consent. Must EXACTLY match
// what's configured in the OAuth client's "Authorized redirect URIs" list.
//
// Default targets the Vercel SPA domain — vercel.json rewrites /auth/*
// to Cloud Run, so the request lands in this same Express app. Cleaner
// for the user (one consistent domain throughout the flow) and stable
// across Cloud Run revisions (the *.run.app URL hash changes per region/
// project; the Vercel domain doesn't).
//
// Override via GOOGLE_TASKS_REDIRECT_URI env var if you need to point at
// the Cloud Run URL directly (e.g., for local dev with ngrok).
const REDIRECT_URI =
  process.env.GOOGLE_TASKS_REDIRECT_URI ||
  `${(config.frontendBaseUrl || "https://calculadora-bmc.vercel.app").replace(/\/$/, "")}/auth/tasks/callback`;
const TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

function maskToken(value) {
  if (!value || typeof value !== "string") return "***";
  return "***" + value.slice(-4);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /init — requires Bearer JWT; returns Google consent URL for the SPA to redirect to
// ─────────────────────────────────────────────────────────────────────────────
router.get("/init", requireUser(), async (req, res) => {
  if (!config.googleTasksClientId || !config.googleTasksClientSecret) {
    return res.status(503).json({
      ok: false,
      error: "oauth_not_configured",
      message: "Google Tasks OAuth credentials not provisioned (see OPERATOR-CHECKLIST.md)",
    });
  }
  const pool = getTasksPool(config.databaseUrl);
  if (!pool) {
    return res.status(503).json({ ok: false, error: "db_not_configured" });
  }

  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const stateNonce = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    // The `challenge` column stores the raw code_verifier despite its name —
    // the verifier is what /callback needs to send to Google for token exchange.
    await pool.query(
      `INSERT INTO tasks.oauth_state (user_id, state_nonce, challenge, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, stateNonce, codeVerifier, expiresAt],
    );
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "state_persist_failed",
      message: err.message,
    });
  }

  const params = new URLSearchParams({
    client_id: config.googleTasksClientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: TASKS_SCOPE,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state: stateNonce,
    access_type: "offline",
    prompt: "consent",
  });

  return res.json({
    ok: true,
    url: `${GOOGLE_AUTH_URL}?${params.toString()}`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /callback?code=...&state=... — Google redirects user here after consent
// ─────────────────────────────────────────────────────────────────────────────
router.get("/callback", async (req, res) => {
  const { code, state, error, error_description: errorDesc } = req.query;

  if (error) {
    const msg = encodeURIComponent(errorDesc || error);
    const base = (config.frontendBaseUrl || "").replace(/\/$/, "");
    return res.redirect(`${base}/hub/tareas?error=${msg}`);
  }
  if (!code || !state) {
    return res.status(400).json({ ok: false, error: "missing_params" });
  }
  if (!config.googleTasksClientId || !config.googleTasksClientSecret) {
    return res.status(503).json({ ok: false, error: "oauth_not_configured" });
  }
  if (!config.supabasePgpEncryptKey) {
    return res.status(503).json({ ok: false, error: "pgp_key_not_configured" });
  }
  const pool = getTasksPool(config.databaseUrl);
  if (!pool) {
    return res.status(503).json({ ok: false, error: "db_not_configured" });
  }

  // Atomic delete + retrieve: prevents reuse and discards expired rows.
  let codeVerifier;
  let userId;
  try {
    const stateRow = await pool.query(
      `DELETE FROM tasks.oauth_state
       WHERE state_nonce = $1 AND expires_at > now()
       RETURNING challenge, user_id`,
      [state],
    );
    if (!stateRow.rows.length) {
      return res
        .status(400)
        .json({ ok: false, error: "state_invalid_or_expired" });
    }
    codeVerifier = stateRow.rows[0].challenge;
    userId = stateRow.rows[0].user_id;
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "state_lookup_failed",
      message: err.message,
    });
  }

  // Exchange the authorization code for access + refresh tokens.
  let tokenJson;
  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.googleTasksClientId,
        client_secret: config.googleTasksClientSecret,
        code_verifier: codeVerifier,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      return res.status(401).json({
        ok: false,
        error: "token_exchange_failed",
        status: tokenRes.status,
      });
    }
    tokenJson = await tokenRes.json();
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: "google_unreachable",
      message: err.message,
    });
  }

  const {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
    scope,
  } = tokenJson;

  if (!accessToken) {
    return res.status(502).json({
      ok: false,
      error: "no_access_token",
      tokenPreview: maskToken(accessToken),
    });
  }

  // Encrypt + upsert via SQL — JS only sees plaintext for ~1 RTT.
  try {
    const encRow = await pool.query(
      `SELECT pgp_sym_encrypt($1::text, $2)::text AS at_enc,
              pgp_sym_encrypt($3::text, $4)::text AS rt_enc`,
      [
        accessToken,
        config.supabasePgpEncryptKey,
        refreshToken || "",
        config.supabasePgpEncryptKey,
      ],
    );
    const { at_enc: atEnc, rt_enc: rtEnc } = encRow.rows[0];

    await pool.query(
      `INSERT INTO tasks.oauth_tokens
         (user_id, access_token_encrypted, refresh_token_encrypted, expires_at, scope)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
         expires_at = EXCLUDED.expires_at,
         scope = EXCLUDED.scope,
         revoked_at = NULL,
         updated_at = now()`,
      [
        userId,
        atEnc,
        refreshToken ? rtEnc : null,
        new Date(Date.now() + (expiresIn || 3600) * 1000),
        scope || TASKS_SCOPE,
      ],
    );

    // Audit: token issued (event_type='token_refreshed' is the closest match in CHECK list)
    await pool
      .query(
        `INSERT INTO tasks.sync_log (user_id, cycle_id, event_type, details)
         VALUES ($1, $2, 'token_refreshed', $3::jsonb)`,
        [
          userId,
          crypto.randomUUID(),
          JSON.stringify({ scope: scope || TASKS_SCOPE, has_refresh_token: !!refreshToken }),
        ],
      )
      .catch(() => {});
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "token_persist_failed",
      message: err.message,
    });
  }

  const base = (config.frontendBaseUrl || "").replace(/\/$/, "");
  return res.redirect(`${base}/hub/tareas?connected=1`);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /revoke — Bearer JWT; revoke at Google and soft-mark in oauth_tokens
// ─────────────────────────────────────────────────────────────────────────────
router.post("/revoke", requireUser(), async (req, res) => {
  if (!config.supabasePgpEncryptKey) {
    return res.status(503).json({ ok: false, error: "pgp_key_not_configured" });
  }
  const pool = getTasksPool(config.databaseUrl);
  if (!pool) {
    return res.status(503).json({ ok: false, error: "db_not_configured" });
  }

  const userId = req.user.id;

  try {
    const tokenRow = await pool.query(
      `SELECT access_token_encrypted
         FROM tasks.oauth_tokens
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );

    if (tokenRow.rows.length) {
      const decRow = await pool.query(
        `SELECT pgp_sym_decrypt($1::bytea, $2)::text AS token`,
        [tokenRow.rows[0].access_token_encrypted, config.supabasePgpEncryptKey],
      );
      const token = decRow.rows[0]?.token;
      if (token) {
        try {
          await fetch(
            `${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`,
            { method: "POST" },
          );
        } catch {
          // Google revoke is best-effort — we still mark revoked_at locally
        }
      }
    }

    await pool.query(
      `UPDATE tasks.oauth_tokens
          SET revoked_at = now(), updated_at = now()
        WHERE user_id = $1`,
      [userId],
    );

    await pool
      .query(
        `INSERT INTO tasks.sync_log (user_id, cycle_id, event_type, details)
         VALUES ($1, $2, 'token_revoked', $3::jsonb)`,
        [userId, crypto.randomUUID(), JSON.stringify({ revoked_by: "user" })],
      )
      .catch(() => {});

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "revoke_failed",
      message: err.message,
    });
  }
});

export default router;
