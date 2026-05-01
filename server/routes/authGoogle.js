// ═══════════════════════════════════════════════════════════════════════════
// server/routes/authGoogle.js — Validate a Google access token server-side
// against the OIDC userinfo endpoint and return the user payload.
// No DB write yet — meant as the trust anchor for client-side identity.
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";

const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

const router = express.Router();

router.post("/auth/google", async (req, res) => {
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
