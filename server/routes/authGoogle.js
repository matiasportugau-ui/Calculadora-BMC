// ═══════════════════════════════════════════════════════════════════════════
// server/routes/authGoogle.js — Validate a Google access token server-side
// against the OIDC userinfo endpoint and return the user payload.
// No DB write yet — meant as the trust anchor for client-side identity.
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import rateLimit from "express-rate-limit";

const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

const router = express.Router();

// Rate limit: each IP can validate up to 30 access tokens per 15 minutes.
// Real users sign in once per session (token cached client-side ~1h), so
// 30/15min is generous for legitimate flow but blocks credential-stuffing or
// fan-out abuse hitting the Google userinfo endpoint via this proxy.
const authGoogleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "rate_limited", retryAfterSec: 60 },
});

router.post("/auth/google", authGoogleLimiter, async (req, res) => {
  const accessToken = req.body?.accessToken;
  if (!accessToken || typeof accessToken !== "string") {
    return res.status(400).json({ ok: false, error: "Missing body.accessToken (string)" });
  }

  let resp;
  try {
    resp = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: "userinfo fetch failed",
      details: err?.message || String(err),
    });
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    return res.status(401).json({
      ok: false,
      error: `userinfo ${resp.status}`,
      details: body.slice(0, 500),
    });
  }

  const user = await resp.json().catch(() => null);
  if (!user?.sub) {
    return res.status(401).json({ ok: false, error: "Token resolved but no `sub` claim" });
  }

  return res.json({
    ok: true,
    user: {
      sub: user.sub,
      email: user.email,
      emailVerified: user.email_verified,
      name: user.name,
      picture: user.picture,
      locale: user.locale,
    },
  });
});

export default router;
