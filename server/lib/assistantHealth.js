/**
 * AI Assistant Control Plane — health monitor
 *
 * Aggregates, for every assistant in the registry: whether it is enabled, whether
 * its dependencies are healthy, and which LLM providers are available to serve it.
 * Reuses existing internals (registry deps + getAvailableProviders) rather than
 * making HTTP round-trips to the per-channel /health endpoints.
 *
 * Provider "availability" defaults to API-key presence (zero token cost). A real
 * synthetic ping is expensive and can rate-limit, so it is intentionally NOT done
 * here on every poll; callers that need a live probe can build one behind an
 * explicit opt-in. Results are cached ~30s to keep the status panel cheap to poll.
 *
 * status ∈ live | degraded | disabled | down
 *   live     — enabled, deps ok, primary provider (claude) available
 *   degraded — enabled, deps ok, but only fallback providers available
 *   disabled — not in the active allowlist (expected, not an error)
 *   down     — enabled but deps missing or no providers available at all
 */
import { config } from "../config.js";
import {
  getAvailableProviders,
  getProviderChain,
  DEFAULT_PROVIDER_ORDER,
} from "./aiProviderConfig.js";
import { listAssistants, isAssistantEnabled } from "./assistantRegistry.js";
import { getProviderCooldownState } from "./agentCore.js";

const CACHE_TTL_MS = 30_000;
/** @type {Map<string, { at:number, value:any }>} */
const cache = new Map();

function nowMs() {
  return Date.now();
}

/**
 * Probe a single assistant. Cached ~30s unless `force` is set.
 * @param {string} key
 * @param {{ force?: boolean }} [opts]
 */
export async function checkAssistant(key, opts = {}) {
  const cached = cache.get(key);
  if (!opts.force && cached && nowMs() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  const assistant = listAssistants().find((a) => a.key === key);
  if (!assistant) {
    return { key, status: "down", enabled: false, detail: "unknown assistant" };
  }

  const enabled = isAssistantEnabled(key);
  const available = getAvailableProviders();
  const chain = getProviderChain();
  const primary = DEFAULT_PROVIDER_ORDER[0]; // "claude"

  // Real provider liveness (not just key presence): agentCore records per-provider
  // failures + the last error reason. Treat a provider as unhealthy when it is in
  // cooldown OR its last failure was a HARD error (400/401/403 = billing/credential
  // — persistent until fixed, unlike transient 429/529/timeout). This is what
  // turns the optimistic "LIVE via claude" badge into the truth (e.g. claude out
  // of credits → degraded, serving via gemini).
  const cooldowns = getProviderCooldownState();
  const isHardError = (le) => !!(le && [400, 401, 403].includes(Number(le.status)));
  const providerUnhealthy = (p) => {
    const c = cooldowns[p];
    return !!(c && (c.coolingDown || isHardError(c.lastError)));
  };
  // The provider that would actually serve: first available one that isn't
  // unhealthy; else the first available (even if unhealthy); else none.
  const activeProvider =
    chain.find((p) => available.includes(p) && !providerUnhealthy(p)) ||
    chain.find((p) => available.includes(p)) ||
    null;

  // Dependency probe (cheap, side-effect-free). Assistants without deps pass.
  let deps = { ok: true, detail: "" };
  if (typeof assistant.deps === "function") {
    try {
      deps = await assistant.deps();
    } catch (err) {
      deps = { ok: false, detail: `dep probe threw: ${String(err?.message).slice(0, 60)}` };
    }
  }

  let status;
  let detail = "";
  if (!enabled) {
    status = "disabled";
  } else if (!deps.ok || available.length === 0) {
    status = "down";
    detail = !deps.ok ? deps.detail : "no AI providers available (no keys)";
  } else if (!available.includes(primary) || providerUnhealthy(primary)) {
    status = "degraded";
    if (!available.includes(primary)) {
      detail = `primary provider '${primary}' unavailable; serving via '${activeProvider}'`;
    } else {
      const le = cooldowns[primary]?.lastError;
      const reason = le
        ? `${le.status ?? "err"}${le.detail ? `: ${String(le.detail).slice(0, 90)}` : ""}`
        : "in cooldown";
      detail = `primary '${primary}' failing (${reason}); serving via '${activeProvider}'`;
    }
  } else {
    status = "live";
  }

  const value = {
    key: assistant.key,
    label: assistant.label,
    channel: assistant.channel,
    enabled,
    status,
    activeProvider: enabled && status !== "down" ? activeProvider : null,
    providersAvailable: available,
    // Real provider liveness (not just key presence): which providers agentCore
    // has deprioritized after repeated failures. Answers "why is ml on gemini?"
    providerCooldowns: getProviderCooldownState(),
    fallbackTo: assistant.fallbackTo,
    deps,
    detail,
    lastCheckedAt: new Date(nowMs()).toISOString(),
  };
  cache.set(key, { at: nowMs(), value });
  return value;
}

/**
 * Probe every assistant + a provider summary. Runs probes concurrently.
 * @param {{ force?: boolean }} [opts]
 */
export async function checkAllAssistants(opts = {}) {
  const assistants = await Promise.all(
    listAssistants().map((a) => checkAssistant(a.key, opts)),
  );
  return {
    generatedAt: new Date(nowMs()).toISOString(),
    active: config.assistantsActive,
    providers: {
      available: getAvailableProviders(),
      chain: getProviderChain(),
      order: DEFAULT_PROVIDER_ORDER,
      // Real liveness per provider (cooldown + last failure reason) so the panel
      // can show WHY the primary isn't serving, not just an optimistic badge.
      cooldowns: getProviderCooldownState(),
    },
    assistants,
  };
}

/** Test seam. */
export function _clearAssistantHealthCache() {
  cache.clear();
}
