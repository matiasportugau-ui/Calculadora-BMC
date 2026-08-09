/**
 * SideEffectRegistry — IMP-PEA-04 (PEA + core Panelin tools subset).
 */
export const SIDE_EFFECT_REGISTRY = {
  get_calc_state: {
    domain: "calc",
    effect_type: "read",
    risk_level: "R0",
    reversible: true,
    minimum_permission: "calc:read",
    approval_policy: "none",
    allowed_environments: ["development", "staging", "production"],
  },
  calcular_cotizacion: {
    domain: "calc",
    effect_type: "compute",
    risk_level: "R0",
    reversible: true,
    minimum_permission: "calc:read",
    approval_policy: "none",
    allowed_environments: ["development", "staging", "production"],
  },
  guardar_en_crm: {
    domain: "crm",
    effect_type: "write",
    risk_level: "R2",
    reversible: false,
    minimum_permission: "crm:write",
    approval_policy: "user_confirmed",
    allowed_environments: ["development", "staging", "production"],
  },
  enviar_whatsapp_link: {
    domain: "wa",
    effect_type: "external",
    risk_level: "R3",
    reversible: false,
    minimum_permission: "wa:write",
    approval_policy: "user_confirmed",
    allowed_environments: ["staging", "production"],
  },
  pea_explain_gap: {
    domain: "pea",
    effect_type: "read",
    risk_level: "R0",
    reversible: true,
    minimum_permission: "pea:gap:read",
    approval_policy: "none",
    allowed_environments: ["development", "staging", "production"],
  },
};

/**
 * @param {string} toolId
 */
export function getSideEffect(toolId) {
  if (!toolId) return null;
  const key = String(toolId).toLowerCase().split("@")[0];
  return SIDE_EFFECT_REGISTRY[key] || null;
}

/**
 * @param {string} toolId
 */
export function isToolRegistered(toolId) {
  return Boolean(getSideEffect(toolId));
}

/**
 * @param {string} toolId
 * @param {import('../../config.js').config} config
 */
export function assertToolRegistered(toolId, config) {
  if (!config?.peaSideEffectEnforce) return { ok: true, skipped: true };
  const entry = getSideEffect(toolId);
  if (!entry) return { ok: false, error: "tool_unregistered", tool: toolId };
  const env = config.appEnv || "development";
  if (!entry.allowed_environments.includes(env) && env !== "development") {
    return { ok: false, error: "tool_env_denied", tool: toolId, environment: env };
  }
  return { ok: true, entry };
}

export function listRegisteredTools() {
  return Object.keys(SIDE_EFFECT_REGISTRY);
}
