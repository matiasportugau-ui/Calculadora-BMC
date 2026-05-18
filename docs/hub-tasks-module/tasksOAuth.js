// ═══════════════════════════════════════════════════════════════════════════
// server/routes/tasksOAuth.js — Google Tasks OAuth flow (PKCE)
// ───────────────────────────────────────────────────────────────────────────
// Handles OAuth initialization (PKCE challenge), callback exchange,
// and token revocation for Google Tasks API integration.
//
// Routes:
//   GET  /auth/tasks/init     — Generate PKCE challenge + redirect to Google consent
//   GET  /auth/tasks/callback — Exchange auth code + store tokens
//   POST /auth/tasks/revoke   — Revoke access + clear tokens
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import rateLimit from "express-rate-limit";
import { config } from "../config.js";
import { requireUser } from "../lib/identityAuth.js";

const router = express.Router();

// Rate limit: 20 auth inits / 15min / IP.
const authInitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "rate_limited", retryAfterSec: 60 },
});

// Rate limit: 30 token exchanges / 15min / IP.
const callbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "rate_limited", retryAfterSec: 60 },
});

/**
 * GET /auth/tasks/init
 * Initiates Google Tasks OAuth flow via PKCE challenge.
 * Returns redirect URL + stores state + code_verifier for callback.
 */
router.get("/auth/tasks/init", authInitLimiter, requireUser(), async (req, res) => {
  try {
    // TODO: Generate PKCE challenge + state
    // TODO: Store state + code_verifier in identity.tasks_oauth_tokens
    // TODO: Build Google OAuth consent URL
    // TODO: Return { ok: true, authUrl: "https://accounts.google.com/o/oauth2/v2/auth?..." }
    res.status(501).json({ ok: false, error: "not_implemented" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /auth/tasks/callback
 * Receives auth code from Google OAuth redirect.
 * Exchanges code for access_token + refresh_token via PKCE.
 */
router.get("/auth/tasks/callback", callbackLimiter, async (req, res) => {
  try {
    const { code, state } = req.query || {};
    if (!code || !state) {
      return res.status(400).json({ ok: false, error: "Missing code or state" });
    }

    // TODO: Look up state in identity.tasks_oauth_tokens
    // TODO: Retrieve code_verifier for PKCE exchange
    // TODO: Exchange code + code_verifier for tokens via Google API
    // TODO: Store access_token + refresh_token + expires_at in identity.tasks_oauth_tokens
    // TODO: Redirect to frontend /hub/tareas with success/error
    res.status(501).json({ ok: false, error: "not_implemented" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /auth/tasks/revoke
 * Revokes Google Tasks OAuth token and clears local storage.
 * Requires Bearer JWT (authenticated user).
 */
router.post("/auth/tasks/revoke", requireUser(), async (req, res) => {
  try {
    // TODO: Look up identity.tasks_oauth_tokens for user
    // TODO: Call Google revoke endpoint
    // TODO: Set revoked_at timestamp in DB
    // TODO: Return { ok: true }
    res.status(501).json({ ok: false, error: "not_implemented" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
