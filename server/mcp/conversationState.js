/**
 * In-memory calcState per MCP conversation/session.
 * Cloud Run multi-instance: state is best-effort (sticky not guaranteed).
 */

const TTL_MS = 60 * 60 * 1000; // 1h
const store = new Map();

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
 * @param {string} sessionKey
 * @returns {object} mutable calcState
 */
export function getCalcState(sessionKey) {
  const key = String(sessionKey || "default");
  prune();
  let entry = store.get(key);
  if (!entry) {
    entry = { state: {}, expiresAt: now() + TTL_MS };
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
  const key = String(sessionKey || "default");
  const current = getCalcState(key);
  if (opts.replace) {
    for (const k of Object.keys(current)) delete current[k];
  }
  Object.assign(current, next && typeof next === "object" ? next : {});
  return current;
}

export function sessionKeyFromReq(req, transportSessionId) {
  const hdr =
    req?.headers?.["x-conversation-id"] ||
    req?.headers?.["x-elevenlabs-conversation-id"] ||
    req?.headers?.["mcp-session-id"];
  if (hdr) return String(hdr);
  if (transportSessionId) return String(transportSessionId);
  return "default";
}

/** Test helper */
export function _resetConversationStateForTests() {
  store.clear();
}
