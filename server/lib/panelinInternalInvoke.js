/**
 * Invocación segura de tools Panelin interno — solo IDs del catálogo + RBAC.
 */
import { canAccessDashboardRoute, roleMeetsMin } from "./panelinInternalRbac.js";
import { PANELIN_INTERNAL_TOOLS } from "./panelinInternalToolCatalog.js";

/** @typedef {import('./panelinInternalRbac.js').PanelinRole} PanelinRole */

const TOOLS_BY_ID = new Map(PANELIN_INTERNAL_TOOLS.map((t) => [t.id, t]));

/** @param {string} id */
export function getInternalToolById(id) {
  return TOOLS_BY_ID.get(String(id || "").trim()) || null;
}

/**
 * @param {PanelinRole} role
 * @param {{ id: string, method: string, path: string, min_role?: PanelinRole }} tool
 */
export function mayInvokeTool(role, tool) {
  const minRole = /** @type {PanelinRole} */ (tool.min_role || "ventas");
  if (!roleMeetsMin(role, minRole)) {
    return { ok: false, error: "Forbidden: role below tool minimum", status: 403 };
  }
  if (String(tool.path || "").startsWith("/api/")) {
    const { allowed } = canAccessDashboardRoute(tool.method, tool.path, role);
    if (!allowed) {
      return { ok: false, error: "Forbidden: dashboard policy denies this route for role", status: 403 };
    }
  }
  return { ok: true };
}
