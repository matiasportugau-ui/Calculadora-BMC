// Vercel AI Gateway client — thin wrapper around the AI SDK (`ai` v6).
//
// Goal: replace the 4-SDK chain (Anthropic / OpenAI / Grok / Gemini) in
// /crm/suggest-response, /crm/parse-email, /crm/ingest-email, and
// /agent/training-kb/generate-ml-overrides with a single unified call routed
// through the Vercel AI Gateway. Brief: docs/team/panelsim/knowledge/KB-MULTICANAL-DESIGN-V2.md §5.
//
// Activation (in order of preference):
//   1. **OIDC (preferred)**: `VERCEL_OIDC_TOKEN` populated by `vercel env pull`
//      or running on Vercel — rotates automatically, no manual secret rotation.
//   2. Static API key: `AI_GATEWAY_API_KEY` from the gateway console — works
//      on Cloud Run / any non-Vercel runtime, but you own the rotation.
//
// When neither is present, `isAiGatewayEnabled()` returns false and callers
// keep their legacy SDK chain unchanged. This keeps deploys safe even before
// envs are wired up in Cloud Run / Vercel.
//
// Model slugs: use the gateway slug format `provider/model` (dots, not hyphens
// in version numbers). See https://vercel.com/ai-gateway/models for the list.
//
// Default fallback order across providers — anthropic first (best Spanish +
// instruction following for our domain), then openai (reliable), xai (fast),
// google (cheap fallback). Same ranking as the legacy CRM_AI_PROVIDER_RANKING.

import { config } from "../config.js";

/**
 * Default model slugs per provider — only safe slugs that exist in the
 * gateway's catalog as of 2026/05. Override per-call by passing `model`
 * to generateTextViaGateway / generateObjectViaGateway.
 */
export const DEFAULT_MODEL_SLUG = "anthropic/claude-haiku-4.5";

/**
 * Default provider fallback order. Keep in sync with CRM_AI_PROVIDER_RANKING
 * in bmcDashboard.js so behavior stays consistent across legacy and gateway
 * code paths.
 */
export const DEFAULT_PROVIDER_ORDER = Object.freeze([
  "anthropic",
  "openai",
  "xai",
  "google",
]);

/** True when the gateway is configured and callers should prefer it over SDK chains. */
export function isAiGatewayEnabled() {
  // Prefer OIDC when present (no manual rotation needed).
  if (typeof process !== "undefined" && process.env?.VERCEL_OIDC_TOKEN) return true;
  // Read process.env first so rotated keys take effect without a process restart.
  // Falls back to the cached config value when env is not set at this moment.
  if (typeof process !== "undefined" && process.env?.AI_GATEWAY_API_KEY) return true;
  if (config.aiGatewayApiKey) return true;
  return false;
}

/**
 * Lazily import the AI SDK so the dependency is not loaded in code paths
 * that never use the gateway (legacy Cloud Run deploys).
 *
 * @returns {Promise<{ generateText: Function, Output: { object: Function } }>}
 */
async function loadAiSdk() {
  return await import("ai");
}

/**
 * Calls the gateway via AI SDK `generateText`. Pure text in, pure text out.
 *
 * @param {object} args
 * @param {string} args.system          - system prompt (instructions / persona).
 * @param {string} args.prompt          - user message (free-form).
 * @param {number} [args.maxTokens=300] - cap output. Defaults match legacy.
 * @param {string} [args.model]         - override DEFAULT_MODEL_SLUG.
 * @param {readonly string[]} [args.providerOrder] - override fallback order.
 * @returns {Promise<{ text: string, provider: string }>} resolved provider tag for telemetry.
 * @throws if gateway is not enabled (caller should check isAiGatewayEnabled()).
 */
export async function generateTextViaGateway({
  system,
  prompt,
  maxTokens = 300,
  model = DEFAULT_MODEL_SLUG,
  providerOrder = DEFAULT_PROVIDER_ORDER,
}) {
  if (!isAiGatewayEnabled()) {
    throw new Error("AI Gateway not configured (VERCEL_OIDC_TOKEN or AI_GATEWAY_API_KEY missing)");
  }
  const { generateText } = await loadAiSdk();
  const result = await generateText({
    model,
    system,
    prompt,
    maxOutputTokens: maxTokens,
    providerOptions: {
      gateway: { order: [...providerOrder] },
    },
  });
  const provider = result?.providerMetadata?.gateway?.provider || resolveProviderFromModel(model);
  return { text: String(result?.text ?? ""), provider };
}

/**
 * Calls the gateway with structured output via the canonical AI SDK v6
 * pattern: `generateText({ output: Output.object({ schema }) })`. Used by
 * parse-email / ingest-email to extract structured JSON without the manual
 * markdown-fence cleanup the legacy code does.
 *
 * Reference (v6 canonical): https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
 *
 * @template T
 * @param {object} args
 * @param {string} args.system
 * @param {string} args.prompt
 * @param {import("zod").ZodTypeAny} args.schema
 * @param {number} [args.maxTokens=500]
 * @param {string} [args.model]
 * @param {readonly string[]} [args.providerOrder]
 * @returns {Promise<{ object: T, provider: string }>}
 */
export async function generateObjectViaGateway({
  system,
  prompt,
  schema,
  maxTokens = 500,
  model = DEFAULT_MODEL_SLUG,
  providerOrder = DEFAULT_PROVIDER_ORDER,
}) {
  if (!isAiGatewayEnabled()) {
    throw new Error("AI Gateway not configured (VERCEL_OIDC_TOKEN or AI_GATEWAY_API_KEY missing)");
  }
  const { generateText, Output } = await loadAiSdk();
  const result = await generateText({
    model,
    system,
    prompt,
    output: Output.object({ schema }),
    maxOutputTokens: maxTokens,
    providerOptions: {
      gateway: { order: [...providerOrder] },
    },
  });
  const provider = result?.providerMetadata?.gateway?.provider || resolveProviderFromModel(model);
  return { object: result?.output, provider };
}

/** Extracts the provider tag from a slug like "anthropic/claude-haiku-4.5". */
function resolveProviderFromModel(model) {
  if (typeof model !== "string") return "unknown";
  const slash = model.indexOf("/");
  return slash > 0 ? model.slice(0, slash) : model;
}
