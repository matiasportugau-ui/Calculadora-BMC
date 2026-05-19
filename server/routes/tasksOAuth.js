// ═══════════════════════════════════════════════════════════════════════════
// server/routes/tasksOAuth.js — Tareas (Tasks) OAuth PKCE flow
// ───────────────────────────────────────────────────────────────────────────
// Separate from identity.authGoogle (which handles user login).
// This flow obtains a Google Tasks API access_token via authorization-code
// grant with PKCE challenge/verifier.
//
// Routes:
//   GET    /auth/tasks/init               — Initiate PKCE flow (challenge + state)
//   GET    /auth/tasks/callback?code=X   — Exchange authorization code for tokens
//   POST   /auth/tasks/revoke             — Revoke access (requires Bearer JWT)
//
// Phase 0: Stub only (no business logic).
// Phase 1: Implement PKCE challenge/verifier, state nonce persistence, token
//          exchange, encryption, and refresh flow.
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import { requireUser } from "../lib/identityAuth.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/tasks/init
// Initiate PKCE flow: generate challenge, state nonce; redirect to Google
// ─────────────────────────────────────────────────────────────────────────────
router.get("/init", async (req, res) => {
  // TODO Phase 1:
  //   1) Generate PKCE verifier (43-128 random chars)
  //   2) Compute challenge = Base64url(SHA256(verifier))
  //   3) Generate state nonce (crypto.randomBytes)
  //   4) Upsert tasks.oauth_state(user_id, state_nonce, challenge, expires_at)
  //   5) Build Google OAuth URL with client_id, challenge, state, scopes
  //   6) 302 redirect to Google consent screen
  res.status(302).json({
    ok: false,
    error: "not_implemented",
    message: "Phase 1: OAuth flow to be implemented",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/tasks/callback?code=X&state=Y
// Exchange authorization code for access_token + refresh_token
// ─────────────────────────────────────────────────────────────────────────────
router.get("/callback", async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // TODO Phase 1:
  //   1) Handle error responses from Google (user denied, etc)
  //   2) Validate state nonce against tasks.oauth_state
  //   3) Retrieve verifier from oauth_state (matching state_nonce)
  //   4) POST to Google token endpoint with code, client_id, client_secret, verifier
  //   5) Extract access_token, refresh_token, expires_in
  //   6) Encrypt both tokens with pgp_sym_encrypt(token, encryption_key)
  //   7) Upsert tasks.oauth_tokens(user_id, access_token_encrypted, refresh_token_encrypted, expires_at)
  //   8) Optionally: trigger immediate sync via /sync/google-tasks/pull
  //   9) Redirect to frontend with success flag (or error)
  //   10) Log in tasks.sync_log(event_type='token_refreshed', user_id)

  if (error) {
    return res.status(400).json({
      ok: false,
      error,
      error_description,
    });
  }

  res.status(200).json({
    ok: false,
    error: "not_implemented",
    message: "Phase 1: Token exchange to be implemented",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/tasks/revoke
// Revoke Tasks API access (requires Bearer JWT)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/revoke", requireUser, async (req, res) => {
  const userId = req.user.id;

  // TODO Phase 1:
  //   1) Query tasks.oauth_tokens for user_id
  //   2) If found: POST to Google revocation endpoint (with access_token or refresh_token)
  //   3) Mark tasks.oauth_tokens.revoked_at = now()
  //   4) Log in tasks.sync_log(event_type='token_revoked', user_id)
  //   5) Clear any pending mutations in frontend queue (if persistent)
  //   6) Return { ok: true } or { ok: false, error: "not_found" }

  res.json({
    ok: false,
    error: "not_implemented",
    message: "Phase 1: Revocation to be implemented",
  });
});

export default router;
