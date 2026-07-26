/**
 * providerReadiness.js — format + circuit + live probe → Ready lights.
 *
 * SDD: docs/sdd/api-key-readiness/SDD.md
 */

import { isUsableApiKey } from "./apiKeyUtils.js";
import {
  PROVIDERS,
  PROVIDER_LABELS,
  DEFAULT_PROVIDER_ORDER,
  getApiKey,
  getAvailableProviders,
} from "./aiProviderConfig.js";
import {
  getProviderCooldownState,
  recordProviderFailure,
  recordProviderSuccess,
  isCoolingDown,
  HARD_ERROR_STATUSES,
} from "./providerCircuitBreaker.js";
import {
  probeProvider,
  mapProbeErrorToReasonCode,
  reasonMessage,
  providerLabel,
} from "./providerProbes.js";

export const PROVIDER_READY_TTL_MS = Number(process.env.PROVIDER_READY_TTL_MS) || 90_000;

/** @type {Map<string, { at: number, value: object }>} */
const cache = new Map();

/**
 * @param {string} key
 * @returns {{ length: number, prefix: string }}
 */
export function keyMeta(key) {
  const k = String(key || "");
  return { length: k.length, prefix: k.slice(0, 6) };
}

/**
 * @param {string} reasonCode
 * @returns {"green"|"amber"|"red"|"gray"}
 */
export function lightForReason(reasonCode, state) {
  if (state === "ready" || reasonCode === "ok") return "green";
  if (state === "unknown" || state === "checking") return state === "checking" ? "amber" : "gray";
  if (reasonCode === "rate_limited" || state === "degraded") return "amber";
  return "red";
}

/**
 * @param {string} provider
 * @param {object} probeResult
 * @param {{ configured: boolean, key: string }} meta
 */
export function buildProviderStatus(provider, probeResult, meta) {
  const configured = !!meta.configured;
  const now = Date.now();
  const checkedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + PROVIDER_READY_TTL_MS).toISOString();

  if (!configured) {
    // Distinguish empty vs placeholder if raw config had something — callers pass reason.
    const reasonCode = meta.reasonCode || "missing_key";
    return {
      id: provider,
      label: providerLabel(provider),
      light: "red",
      state: "not_ready",
      reasonCode,
      reason: reasonMessage(reasonCode),
      configured: false,
      live: false,
      modelProbed: null,
      latencyMs: probeResult?.latencyMs ?? null,
      checkedAt,
      expiresAt,
      keyMeta: keyMeta(meta.key),
    };
  }

  if (probeResult?.ok) {
    return {
      id: provider,
      label: providerLabel(provider),
      light: "green",
      state: "ready",
      reasonCode: "ok",
      reason: reasonMessage("ok"),
      configured: true,
      live: true,
      modelProbed: probeResult.model || null,
      latencyMs: probeResult.latencyMs ?? null,
      checkedAt,
      expiresAt,
      keyMeta: keyMeta(meta.key),
    };
  }

  const reasonCode = probeResult?.reasonCode || "sdk_error";
  const state = reasonCode === "rate_limited" ? "degraded" : "not_ready";
  return {
    id: provider,
    label: providerLabel(provider),
    light: lightForReason(reasonCode, state),
    state,
    reasonCode,
    reason: reasonMessage(reasonCode),
    configured: true,
    live: false,
    modelProbed: probeResult?.model || null,
    latencyMs: probeResult?.latencyMs ?? null,
    checkedAt,
    expiresAt,
    keyMeta: keyMeta(meta.key),
  };
}

/**
 * Apply circuit-breaker hard cooldown as not_ready/cooldown without probing.
 * Soft cooldown (non-hard) → degraded if we have a prior ready cache else probe.
 *
 * @param {string} provider
 * @param {object|null} cached
 */
function statusFromCooldown(provider, cached) {
  const key = getApiKey(provider);
  if (!key) {
    return buildProviderStatus(provider, null, { configured: false, key: "", reasonCode: "missing_key" });
  }
  const cds = getProviderCooldownState()[provider];
  const le = cds?.lastError;
  const hard = le && HARD_ERROR_STATUSES.has(Number(le.status));
  if (cds?.coolingDown && hard) {
    const reasonCode =
      mapProbeErrorToReasonCode({
        status: le.status,
        message: le.detail || le.type || "",
      }) || "cooldown";
    return {
      id: provider,
      label: providerLabel(provider),
      light: "red",
      state: "not_ready",
      reasonCode: reasonCode === "sdk_error" ? "cooldown" : reasonCode,
      reason: reasonMessage(reasonCode === "sdk_error" ? "cooldown" : reasonCode),
      configured: true,
      live: false,
      modelProbed: cached?.modelProbed || null,
      latencyMs: null,
      checkedAt: new Date().toISOString(),
      expiresAt: new Date(cds.until || Date.now()).toISOString(),
      keyMeta: keyMeta(key),
    };
  }
  return null;
}

/**
 * @param {string} provider
 * @param {{ force?: boolean }} [opts]
 */
export async function getProviderReadiness(provider, opts = {}) {
  const force = !!opts.force;
  const key = getApiKey(provider);
  const configured = !!key;

  if (!configured) {
    // If env had a non-empty raw value that failed isUsableApiKey, it's placeholder.
    // We only have getApiKey which already filters — missing covers both empty and placeholder.
    return buildProviderStatus(provider, null, {
      configured: false,
      key: "",
      reasonCode: "missing_key",
    });
  }

  if (!force) {
    const hit = cache.get(provider);
    if (hit && Date.now() - hit.at < PROVIDER_READY_TTL_MS) {
      return hit.value;
    }
  }

  // Hard CB: surface without burning another probe (still allow force)
  if (!force) {
    const fromCb = statusFromCooldown(provider, cache.get(provider)?.value);
    if (fromCb && fromCb.state === "not_ready") {
      cache.set(provider, { at: Date.now(), value: fromCb });
      return fromCb;
    }
  }

  const result = await probeProvider(provider);
  const status = buildProviderStatus(provider, result, { configured: true, key });

  if (result.ok) {
    recordProviderSuccess(provider);
  } else if (result.status && HARD_ERROR_STATUSES.has(Number(result.status))) {
    recordProviderFailure(provider, Date.now(), {
      status: result.status,
      type: result.reasonCode,
      detail: result.reasonCode,
    });
  } else if (result.reasonCode === "billing" || result.reasonCode === "invalid_key" || result.reasonCode === "auth_failed") {
    recordProviderFailure(provider, Date.now(), {
      status: result.status || 401,
      type: result.reasonCode,
      detail: result.reasonCode,
    });
  }

  try {
    console.log(
      JSON.stringify({
        event: "provider_probe",
        provider,
        ok: !!result.ok,
        reasonCode: status.reasonCode,
        latency_ms: status.latencyMs,
        model: status.modelProbed,
      }),
    );
  } catch {
    /* ignore */
  }

  cache.set(provider, { at: Date.now(), value: status });
  return status;
}

/**
 * Mark ready from a successful chat turn (free signal).
 * @param {string} provider
 * @param {{ model?: string, latencyMs?: number }} [meta]
 */
export function markReadyFromTraffic(provider, meta = {}) {
  if (!getApiKey(provider)) return;
  const now = Date.now();
  const status = {
    id: provider,
    label: providerLabel(provider),
    light: "green",
    state: "ready",
    reasonCode: "ok",
    reason: reasonMessage("ok"),
    configured: true,
    live: true,
    modelProbed: meta.model || null,
    latencyMs: meta.latencyMs ?? null,
    checkedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + PROVIDER_READY_TTL_MS).toISOString(),
    keyMeta: keyMeta(getApiKey(provider)),
  };
  cache.set(provider, { at: now, value: status });
  recordProviderSuccess(provider);
}

/**
 * @param {{ force?: boolean, providers?: string[] }} [opts]
 */
export async function getAggregateReadiness(opts = {}) {
  const force = !!opts.force;
  const list =
    Array.isArray(opts.providers) && opts.providers.length
      ? opts.providers.filter((p) => PROVIDERS.includes(p))
      : [...PROVIDERS].filter((p) => {
          if (p === "openrouter" && !getApiKey("openrouter")) return true; // still report missing
          return true;
        });

  // Always report the four main + openrouter if enabled or key present
  const toProbe = ["claude", "openai", "grok", "gemini", "openrouter"].filter((p) =>
    list.includes(p),
  );

  const settled = await Promise.all(
    toProbe.map(async (p) => {
      try {
        return await getProviderReadiness(p, { force });
      } catch (err) {
        return buildProviderStatus(
          p,
          { ok: false, reasonCode: "sdk_error", model: null, latencyMs: 0 },
          { configured: !!getApiKey(p), key: getApiKey(p) },
        );
      }
    }),
  );

  const providers = settled;
  const readyOnes = providers.filter((p) => p.state === "ready");
  const degradedOnes = providers.filter((p) => p.state === "degraded");
  const ready = readyOnes.length > 0;

  let activeProvider = null;
  for (const id of DEFAULT_PROVIDER_ORDER) {
    const row = providers.find((p) => p.id === id && p.state === "ready");
    if (row) {
      activeProvider = id;
      break;
    }
  }
  if (!activeProvider) {
    for (const id of DEFAULT_PROVIDER_ORDER) {
      const row = providers.find((p) => p.id === id && p.state === "degraded");
      if (row) {
        activeProvider = id;
        break;
      }
    }
  }

  let light = "red";
  if (ready) light = "green";
  else if (degradedOnes.length > 0) light = "amber";
  else if (providers.some((p) => p.state === "unknown")) light = "gray";

  return {
    ready,
    light,
    activeProvider,
    providers,
    available: getAvailableProviders(),
    readyIds: readyOnes.map((p) => p.id),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Summary for ai-options envelope (no full provider list required).
 * Cache-first; does not force probes if cold unless opts.probe.
 */
export async function getReadinessEnvelope(opts = {}) {
  // Prefer cache-only snapshot if all configured providers have cache hits
  const configured = getAvailableProviders();
  if (!opts.force && configured.length > 0) {
    const allCached = configured.every((p) => {
      const hit = cache.get(p);
      return hit && Date.now() - hit.at < PROVIDER_READY_TTL_MS;
    });
    if (allCached) {
      const providers = ["claude", "openai", "grok", "gemini", "openrouter"].map((p) => {
        const hit = cache.get(p);
        if (hit) return hit.value;
        return buildProviderStatus(p, null, {
          configured: !!getApiKey(p),
          key: getApiKey(p) || "",
          reasonCode: getApiKey(p) ? undefined : "missing_key",
        });
      });
      const readyOnes = providers.filter((x) => x.state === "ready");
      let activeProvider = null;
      for (const id of DEFAULT_PROVIDER_ORDER) {
        if (readyOnes.some((r) => r.id === id)) {
          activeProvider = id;
          break;
        }
      }
      return {
        ready: readyOnes.length > 0,
        light: readyOnes.length > 0 ? "green" : providers.some((p) => p.state === "degraded") ? "amber" : "red",
        activeProvider,
      };
    }
  }

  // Cold: run aggregate (probes) unless skipProbe
  if (opts.skipProbe) {
    return { ready: false, light: "gray", activeProvider: null };
  }
  const agg = await getAggregateReadiness({ force: !!opts.force });
  return {
    ready: agg.ready,
    light: agg.light,
    activeProvider: agg.activeProvider,
  };
}

/** Whether AI_OPTIONS_REQUIRE_LIVE is on (prod default 1). */
export function aiOptionsRequireLive() {
  const raw = process.env.AI_OPTIONS_REQUIRE_LIVE;
  if (raw === undefined || raw === "") {
    return process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
  }
  return /^(1|true|yes)$/i.test(String(raw));
}

/**
 * Filter provider ids for picker per SDD §7.6.
 * @param {object[]} readinessProviders
 * @param {string[]} candidateIds
 */
export function filterProvidersForPicker(readinessProviders, candidateIds) {
  const byId = new Map((readinessProviders || []).map((p) => [p.id, p]));
  if (!aiOptionsRequireLive()) {
    // Dev: show all configured; never invent green without live — just list candidates
    return candidateIds;
  }
  return candidateIds.filter((id) => {
    const row = byId.get(id);
    if (!row) return false;
    return row.state === "ready" || row.state === "degraded";
  });
}

export function _clearReadinessCache() {
  cache.clear();
}

export function _getReadinessCacheSize() {
  return cache.size;
}

// Re-export for tests
export { mapProbeErrorToReasonCode, reasonMessage, isUsableApiKey, PROVIDER_LABELS, isCoolingDown };
