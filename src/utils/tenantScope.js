// One namespace per tenant. BMC stays on its historical keys.
// Never read or write another tenant's prefix.
import { WHITELABEL, WHITELABEL_BRAND } from "../config/whitelabel.js";

export function tenantSlug() {
  return WHITELABEL || null;
}

export function tenantBrandName() {
  return WHITELABEL_BRAND?.marca || (WHITELABEL ? String(WHITELABEL) : "BMC");
}

/** Storage key isolated to this deploy. BMC callers pass their old literal key. */
export function tenantStorageKey(leaf) {
  const slug = tenantSlug();
  if (!slug) return null;
  return `tenant:${slug}:${leaf}`;
}

export function isForeignTenantKey(key) {
  const k = String(key || "");
  if (!k.startsWith("tenant:")) return false;
  const slug = tenantSlug();
  if (!slug) return true;
  return !k.startsWith(`tenant:${slug}:`);
}

export function readScopedItem(leaf, legacyKey) {
  if (typeof localStorage === "undefined") return null;
  const scoped = tenantStorageKey(leaf);
  if (scoped) {
    const v = localStorage.getItem(scoped);
    if (v != null) return v;
    if (legacyKey && !isForeignTenantKey(legacyKey)) return localStorage.getItem(legacyKey);
    return null;
  }
  return legacyKey ? localStorage.getItem(legacyKey) : null;
}

export function writeScopedItem(leaf, value, legacyKey) {
  if (typeof localStorage === "undefined") return;
  const scoped = tenantStorageKey(leaf);
  const key = scoped || legacyKey;
  if (!key || isForeignTenantKey(key)) return;
  localStorage.setItem(key, value);
}

export function removeScopedItem(leaf, legacyKey) {
  if (typeof localStorage === "undefined") return;
  const scoped = tenantStorageKey(leaf);
  if (scoped) localStorage.removeItem(scoped);
  if (!scoped && legacyKey) localStorage.removeItem(legacyKey);
}
