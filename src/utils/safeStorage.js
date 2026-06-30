// ═══════════════════════════════════════════════════════════════════════════
// safeStorage — guarded localStorage access.
//
// localStorage throws in private-browsing mode, when the quota is exceeded, or
// when storage is blocked by policy. These helpers never throw: reads fall back
// to a default, writes silently no-op when storage is unavailable.
//
//   import { safeStorage, lsGet, lsSet } from "src/utils/safeStorage.js";
//   const layout = lsGet("bmc.pdfLayout", "simple");
//   lsSet("bmc.pdfLayout", "soft-modern");
// ═══════════════════════════════════════════════════════════════════════════

/** Returns a usable Storage, or null if localStorage is unavailable/blocked. */
export function safeStorage() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const probe = "__bmc_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Reads a key, returning `fallback` if storage is unavailable or the key is unset. */
export function lsGet(key, fallback = null) {
  const store = safeStorage();
  if (!store) return fallback;
  try {
    const v = store.getItem(key);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

/** Writes a key. Returns true on success, false if storage was unavailable. */
export function lsSet(key, value) {
  const store = safeStorage();
  if (!store) return false;
  try {
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
