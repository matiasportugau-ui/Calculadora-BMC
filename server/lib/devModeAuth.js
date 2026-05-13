/**
 * Shared Panelin “developer mode” HTTP auth (Bearer / X-Api-Key vs API_AUTH_TOKEN).
 * When config.panelinRelaxDevAuth is true (PANELIN_RELAX_DEV_AUTH), checks are skipped —
 * intended only for trusted local/staging development.
 */
import { config } from "../config.js";

/**
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
export function checkDevModeAuthorization(req) {
  if (config.panelinRelaxDevAuth) {
    return { ok: true };
  }
  if (!config.apiAuthToken) {
    return {
      ok: false,
      status: 503,
      error: "API_AUTH_TOKEN not configured — developer mode disabled",
    };
  }
  const auth = String(req.headers.authorization || "");
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const xKey = String(req.headers["x-api-key"] || req.query?.key || "").trim();
  if (bearer === config.apiAuthToken || xKey === config.apiAuthToken) {
    return { ok: true };
  }
  return { ok: false, status: 401, error: "Unauthorized developer mode" };
}

/** Express middleware for /api/agent/train, training-kb, stats, etc. */
export function requireDevModeAuthMiddleware(req, res, next) {
  const r = checkDevModeAuthorization(req);
  if (r.ok) return next();
  return res.status(r.status).json({ ok: false, error: r.error });
}
