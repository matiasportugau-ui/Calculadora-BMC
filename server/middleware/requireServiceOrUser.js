// ═══════════════════════════════════════════════════════════════════════════
// requireServiceOrUser — accepts EITHER:
//   1) the static API_AUTH_TOKEN (legacy operator/CI calls) → synthesizes
//      req.user = { role: 'service', subject_type: 'service' } with full
//      module access, OR
//   2) a valid identity JWT (Phase B) for end-user/admin calls.
//
// Lets us decouple UI calls (which migrate to JWT) from CI/cron callers
// (which keep the static token) without two parallel guard stacks.
//
// Drop-in replacement for server/middleware/requireAuth.js — that file now
// re-exports this for backwards compatibility.
// ═══════════════════════════════════════════════════════════════════════════

import { config } from "../config.js";
import { requireUser } from "../lib/identityAuth.js";

const ALL_MODULES_ADMIN = {
  calc: "admin",
  wa: "admin",
  ml: "admin",
  admin: "admin",
  "plan-import": "admin",
  "agent-admin": "admin",
  canales: "admin",
  "crm-personal": "admin",
};

export function requireServiceOrUser(opts = {}) {
  const userMw = requireUser(opts);
  return async (req, res, next) => {
    // 1) Static token short-circuit
    const token = config.apiAuthToken;
    if (token) {
      const bearer = String(req.headers.authorization || "").replace(/^Bearer /, "").trim();
      const xKey = String(req.headers["x-api-key"] || req.query?.key || "");
      if (bearer === token || xKey === token) {
        req.user = {
          id: "service",
          email: "service@bmc.local",
          role: "service",
          subject_type: "service",
          plan_tier: "plus",
          modules: ALL_MODULES_ADMIN,
          name: "service",
        };
        return next();
      }
    }
    // 2) Otherwise fall through to identity JWT (cookie or Bearer JWT).
    return userMw(req, res, next);
  };
}

/** Backwards-compat: existing routes import { requireAuth } from this path. */
export const requireAuth = requireServiceOrUser();

export default requireServiceOrUser;
