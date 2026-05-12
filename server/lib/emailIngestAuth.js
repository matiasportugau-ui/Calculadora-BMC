/**
 * Auth for POST /api/crm/ingest-email — machine bridge + optional dedicated secret.
 * Variant B: EMAIL_INGEST_TOKEN when set is accepted; API_AUTH_TOKEN always accepted when configured (migration).
 */
import { extractApiToken } from "./panelinInternalRbac.js";

/**
 * @param {string} token — Bearer / X-Api-Key value (trimmed by caller)
 * @param {{ apiAuthToken?: string, emailIngestToken?: string }} cfg
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
export function resolveEmailIngestAuth(token, cfg) {
  const api = String(cfg?.apiAuthToken || "").trim();
  const ingest = String(cfg?.emailIngestToken || "").trim();
  const t = String(token || "").trim();

  if (!api && !ingest) {
    return {
      ok: false,
      status: 503,
      error: "Email ingest disabled — set API_AUTH_TOKEN or EMAIL_INGEST_TOKEN",
    };
  }
  if (!t) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  if (ingest && t === ingest) return { ok: true };
  if (api && t === api) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}

/**
 * @param {{ apiAuthToken?: string, emailIngestToken?: string }} config
 * @returns {import('express').RequestHandler}
 */
export function makeRequireEmailIngestAuth(config) {
  return function requireEmailIngestAuth(req, res, next) {
    const token = extractApiToken(req);
    const r = resolveEmailIngestAuth(token, config);
    if (r.ok) return next();
    return res.status(r.status).json({ ok: false, error: r.error });
  };
}
