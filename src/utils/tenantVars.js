// Personalized variables for the active tenant only.
import { tenantBrandName, tenantSlug, readScopedItem, writeScopedItem } from "./tenantScope.js";

const LEAF = "vars-v1";

export function getTenantVars() {
  if (!tenantSlug()) return {};
  try {
    const raw = readScopedItem(LEAF);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setTenantVars(partial) {
  if (!tenantSlug()) return getTenantVars();
  const next = { ...getTenantVars(), ...(partial && typeof partial === "object" ? partial : {}) };
  writeScopedItem(LEAF, JSON.stringify(next));
  return next;
}

export function getTenantVar(key, fallback = undefined) {
  const v = getTenantVars()[key];
  return v === undefined ? fallback : v;
}

export function tenantVarsLabel() {
  return `Variables de ${tenantBrandName()}`;
}
