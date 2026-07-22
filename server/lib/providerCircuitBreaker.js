/**
 * B-06 — Provider circuit breaker / cooldown (half-open style).
 *
 * Extracted from agentCore for a clear contract:
 * - After N failures in a window → open (deprioritize for COOLDOWN_MS)
 * - Hard 400/401/403 → long open (HARD_COOLDOWN_MS) on first hit
 * - Never remove a provider from the chain; reorder healthy-first
 * - Success → close (clear state)
 *
 * In-memory per process (Cloud Run instance). Survives via multi-instance
 * only as eventual consistency; each instance self-heals on success.
 */

export const PROVIDER_TIMEOUT_MS = Number(process.env.AGENT_PROVIDER_TIMEOUT_MS) || 30_000;
export const COOLDOWN_MAX_FAILURES = Number(process.env.AGENT_PROVIDER_COOLDOWN_FAILURES) || 3;
export const COOLDOWN_WINDOW_MS = 60_000;
export const COOLDOWN_MS = Number(process.env.AGENT_PROVIDER_COOLDOWN_MS) || 60_000;
export const HARD_COOLDOWN_MS = Number(process.env.AGENT_PROVIDER_HARD_COOLDOWN_MS) || 900_000;
export const HARD_ERROR_STATUSES = new Set([400, 401, 403]);

/** @type {Map<string, { times: number[], until: number, lastError: object|null }>} */
const _providerHealth = new Map();

export function isCoolingDown(provider, now = Date.now()) {
  const rec = _providerHealth.get(provider);
  return !!(rec && rec.until && now < rec.until);
}

/**
 * Reorder chain: healthy first, cooling last. Pinned single-provider chains unchanged.
 * @param {string[]} chain
 * @param {number} [now]
 * @returns {string[]}
 */
export function orderChainByHealth(chain, now = Date.now()) {
  if (!Array.isArray(chain) || chain.length <= 1) return chain || [];
  const healthy = chain.filter((p) => !isCoolingDown(p, now));
  const cooling = chain.filter((p) => isCoolingDown(p, now));
  if (!cooling.length) return chain;
  return [...healthy, ...cooling];
}

export function recordProviderFailure(provider, now = Date.now(), errorInfo = null) {
  const rec = _providerHealth.get(provider) || { times: [], until: 0, lastError: null };
  rec.times = rec.times.filter((t) => now - t < COOLDOWN_WINDOW_MS);
  rec.times.push(now);
  if (errorInfo) rec.lastError = { ...errorInfo, at: now };
  const hard = errorInfo && HARD_ERROR_STATUSES.has(Number(errorInfo.status));
  if (hard) {
    rec.until = Math.max(rec.until, now + HARD_COOLDOWN_MS);
    console.log(JSON.stringify({ event: "provider_cooldown", provider, until_ms: rec.until, hard: true }));
  } else if (rec.times.length >= COOLDOWN_MAX_FAILURES) {
    rec.until = now + COOLDOWN_MS;
    rec.times = [];
    console.log(JSON.stringify({ event: "provider_cooldown", provider, until_ms: rec.until }));
  }
  _providerHealth.set(provider, rec);
}

export function recordProviderSuccess(provider) {
  if (_providerHealth.has(provider)) {
    _providerHealth.set(provider, { times: [], until: 0, lastError: null });
  }
}

export function resetProviderCooldowns() {
  _providerHealth.clear();
}

export function getProviderCooldownState(now = Date.now()) {
  const out = {};
  for (const [p, rec] of _providerHealth.entries()) {
    out[p] = {
      coolingDown: !!(rec.until && now < rec.until),
      until: rec.until || 0,
      recentFailures: rec.times.length,
      lastError: rec.lastError || null,
    };
  }
  return out;
}

/** Test-only. */
export function _resetProviderHealth() {
  _providerHealth.clear();
}
