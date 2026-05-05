// ═══════════════════════════════════════════════════════════════════════════
// server/routes/authGoogle.js — Comprador identity (Google OAuth)
// ───────────────────────────────────────────────────────────────────────────
// Two-tier validation:
//   1) idToken   → google-auth-library verifyIdToken (preferred — signed JWT)
//   2) accessToken → fallback userinfo HTTP roundtrip
//
// On success: upserts identity.users, creates identity.sessions row, sets
// httpOnly refresh cookie, returns access JWT + user payload.
//
// Sibling routes added on the same router:
//   POST /auth/refresh   rotation + reuse detection
//   POST /auth/logout    revokes current session (or all if no cookie)
//   GET  /auth/me        requires Bearer; returns user profile
//   GET  /auth/me/grants requires Bearer; returns role + plan + module map
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import rateLimit from "express-rate-limit";
import { config } from "../config.js";
import {
  verifyGoogleAndUpsert,
  refreshTokens,
  logout,
  requireUser,
  getModuleGrants,
  getRole,
} from "../lib/identityAuth.js";

const router = express.Router();

const COOKIE_NAME = config.identityCookieName || "bmc_sess";
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 3600 * 1000;

// Rate limit: 30 token validations / 15min / IP.
const authGoogleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "rate_limited", retryAfterSec: 60 },
});

// Slightly stricter on refresh — token theft fan-out should hit this wall fast.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "rate_limited", retryAfterSec: 60 },
});

function isProd() {
  return config.appEnv === "production";
}

function setRefreshCookie(res, refreshToken) {
  const opts = {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  };
  if (config.identityCookieDomain) opts.domain = config.identityCookieDomain;
  res.cookie(COOKIE_NAME, refreshToken, opts);
}

function clearRefreshCookie(res) {
  const opts = {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
  };
  if (config.identityCookieDomain) opts.domain = config.identityCookieDomain;
  res.clearCookie(COOKIE_NAME, opts);
}

router.post("/auth/google", authGoogleLimiter, async (req, res) => {
  const { idToken, accessToken } = req.body || {};
  if (!idToken && !accessToken) {
    return res.status(400).json({
      ok: false,
      error: "Missing body.idToken or body.accessToken",
    });
  }

  try {
    const r = await verifyGoogleAndUpsert({
      idToken: typeof idToken === "string" ? idToken : undefined,
      accessToken: typeof accessToken === "string" ? accessToken : undefined,
      ip: req.ip,
      userAgent: req.get("user-agent") || undefined,
    });
    setRefreshCookie(res, r.refreshToken);
    const grants = await getModuleGrants(r.user.id);
    return res.json({
      ok: true,
      user: r.user,
      role: r.role,
      plan_tier: r.plan_tier,
      modules: grants,
      accessToken: r.accessToken,
      accessTokenExpiresIn: r.accessTokenExpiresIn,
    });
  } catch (e) {
    return res
      .status(e.status || 401)
      .json({ ok: false, error: e.message || "auth_failed", detail: e.detail });
  }
});

router.post("/auth/refresh", refreshLimiter, async (req, res) => {
  const refreshToken = req.cookies?.[COOKIE_NAME];
  if (!refreshToken) {
    return res.status(401).json({ ok: false, error: "missing_refresh_cookie" });
  }
  try {
    const r = await refreshTokens({
      refreshToken,
      ip: req.ip,
      userAgent: req.get("user-agent") || undefined,
    });
    setRefreshCookie(res, r.refreshToken);
    const grants = await getModuleGrants(r.user.id);
    return res.json({
      ok: true,
      user: r.user,
      role: r.role,
      plan_tier: r.plan_tier,
      modules: grants,
      accessToken: r.accessToken,
      accessTokenExpiresIn: r.accessTokenExpiresIn,
    });
  } catch (e) {
    if (e.status === 401) clearRefreshCookie(res);
    return res
      .status(e.status || 401)
      .json({ ok: false, error: e.message || "refresh_failed" });
  }
});

router.post("/auth/logout", requireUser({ optional: true }), async (req, res) => {
  try {
    if (req.user) {
      await logout({
        userId: req.user.id,
        sessionId: req.user.sessionId,
        ip: req.ip,
        userAgent: req.get("user-agent") || undefined,
      });
    }
  } catch (e) {
    // ignore — clearing the cookie is the important part
    void e;
  }
  clearRefreshCookie(res);
  return res.json({ ok: true });
});

router.get("/auth/me", requireUser(), async (req, res) => {
  return res.json({
    ok: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture_url,
      avatar_preset: req.user.avatar_preset,
      plan_tier: req.user.plan_tier,
      role: req.user.role,
    },
  });
});

router.get("/auth/me/grants", requireUser(), async (req, res) => {
  try {
    const [role, modules] = await Promise.all([
      getRole(req.user.id),
      getModuleGrants(req.user.id),
    ]);
    return res.json({
      ok: true,
      role,
      plan_tier: req.user.plan_tier,
      modules,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || "grants_failed" });
  }
});

export default router;
