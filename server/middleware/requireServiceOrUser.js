// ═══════════════════════════════════════════════════════════════════════════
// requireServiceOrUser — explicit, opt-in dual-mode guard.
//
// Accepts EITHER:
//   1) the static API_AUTH_TOKEN (legacy operator/CI calls) → synthesizes
//      req.user = { role: 'service', subject_type: 'service' } with full
//      module access, OR
//   2) a valid identity JWT (Phase B) — but only when the route author
//      explicitly opts in via opts.role / opts.module / opts.minLevel.
//      Without opts, no user JWT is accepted; only the static token.
//
// Why explicit opt-in: the legacy `requireAuth` alias was previously
// service-token-only. Routes that import that alias (interaction-log,
// /agent/voice, /followups, /ml/*, /ml/etl-run) must keep that contract.
// Adding `requireServiceOrUser({...})` at a specific call site is the only
// way to widen authentication, and the route author owns the RBAC choice.
//
// CODEOWNERS guidance: any new use of requireServiceOrUser without role
// or module opts should be reviewed as a security-sensitive change.
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

function _setServicePrincipal(req) {
  req.user = {
    id: "service",
    email: "service@bmc.local",
    role: "service",
    subject_type: "service",
    plan_tier: "plus",
    modules: ALL_MODULES_ADMIN,
    name: "service",
  };
}

function _hasStaticToken(req) {
  const token = config.apiAuthToken;
  if (!token) return false;
  // cursor[bot] round-5 MEDIUM: do NOT accept the token from `?key=` URL
  // query string — it would land in every reverse-proxy, CDN, and browser
  // history log. OWASP API Security §API8. Bearer header and X-Api-Key
  // header are the only supported auth surfaces.
  const bearer = String(req.headers.authorization || "").replace(/^Bearer /, "").trim();
  const xKey = String(req.headers["x-api-key"] || "");
  return bearer === token || xKey === token;
}

/**
 * Opt-in dual-mode guard. Pass opts (role/module/minLevel) to also accept
 * identity JWTs from users meeting those constraints. Pass no opts to behave
 * as a strict service-token guard (equivalent to the legacy requireAuth).
 *
 * `authOnly: true` accepts ANY valid, active identity JWT (no role/module
 * filter) in addition to the static token, and rejects anonymous callers. Use
 * it to close public exposure on routes whose legitimate caller cohorts span
 * different grant types — e.g. `/crm/suggest-response` is reached by ML-cockpit
 * operators (module `canales:read`) AND admin-role cotizaciones users; a single
 * module- or role-scoped guard would 403 one cohort. Tighten to explicit RBAC
 * later once the cohorts' grants are unified. `authOnly` ignores role/module.
 *
 * @param {{role?: string, module?: string, minLevel?: string, optional?: boolean, authOnly?: boolean}} opts
 */
export function requireServiceOrUser(opts = {}) {
  const acceptsUserJwt = !!(opts.role || opts.module || opts.optional || opts.authOnly);
  const userMw = acceptsUserJwt
    ? requireUser(opts.authOnly ? { optional: false } : opts)
    : null;

  return async (req, res, next) => {
    // 1) Static token short-circuit — always honored.
    if (_hasStaticToken(req)) {
      _setServicePrincipal(req);
      return next();
    }

    // 2) If the caller explicitly opted in to user JWTs, fall through.
    if (userMw) return userMw(req, res, next);

    // 3) Otherwise this is a service-token-only route — reject.
    return res
      .status(401)
      .json({ ok: false, error: "service_token_required" });
  };
}

/**
 * Backwards-compat: existing routes import { requireAuth } from this path.
 * Keeps the original token-only contract; no widening to user JWTs.
 */
export const requireAuth = (req, res, next) => {
  if (_hasStaticToken(req)) {
    _setServicePrincipal(req);
    return next();
  }
  // Match original 503/401 semantics: 503 when token isn't configured server-side,
  // 401 when configured but presented credentials don't match.
  if (!config.apiAuthToken) {
    return res.status(503).json({ ok: false, error: "API_AUTH_TOKEN not configured" });
  }
  return res.status(401).json({ ok: false, error: "Unauthorized" });
};

export default requireServiceOrUser;
