/**
 * Doom-loop guard — IMP-PEA-04b (in-process session window).
 */

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_SAME_TOOL = 5;

/** @type {Map<string, { tool: string, count: number, windowStart: number }>} */
const _sessions = new Map();

/**
 * @param {string} sessionKey
 * @param {string} tool
 * @param {{ windowMs?: number, maxSameTool?: number }} [opts]
 */
export function checkDoomLoop(sessionKey, tool, opts = {}) {
  if (!sessionKey || !tool) return { ok: true };
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const maxSameTool = opts.maxSameTool ?? DEFAULT_MAX_SAME_TOOL;
  const now = Date.now();
  const prev = _sessions.get(sessionKey);
  if (!prev || prev.tool !== tool || now - prev.windowStart > windowMs) {
    _sessions.set(sessionKey, { tool, count: 1, windowStart: now });
    return { ok: true };
  }
  prev.count += 1;
  if (prev.count > maxSameTool) {
    return { ok: false, error: "doom_loop_detected", tool, count: prev.count, window_ms: windowMs };
  }
  return { ok: true, count: prev.count };
}

/** Test helper */
export function resetDoomLoopSessions() {
  _sessions.clear();
}
