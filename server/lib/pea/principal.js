/**
 * PEA Principal + authorize() — IMP-PEA-05 (PEA slice).
 */
export const PEA_ACTIONS = {
  GAP_READ: "pea:gap:read",
  ANALYZE: "pea:analyze",
  GRANT_READ: "pea:grant:read",
  GRANT_WRITE: "pea:grant:write",
  IMPLEMENT: "pea:implement",
  REPLAY: "pea:replay",
};

const ROLE_PERMISSIONS = {
  superadmin: new Set(Object.values(PEA_ACTIONS)),
  admin: new Set(Object.values(PEA_ACTIONS)),
  operator: new Set([
    PEA_ACTIONS.GAP_READ,
    PEA_ACTIONS.ANALYZE,
    PEA_ACTIONS.GRANT_READ,
    PEA_ACTIONS.REPLAY,
  ]),
  comprador: new Set(),
};

/**
 * @param {import('express').Request['user']} user
 * @param {import('../../config.js').config} config
 */
export function buildPeaPrincipal(user, config) {
  const role = user?.role || "comprador";
  const base = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.comprador;
  const permissions = new Set(base);
  if (user?.role === "superadmin" || user?.role === "admin") {
    permissions.add(PEA_ACTIONS.GRANT_WRITE);
    permissions.add(PEA_ACTIONS.IMPLEMENT);
  }
  return {
    subject_id: user?.sub || user?.id || user?.email || "anonymous",
    actor_type: user ? "operator" : "customer",
    roles: [role],
    permissions,
    tenant_id: user?.tenant_id || "bmc",
    environment: config.appEnv || "development",
    auth_strength: user ? "jwt" : "none",
    session_id: user?.sid || null,
  };
}

/**
 * Fail-closed authorize for PEA actions.
 * @param {ReturnType<typeof buildPeaPrincipal>} principal
 * @param {string} action
 * @param {{ resourceType?: string, resourceId?: string }} [resource]
 */
export function authorizePea(principal, action, resource = {}) {
  if (!principal || !action) {
    return { allowed: false, reason: "missing_principal_or_action" };
  }
  if (!principal.permissions?.has(action)) {
    return { allowed: false, reason: "permission_denied", action };
  }
  if (action === PEA_ACTIONS.IMPLEMENT && principal.environment === "production") {
    return { allowed: false, reason: "implement_blocked_in_production" };
  }
  return { allowed: true, action, resource };
}

/**
 * Express middleware factory (config from router closure).
 * @param {import('../../config.js').config} config
 * @param {string} action
 */
export function requirePeaAction(config, action) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const principal = buildPeaPrincipal(req.user, config);
    const decision = authorizePea(principal, action, {
      resourceType: req.params?.packetId ? "packet" : "gap",
      resourceId: req.params?.packetId || req.params?.gapId || null,
    });
    if (!decision.allowed) {
      return res.status(403).json({ ok: false, error: "forbidden", reason: decision.reason, action });
    }
    req.peaPrincipal = principal;
    return next();
  };
}
