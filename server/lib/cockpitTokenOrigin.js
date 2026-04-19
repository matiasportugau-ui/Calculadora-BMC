/**
 * Strict allowlist for GET /api/crm/cockpit-token (browser-only; blocks curl/scripts without Origin).
 * Keep policy in one place for audits. Optional extras: COCKPIT_TOKEN_ALLOWED_ORIGINS (comma-separated).
 */

function trimOriginList(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function tryParseOriginFromReferer(referer) {
  const r = String(referer || "").trim();
  if (!r) return "";
  try {
    const u = new URL(r);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}

/** Exact origins always permitted (dev + production SPA). */
function baseAllowedOrigins(config) {
  const set = new Set([
    "https://calculadora-bmc.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
  ]);
  for (const extra of trimOriginList(process.env.COCKPIT_TOKEN_ALLOWED_ORIGINS)) {
    try {
      const u = new URL(extra);
      set.add(`${u.protocol}//${u.host}`);
    } catch {
      /* skip invalid */
    }
  }
  try {
    const u = new URL(config.publicBaseUrl);
    set.add(`${u.protocol}//${u.host}`);
  } catch {
    /* ignore */
  }
  return set;
}

/**
 * Vercel preview URLs for this project look like calculadora-bmc-git-…-matprompts-projects.vercel.app
 * (not arbitrary *.vercel.app).
 */
function isBmcVercelPreviewHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (h === "calculadora-bmc.vercel.app") return true;
  if (!h.endsWith(".vercel.app")) return false;
  return h.startsWith("calculadora-bmc-");
}

/**
 * @param {string} origin — candidate browser origin (scheme + host + port)
 * @param {{ publicBaseUrl: string }} config
 */
export function isCockpitTokenBrowserOriginAllowed(origin, config) {
  const o = String(origin || "").trim();
  if (!o) return false;
  let u;
  try {
    u = new URL(o);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;

  const allowed = baseAllowedOrigins(config);
  if (allowed.has(o)) return true;

  if (u.protocol === "https:" && isBmcVercelPreviewHost(u.hostname)) return true;

  try {
    const api = new URL(config.publicBaseUrl);
    if (u.protocol === api.protocol && u.hostname === api.hostname) return true;
  } catch {
    /* ignore */
  }

  return false;
}

/**
 * @param {import('express').Request} req
 * @param {{ publicBaseUrl: string }} config
 */
export function getCockpitTokenRequestBrowserOrigin(req, config) {
  const fromHeader = String(req.headers.origin || "").trim();
  if (fromHeader && isCockpitTokenBrowserOriginAllowed(fromHeader, config)) {
    return fromHeader;
  }
  const fromReferer = tryParseOriginFromReferer(req.headers.referer);
  if (fromReferer && isCockpitTokenBrowserOriginAllowed(fromReferer, config)) {
    return fromReferer;
  }
  return "";
}
