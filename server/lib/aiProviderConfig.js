/**
 * aiProviderConfig.js — Single source of truth for AI providers, models, and defaults.
 *
 * Goal: Eliminate model drift across the codebase (agentChat, aiCompletion, autoLearnExtractor,
 * aiGatewayClient, config.js, etc.).
 *
 * Benefits for functionality + training:
 * - Easy, safe model upgrades (better models = better extraction quality and agent performance).
 * - Consistent behavior between chat, auto-learn, CRM suggestions, etc.
 * - Clear separation between "cheap/fast" and "high-quality" defaults.
 * - Central place to evolve when new models (Claude 4, Grok-4, etc.) become available.
 */

import { config } from "../config.js";

// ─── Provider identifiers (internal canonical names) ──────────────────────────
export const PROVIDERS = ["claude", "openai", "grok", "gemini"];
/** @typedef {"claude"|"openai"|"grok"|"gemini"} Provider */

// ─── Human labels ─────────────────────────────────────────────────────────────
/** @type {Record<Provider, string>} */
export const PROVIDER_LABELS = {
  claude: "Claude (Anthropic)",
  openai: "OpenAI",
  grok: "Grok (xAI)",
  gemini: "Gemini (Google)",
};

// ─── Environment variable names for API keys ─────────────────────────────────
/** @type {Record<Provider, string>} */
export const API_KEY_ENV = {
  claude: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  grok: "GROK_API_KEY",
  gemini: "GEMINI_API_KEY",
};

// ─── Default models (used when .env does not override) ────────────────────────
/** @type {Record<Provider, string>} */
export const DEFAULT_MODELS = {
  // High-quality default for main chat (can be expensive)
  claude: "claude-opus-4-7",
  openai: "gpt-4o-mini",
  grok: "grok-3-mini",
  gemini: "gemini-2.0-flash",
};

// Cheaper / faster defaults (used by auto-learn, some CRM paths, fallbacks)
/** @type {Record<Provider, string>} */
export const FAST_DEFAULT_MODELS = {
  claude: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
  grok: "grok-3-mini",
  gemini: "gemini-2.0-flash-lite",
};

// ─── Allowed models per provider (strict allowlist for safety) ────────────────
/** @type {Record<Provider, Set<string>>} */
export const ALLOWED_MODELS = {
  claude: new Set([
    "claude-opus-4-7",
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-5-20250929",
    "claude-sonnet-4-20250514",
    "claude-3-5-haiku-20241022",
    "claude-3-5-sonnet-20241022",
    "claude-3-opus-20240229",
  ]),
  openai: new Set(["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-4", "o4-mini", "o3-mini"]),
  grok: new Set(["grok-3-mini", "grok-3", "grok-2-latest", "grok-2-vision-1212", "grok-2-1212"]),
  gemini: new Set([
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
    // Robotics-ER previews (for high-level reasoning / planner use cases).
    // Only add here after validation. See comment below and GEMINI.md.
    // "gemini-robotics-er-1.6-preview",
  ]),
};

// ─── Vercel AI Gateway slugs (when using the gateway) ─────────────────────────
/** @type {Record<Provider, string>} */
export const GATEWAY_MODEL_SLUGS = {
  claude: "anthropic/claude-haiku-4.5", // default cheap path via gateway
  openai: "openai/gpt-4o-mini",
  grok: "xai/grok-3-mini",
  gemini: "google/gemini-2.0-flash",
};

// Preferred fallback order (best Spanish + tool use first)
export const DEFAULT_PROVIDER_ORDER = ["claude", "grok", "gemini", "openai"];

// ─── Reasoner vs Executor specialization (inspired by Gemini Robotics ER/VLA split) ──
// The "reasoner" (high-level planner, spatial/long-horizon decomposition, success estimation,
// tool selection decisions) can benefit from different model characteristics than the
// "executor" (reliable direct action via AGENT_TOOLS: calc, PDF, CRM writes, etc.).
// Current recommendation (see GEMINI.md Architecture Analysis): prefer Gemini (or future
// gemini-robotics-er-* previews when generally available) for reasoner steps where spatial
// or cost characteristics help; keep strong Claude for interactive executor/tool loops
// where Spanish domain reliability and tool-following matter most.
//
// These helpers are intentionally lightweight. They do not change the main interactive
// agentChat tool loop (still Claude-primary for stability). They mainly help presupOrchestrator,
// planInterpreter, and future dedicated reasoner paths.

export const REASONER_PREFERRED_PROVIDERS = ["gemini", "claude", "grok", "openai"];
export const EXECUTOR_PREFERRED_PROVIDERS = ["claude", "grok", "gemini", "openai"];

/**
 * Returns a provider chain suitable for high-level reasoning / planning steps
 * (ER-like: decomposition, spatial critique, success estimation, tool selection).
 * Does not guarantee the provider supports the full rich tool loop.
 */
export function getReasonerProviderChain(preferFast = false) {
  const available = getAvailableProviders();
  const base = [...REASONER_PREFERRED_PROVIDERS];
  return base.filter((p) => available.includes(p));
}

/**
 * Returns a provider chain suitable for reliable direct execution / action steps
 * (VLA-like: calling AGENT_TOOLS, calc, PDF, CRM writes with high fidelity).
 */
export function getExecutorProviderChain(preferFast = false) {
  const available = getAvailableProviders();
  const base = [...EXECUTOR_PREFERRED_PROVIDERS];
  return base.filter((p) => available.includes(p));
}

// Note on specialized models (Gemini Robotics-ER previews):
// As of mid-2026, models such as "gemini-robotics-er-1.6-preview" are exposed via the
// standard Gemini API surface for developers building high-level reasoning layers.
// They can be added to the gemini ALLOWED_MODELS set (and used via resolveModel) once
// access and behavior are validated for our use cases (primarily as reasoner/planner).
// Do not add them unconditionally without testing — treat as opt-in for planning flows.

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * @param {Provider} provider
 */
export function getApiKey(provider) {
  switch (provider) {
    case "claude": return config.anthropicApiKey;
    case "openai": return config.openaiApiKey;
    case "grok": return config.grokApiKey;
    case "gemini": return config.geminiApiKey;
  }
}

/**
 * @param {Provider} provider
 * @param {boolean} [preferFast]
 */
export function getDefaultModel(provider, preferFast = false) {
  if (preferFast) return FAST_DEFAULT_MODELS[provider];
  return DEFAULT_MODELS[provider];
}

/**
 * @param {Provider} provider
 * @param {string} model
 */
export function isAllowedModel(provider, model) {
  const allowed = ALLOWED_MODELS[provider];
  if (!allowed) return false;
  return allowed.has(model) || model === getDefaultModel(provider);
}

/**
 * @param {Provider} provider
 * @param {string} [requested]
 * @param {boolean} [preferFast]
 */
export function resolveModel(provider, requested, preferFast = false) {
  const def = getDefaultModel(provider, preferFast);
  if (!requested) return def;
  if (isAllowedModel(provider, requested)) return requested;
  return def;
}

/**
 * @returns {Provider[]}
 */
export function getAvailableProviders() {
  return PROVIDERS.filter((p) => !!getApiKey(p));
}

/**
 * @param {boolean} [preferFast]
 * @returns {Provider[]}
 */
export function getProviderChain(preferFast = false) {
  const available = getAvailableProviders();
  return DEFAULT_PROVIDER_ORDER.filter((p) => available.includes(p));
}

// For the /api/agent/ai-options endpoint
export function buildAiOptionsResponse() {
  const keys = {
    claude: !!getApiKey("claude"),
    openai: !!getApiKey("openai"),
    grok: !!getApiKey("grok"),
    gemini: !!getApiKey("gemini"),
  };

  const providers = ["claude", "openai", "grok", "gemini"]
    .filter((id) => keys[id])
    .map((id) => {
      const defaultModel = resolveModel(id, undefined, false);
      const models = [...(ALLOWED_MODELS[id] || [])];
      if (!models.includes(defaultModel)) models.unshift(defaultModel);

      return {
        id,
        label: PROVIDER_LABELS[id],
        defaultModel,
        models: models.sort().map((m) => ({
          id: m,
          label: m === defaultModel ? `${m} (predeterminado)` : m,
        })),
      };
    });

  return {
    ok: true,
    autoOrder: getProviderChain().filter((p) => keys[p]),
    providers,
    // Reasoner (ER-style high-level planner / spatial) surface.
    // Use these when you want a model good at decomposition, spatial reasoning,
    // success estimation, and long-horizon planning (see GEMINI.md Architecture Analysis).
    // The interactive rich tool loop (AGENT_TOOLS) remains Claude-primary for reliability.
    reasoner: {
      preferredOrder: getReasonerProviderChain().filter((p) => keys[p]),
      note: "Prefer Gemini (or future gemini-robotics-er-* previews) for planner/reasoner steps when spatial or cost characteristics are beneficial.",
    },
  };
}

// Used by auto-learn and other background jobs that want cheap + reliable extraction
/**
 * @returns {string}
 */
export function getExtractorModel() {
  // Prefer fast high-quality model for training data extraction
  return resolveModel("claude", undefined, true);
}

// ─── Rough cost estimation (USD per 1M tokens) - update periodically ──────────
// These are approximate public prices as of mid-2026. Good enough for observability.
const COST_PER_MILLION = {
  // Anthropic Claude
  "claude-opus-4-7": { input: 15.0, output: 75.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  // OpenAI
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  // Grok (xAI)
  "grok-3": { input: 3.0, output: 15.0 },
  "grok-3-mini": { input: 0.6, output: 3.0 },
  // Gemini
  "gemini-2.0-flash": { input: 0.10, output: 0.40 },
  "gemini-2.0-flash-lite": { input: 0.05, output: 0.20 },
};

/**
 * Rough cost estimation in USD.
 * Accepts usage objects from Anthropic, OpenAI, or generic {prompt_tokens, completion_tokens}.
 */
export function estimateCostUSD(provider, model, usage = {}) {
  const costs = COST_PER_MILLION[model] || COST_PER_MILLION[getDefaultModel(provider, true)];
  if (!costs) return 0;

  const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0;

  const inputCost = (inputTokens / 1_000_000) * costs.input;
  const outputCost = (outputTokens / 1_000_000) * costs.output;

  return +(inputCost + outputCost).toFixed(6);
}
