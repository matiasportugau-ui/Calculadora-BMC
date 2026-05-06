// ═══════════════════════════════════════════════════════════════════════════
// clientQuoteId — stable per-browser identifier used to dedupe and to merge
// anonymous quotes into a user account on first login.
//
// Usage:
//   import { getOrCreateClientQuoteId, getPendingClientQuoteIds, clearPending }
//     from "src/utils/clientQuoteId.js";
//
//   - Generate/retrieve the current id when starting a wizard:
//       const cid = getOrCreateClientQuoteId();
//       fetch("/calc/cotizar/pdf", { body: JSON.stringify({ ...payload, clientQuoteId: cid }) })
//
//   - On login success, claim everything sent so far:
//       const ids = getPendingClientQuoteIds();
//       fetch("/api/me/quotes/claim", { body: JSON.stringify({ clientQuoteIds: ids }) });
//       clearPending();
// ═══════════════════════════════════════════════════════════════════════════

const KEY_LIST = "bmc.client_quote_ids";       // array of all client_quote_ids ever generated
const KEY_CURRENT = "bmc.client_quote_id";     // currently active id (most recent)

function safeStorage() {
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

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `cq_${crypto.randomUUID()}`;
  }
  return `cq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function readList(store) {
  try {
    const raw = store.getItem(KEY_LIST);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeList(store, list) {
  try { store.setItem(KEY_LIST, JSON.stringify(list)); } catch { /* ignore quota */ }
}

/** Returns the current client_quote_id, generating + persisting one on first call. */
export function getOrCreateClientQuoteId() {
  const store = safeStorage();
  if (!store) return generateId();

  const existing = store.getItem(KEY_CURRENT);
  if (existing && typeof existing === "string" && existing.length > 4) {
    return existing;
  }
  const id = generateId();
  store.setItem(KEY_CURRENT, id);
  const list = readList(store);
  if (!list.includes(id)) writeList(store, [...list, id]);
  return id;
}

/** Forces a fresh id (e.g. when the wizard is reset for a brand new quote). */
export function rotateClientQuoteId() {
  const store = safeStorage();
  if (!store) return generateId();
  const id = generateId();
  store.setItem(KEY_CURRENT, id);
  const list = readList(store);
  if (!list.includes(id)) writeList(store, [...list, id]);
  return id;
}

/** All client_quote_ids generated so far in this browser, deduped. */
export function getPendingClientQuoteIds() {
  const store = safeStorage();
  if (!store) return [];
  return readList(store);
}

/** Called after successful claim — drops the pending list (current id stays so
 *  follow-up edits keep landing under the same DB row). */
export function clearPending() {
  const store = safeStorage();
  if (!store) return;
  try { store.removeItem(KEY_LIST); } catch { /* ignore */ }
}

/** Test/reset helper — drops everything. */
export function __resetClientQuoteIdForTests() {
  const store = safeStorage();
  if (!store) return;
  try {
    store.removeItem(KEY_LIST);
    store.removeItem(KEY_CURRENT);
  } catch { /* ignore */ }
}
