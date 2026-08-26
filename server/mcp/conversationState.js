/**
 * In-memory calcState per MCP conversation/session.
 * Cloud Run multi-instance: state is best-effort (sticky not guaranteed).
 *
 * Store keys MUST be server-generated (see routes/mcp.js). Never key by
 * client-supplied X-Conversation-Id — holders of the shared bearer could
 * hitch onto another conversation's quote state.
 */

const TTL_MS = 60 * 60 * 1000; // 1h
const store = new Map();

/** Keys that must never be copied from untrusted objects into calcState. */
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function now() {
  return Date.now();
}

function touch(entry) {
  entry.expiresAt = now() + TTL_MS;
  return entry;
}

function prune() {
  const t = now();
  for (const [k, v] of store) {
    if (v.expiresAt < t) store.delete(k);
  }
}

/**
 * Copy own enumerable props from source → target, skipping prototype-pollution keys.
 * Avoids Object.assign with user-controlled property names (CodeQL js/remote-property-injection).
 * @param {Record<string, unknown>} target
 * @param {unknown} source
 */
export function safeAssignCalcState(target, source) {
  if (!target || typeof target !== "object") return target;
  if (!source || typeof source !== "object" || Array.isArray(source)) return target;
  for (const key of Object.keys(source)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    target[key] = source[key];
  }
  return target;
}

/**
 * @param {string} sessionKey — required server-owned id (UUID)
 * @returns {object} mutable calcState
 */
export function getCalcState(sessionKey) {
  const key = String(sessionKey ?? "").trim();
  if (!key) {
    throw new TypeError("getCalcState: sessionKey is required (server-generated)");
  }
  prune();
  let entry = store.get(key);
  if (!entry) {
    entry = { state: Object.create(null), expiresAt: now() + TTL_MS };
    store.set(key, entry);
  } else {
    touch(entry);
  }
  return entry.state;
}

/**
 * Replace or merge calcState for a session.
 * @param {string} sessionKey
 * @param {object} next
 * @param {{ replace?: boolean }} [opts]
 */
export function setCalcState(sessionKey, next, opts = {}) {
  const key = String(sessionKey ?? "").trim();
  if (!key) {
    throw new TypeError("setCalcState: sessionKey is required (server-generated)");
  }
  const current = getCalcState(key);
  if (opts.replace) {
    for (const k of Object.keys(current)) delete current[k];
  }
  safeAssignCalcState(current, next);
  return current;
}

/**
 * Optional client metadata for logging only — NOT used as calcState store key.
 * @returns {string|undefined}
 */
export function conversationMetaFromReq(req) {
  const hdr =
    req?.headers?.["x-conversation-id"] ||
    req?.headers?.["x-elevenlabs-conversation-id"];
  if (hdr) return String(hdr);
  return undefined;
}

/**
 * @deprecated Do not use for calcState store keys — client-chosen headers enable
 * cross-conversation hitchhiking. Prefer randomUUID() per MCP initialize.
 * Kept for tests / callers that need a stable label from headers.
 */
export function sessionKeyFromReq(req, transportSessionId) {
  const meta = conversationMetaFromReq(req);
  if (meta) return meta;
  const sid = req?.headers?.["mcp-session-id"];
  if (sid) return String(sid);
  if (transportSessionId) return String(transportSessionId);
  return undefined;
}

/** Test helper */
export function _resetConversationStateForTests() {
  store.clear();
}
