/**
 * RBAC interno Panelin — roles, jerarquía y políticas por ruta /api (dashboard).
 * Uso: orquestador en app, futuro enforcement en bmcDashboard sin romper SPA hasta activar flag.
 */

/** @typedef {'ventas'|'logistica'|'admin'|'director'} PanelinRole */

export const PANELIN_ROLES = /** @type {const} */ (["ventas", "logistica", "admin", "director"]);

/** Mayor número = más privilegio */
const ROLE_RANK = /** @type {Record<PanelinRole, number>} */ ({
  ventas: 1,
  logistica: 2,
  admin: 3,
  director: 4,
});

/**
 * @param {unknown} raw
 * @returns {PanelinRole|null}
 */
export function normalizePanelinRole(raw) {
  const r = String(raw || "")
    .toLowerCase()
    .trim();
  if (PANELIN_ROLES.includes(/** @type {PanelinRole} */ (r))) return /** @type {PanelinRole} */ (r);
  return null;
}

/**
 * @param {PanelinRole} userRole
 * @param {PanelinRole} minRole
 */
export function roleMeetsMin(userRole, minRole) {
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole];
}

/**
 * Extrae Bearer o X-Api-Key (mismo criterio que otras rutas cockpit).
 * @param {import('express').Request} req
 */
export function extractApiToken(req) {
  const auth = String(req.headers.authorization || "");
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (bearer) return bearer;
  const xKey = String(req.headers["x-api-key"] || "").trim();
  if (xKey) return xKey;
  const qKey = req.query && typeof req.query.key === "string" ? String(req.query.key).trim() : "";
  return qKey || "";
}

/**
 * Valida token de servicio y resuelve rol (header `X-Panelin-Role` o env `PANELIN_SERVICE_DEFAULT_ROLE`).
 * @param {import('express').Request} req
 * @param {{ apiAuthToken?: string }} config
 * @returns {{ ok: true, role: PanelinRole } | { ok: false, status: number, error: string }}
 */
export function resolveInternalServiceActor(req, config) {
  const expected = String(config.apiAuthToken || "").trim();
  if (!expected) {
    return { ok: false, status: 503, error: "API_AUTH_TOKEN not configured" };
  }
  const token = extractApiToken(req);
  if (token !== expected) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const fromHeader = normalizePanelinRole(req.headers["x-panelin-role"]);
  const fromEnv = normalizePanelinRole(process.env.PANELIN_SERVICE_DEFAULT_ROLE);
  const role = fromHeader || fromEnv || "director";
  return { ok: true, role };
}

/**
 * Política mínima por ruta dashboard (path absoluto montado en /api).
 * Si no hay entrada, `getMinRoleForDashboardRoute` devuelve null = sin política declarada (enforcement futuro).
 */
const DASHBOARD_POLICIES = [
  { method: "GET", path: "/api/cotizaciones", minRole: /** @type {PanelinRole} */ ("ventas") },
  { method: "POST", path: "/api/cotizaciones", minRole: /** @type {PanelinRole} */ ("admin") },
  { method: "GET", path: "/api/proximas-entregas", minRole: /** @type {PanelinRole} */ ("logistica") },
  { method: "GET", path: "/api/coordinacion-logistica", minRole: /** @type {PanelinRole} */ ("logistica") },
  { method: "POST", path: "/api/marcar-entregado", minRole: /** @type {PanelinRole} */ ("logistica") },
  { method: "GET", path: "/api/pagos-pendientes", minRole: /** @type {PanelinRole} */ ("admin") },
  { method: "GET", path: "/api/audit", minRole: /** @type {PanelinRole} */ ("admin") },
  { method: "GET", path: "/api/kpi-financiero", minRole: /** @type {PanelinRole} */ ("admin") },
  { method: "GET", path: "/api/kpi-report", minRole: /** @type {PanelinRole} */ ("admin") },
  { method: "GET", path: "/api/metas-ventas", minRole: /** @type {PanelinRole} */ ("admin") },
  { method: "GET", path: "/api/calendario-vencimientos", minRole: /** @type {PanelinRole} */ ("admin") },
  { method: "POST", path: "/api/pagos", minRole: /** @type {PanelinRole} */ ("admin") },
  { method: "GET", path: "/api/ventas", minRole: /** @type {PanelinRole} */ ("ventas") },
  { method: "GET", path: "/api/ventas/tabs", minRole: /** @type {PanelinRole} */ ("ventas") },
  { method: "GET", path: "/api/stock-ecommerce", minRole: /** @type {PanelinRole} */ ("ventas") },
  { method: "GET", path: "/api/stock-kpi", minRole: /** @type {PanelinRole} */ ("ventas") },
  { method: "GET", path: "/api/stock/history", minRole: /** @type {PanelinRole} */ ("admin") },
  { method: "POST", path: "/api/ventas", minRole: /** @type {PanelinRole} */ ("admin") },
  { method: "GET", path: "/api/actualizar-precios-calculadora", minRole: /** @type {PanelinRole} */ ("admin") },
  { method: "POST", path: "/api/matriz/push-pricing-overrides", minRole: /** @type {PanelinRole} */ ("director") },
  { method: "GET", path: "/api/email/panelsim-summary", minRole: /** @type {PanelinRole} */ ("admin") },
  { method: "POST", path: "/api/email/draft-outbound", minRole: /** @type {PanelinRole} */ ("admin") },
];

/**
 * @param {string} method
 * @param {string} path
 * @returns {PanelinRole|null}
 */
export function getMinRoleForDashboardRoute(method, path) {
  const m = String(method || "").toUpperCase();
  const p = String(path || "").split("?")[0];
  const row = DASHBOARD_POLICIES.find((r) => r.method === m && r.path === p);
  return row ? row.minRole : null;
}

/**
 * @param {string} method
 * @param {string} path
 * @param {PanelinRole} userRole
 * @returns {{ allowed: boolean, minRole: PanelinRole|null }}
 */
export function canAccessDashboardRoute(method, path, userRole) {
  const minRole = getMinRoleForDashboardRoute(method, path);
  if (minRole == null) return { allowed: true, minRole: null };
  return { allowed: roleMeetsMin(userRole, minRole), minRole };
}

/**
 * @returns {typeof DASHBOARD_POLICIES}
 */
export function listDashboardPolicies() {
  return [...DASHBOARD_POLICIES];
}
