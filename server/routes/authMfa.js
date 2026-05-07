// ═══════════════════════════════════════════════════════════════════════════
// server/routes/authMfa.js — TOTP MFA enroll / verify / disable
// ───────────────────────────────────────────────────────────────────────────
// Self-service MFA endpoints for already-authenticated users (Bearer access
// JWT). Persistence: identity.mfa_secrets and identity.users.mfa_required (see
// supabase/migrations/20260601000004_identity_mfa.sql).
//
// Mounted under /api so the public paths are:
//   POST /api/auth/mfa/enroll   (requireUser) → { secret, provisioning_uri }
//   POST /api/auth/mfa/verify   (requireUser, { code }) → activates MFA
//   POST /api/auth/mfa/disable  (requireUser, { code }) → tears MFA down
//
// Integration with the login flow (gating access JWT minting on a verified
// challenge) is intentionally NOT in this PR — it requires the matching UI
// and would risk locking out admins until the SPA ships. With this PR alone,
// users can enroll and self-disable, and the mfa_required flag is set per
// user without yet being read by verifyGoogleAndUpsert.
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import rateLimit from "express-rate-limit";
import { requireUser, createSessionForUser } from "../lib/identityAuth.js";
import {
  generateSecret,
  buildProvisioningUri,
  verifyCode,
  encryptSecret,
  decryptSecret,
  verifyMfaChallengeToken,
} from "../lib/mfaTotp.js";
import { safeErr as _safeErr } from "../lib/safeErr.js";

let _pool = null;
let _logger = null;

export function initAuthMfa({ pool, logger = console } = {}) {
  _pool = pool;
  _logger = logger;
}

const router = express.Router();

// 10 attempts / 15min / IP — keeps brute force on /verify out of reach
// without making legitimate enroll retries painful.
const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "rate_limited", retryAfterSec: 60 },
});

// Test surface: integration tests share a single Express server across
// describe blocks and would otherwise exhaust the IP bucket after ~10
// requests. resetMfaRateLimit() lets the test suite drop the bucket between
// cases without exposing the limiter internals.
export const __test__ = {
  resetMfaRateLimit() {
    if (typeof mfaLimiter.resetKey === "function") {
      // Reset the most common keys we hit in tests/local dev.
      for (const ip of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) {
        try { mfaLimiter.resetKey(ip); } catch { /* noop */ }
      }
    }
  },
};

function requirePool(res) {
  if (!_pool) {
    res.status(500).json({ ok: false, error: "mfa_not_initialized" });
    return false;
  }
  return true;
}

function logger() {
  return _logger || console;
}

// ─── POST /auth/mfa/enroll ─────────────────────────────────────────────
// Generates a fresh secret for the calling user. If the user already has a
// verified secret (enabled_at is not null), returns 409 — they must disable
// first. If the user has a pending (un-verified) row, the secret is rotated
// in place so an aborted enroll never wedges the account.
router.post("/auth/mfa/enroll", mfaLimiter, requireUser(), async (req, res) => {
  if (!requirePool(res)) return;
  try {
    const userId = req.user.id;
    const email = req.user.email;

    const existing = await _pool.query(
      `select user_id, enabled_at from identity.mfa_secrets where user_id = $1`,
      [userId],
    );
    if (existing.rows.length && existing.rows[0].enabled_at) {
      return res.status(409).json({ ok: false, error: "mfa_already_enrolled" });
    }

    const secret = generateSecret();
    const encrypted = encryptSecret(secret);

    await _pool.query(
      `insert into identity.mfa_secrets (user_id, totp_secret_encrypted, enabled_at)
       values ($1, $2, null)
       on conflict (user_id) do update
         set totp_secret_encrypted = excluded.totp_secret_encrypted,
             enabled_at            = null,
             updated_at            = now()`,
      [userId, encrypted],
    );

    const provisioning_uri = buildProvisioningUri({
      secret,
      accountLabel: email || userId,
    });

    return res.json({ ok: true, secret, provisioning_uri });
  } catch (e) {
    logger().error?.({ err: e }, "[authMfa] enroll failed");
    return res.status(500).json({ ok: false, error: _safeErr(e) || "enroll_failed" });
  }
});

// ─── POST /auth/mfa/verify ─────────────────────────────────────────────
// Body: { code }. Verifies the TOTP code against the stored secret. On a
// successful verify of a *pending* row → sets enabled_at and flips
// users.mfa_required=true. On a verify of an already-enabled row → just
// updates last_used_at (idempotent re-check after the fact).
router.post("/auth/mfa/verify", mfaLimiter, requireUser(), async (req, res) => {
  if (!requirePool(res)) return;
  try {
    const userId = req.user.id;
    const code = String(req.body?.code || "").trim();
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ ok: false, error: "code_invalid_format" });
    }

    const row = await _pool.query(
      `select totp_secret_encrypted, enabled_at
         from identity.mfa_secrets
        where user_id = $1`,
      [userId],
    );
    if (!row.rows.length) {
      return res.status(404).json({ ok: false, error: "mfa_not_enrolled" });
    }

    let secret;
    try {
      secret = decryptSecret(row.rows[0].totp_secret_encrypted);
    } catch (e) {
      logger().error?.({ err: e, userId }, "[authMfa] decrypt failed");
      return res.status(500).json({ ok: false, error: "mfa_storage_corrupt" });
    }

    if (!verifyCode({ secret, code })) {
      return res.status(401).json({ ok: false, error: "code_invalid" });
    }

    const wasPending = row.rows[0].enabled_at == null;

    if (wasPending) {
      await _pool.query("BEGIN");
      try {
        await _pool.query(
          `update identity.mfa_secrets
              set enabled_at = now(),
                  last_used_at = now()
            where user_id = $1`,
          [userId],
        );
        await _pool.query(
          `update identity.users set mfa_required = true where user_id = $1`,
          [userId],
        );
        await _pool.query(
          `insert into identity.audit_log (actor_user_id, actor_kind, action, resource, resource_id, payload)
           values ($1, 'user', 'mfa.enabled', 'identity.mfa_secrets', $1::text, '{}'::jsonb)`,
          [userId],
        );
        await _pool.query("COMMIT");
      } catch (txErr) {
        try { await _pool.query("ROLLBACK"); } catch { /* ignore */ }
        throw txErr;
      }
    } else {
      await _pool.query(
        `update identity.mfa_secrets set last_used_at = now() where user_id = $1`,
        [userId],
      );
    }

    return res.json({ ok: true, enabled: true, was_pending: wasPending });
  } catch (e) {
    logger().error?.({ err: e }, "[authMfa] verify failed");
    return res.status(500).json({ ok: false, error: _safeErr(e) || "verify_failed" });
  }
});

// ─── POST /auth/mfa/disable ────────────────────────────────────────────
// Body: { code }. Tears down MFA for the calling user. Requires a valid
// fresh TOTP code (not just the access JWT) so a stolen session token alone
// cannot disable the second factor. Deletes the mfa_secrets row and clears
// users.mfa_required.
router.post("/auth/mfa/disable", mfaLimiter, requireUser(), async (req, res) => {
  if (!requirePool(res)) return;
  try {
    const userId = req.user.id;
    const code = String(req.body?.code || "").trim();
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ ok: false, error: "code_invalid_format" });
    }

    const row = await _pool.query(
      `select totp_secret_encrypted, enabled_at
         from identity.mfa_secrets
        where user_id = $1`,
      [userId],
    );
    if (!row.rows.length || !row.rows[0].enabled_at) {
      return res.status(404).json({ ok: false, error: "mfa_not_enrolled" });
    }

    let secret;
    try {
      secret = decryptSecret(row.rows[0].totp_secret_encrypted);
    } catch (e) {
      logger().error?.({ err: e, userId }, "[authMfa] decrypt failed");
      return res.status(500).json({ ok: false, error: "mfa_storage_corrupt" });
    }

    if (!verifyCode({ secret, code })) {
      return res.status(401).json({ ok: false, error: "code_invalid" });
    }

    await _pool.query("BEGIN");
    try {
      await _pool.query(`delete from identity.mfa_secrets where user_id = $1`, [userId]);
      await _pool.query(
        `update identity.users set mfa_required = false where user_id = $1`,
        [userId],
      );
      await _pool.query(
        `insert into identity.audit_log (actor_user_id, actor_kind, action, resource, resource_id, payload)
         values ($1, 'user', 'mfa.disabled', 'identity.mfa_secrets', $1::text, '{}'::jsonb)`,
        [userId],
      );
      await _pool.query("COMMIT");
    } catch (txErr) {
      try { await _pool.query("ROLLBACK"); } catch { /* ignore */ }
      throw txErr;
    }

    return res.json({ ok: true, disabled: true });
  } catch (e) {
    logger().error?.({ err: e }, "[authMfa] disable failed");
    return res.status(500).json({ ok: false, error: _safeErr(e) || "disable_failed" });
  }
});

// ─── POST /auth/mfa/challenge ──────────────────────────────────────────
// Body: { mfa_token, code }. The mfa_token is the short-lived JWT returned
// by POST /auth/google when users.mfa_required=true. On a valid TOTP code
// the route mints a real session via createSessionForUser — same shape as
// the no-MFA login response, so the SPA can finalize login uniformly.
//
// 401: token invalid/expired or wrong code.
// 403: user has no enabled MFA secret (shouldn't happen in practice — see
//      invariant in authMfa.js header — but guarded so a manually-flipped
//      mfa_required without enrollment can't lock anyone into a soft brick).
router.post("/auth/mfa/challenge", mfaLimiter, async (req, res) => {
  if (!requirePool(res)) return;
  try {
    const mfaToken = String(req.body?.mfa_token || "").trim();
    const code = String(req.body?.code || "").trim();
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ ok: false, error: "code_invalid_format" });
    }

    let userId;
    try {
      ({ userId } = verifyMfaChallengeToken(mfaToken));
    } catch (e) {
      return res.status(e.status || 401).json({ ok: false, error: e.message || "mfa_token_invalid" });
    }

    const row = await _pool.query(
      `select totp_secret_encrypted, enabled_at
         from identity.mfa_secrets
        where user_id = $1`,
      [userId],
    );
    if (!row.rows.length || !row.rows[0].enabled_at) {
      return res.status(403).json({ ok: false, error: "mfa_not_enrolled" });
    }

    let secret;
    try {
      secret = decryptSecret(row.rows[0].totp_secret_encrypted);
    } catch (e) {
      logger().error?.({ err: e, userId }, "[authMfa] challenge decrypt failed");
      return res.status(500).json({ ok: false, error: "mfa_storage_corrupt" });
    }

    if (!verifyCode({ secret, code })) {
      return res.status(401).json({ ok: false, error: "code_invalid" });
    }

    await _pool.query(
      `update identity.mfa_secrets set last_used_at = now() where user_id = $1`,
      [userId],
    );
    await _pool.query(
      `insert into identity.audit_log (actor_user_id, actor_kind, action, resource, resource_id, payload)
       values ($1, 'user', 'auth.mfa_challenge_passed', 'identity.mfa_secrets', $1::text, '{}'::jsonb)`,
      [userId],
    );

    const result = await createSessionForUser({
      userId,
      ip: req.ip,
      userAgent: req.get?.("user-agent") || null,
      source: "mfa_challenge",
    });

    return res.json(result);
  } catch (e) {
    logger().error?.({ err: e }, "[authMfa] challenge failed");
    return res.status(500).json({ ok: false, error: _safeErr(e) || "challenge_failed" });
  }
});

export default router;
