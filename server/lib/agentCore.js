/**
 * agentCore.js — Shared agent brain for all channels.
 *
 * Single entry point for generating a Panelin AI response, reused by:
 *   - agentChat.js  (SSE streaming, chat UI)
 *   - suggestResponse.js  (ML / CRM dashboard)
 *   - processWaConversation  (WhatsApp auto-trigger)
 *
 * All channels share the same KB, system prompt, and provider chain.
 * Channel-specific rules (length limits, tone, format) are injected via
 * buildChannelRules(channel) appended to the system prompt.
 */
import { config } from "../config.js";
import { buildSystemPromptParts } from "./chatPrompts.js";
import { findRelevantExamples } from "./trainingKB.js";
import { renderExamplesBlock } from "./channelRenderer.js";
import {
  getProviderChain,
  resolveModel,
  estimateCostUSD,
  getApiKey,
} from "./aiProviderConfig.js";
import { logAgentCost } from "./costTelemetry.js";
import { logAgentTurn } from "./logAgentTurn.js";
import {
  PROVIDER_TIMEOUT_MS,
  orderChainByHealth,
  recordProviderFailure,
  recordProviderSuccess,
  resetProviderCooldowns,
  getProviderCooldownState,
  _resetProviderHealth,
} from "./providerCircuitBreaker.js";

export {
  recordProviderFailure,
  recordProviderSuccess,
  resetProviderCooldowns,
  getProviderCooldownState,
  _resetProviderHealth,
  PROVIDER_TIMEOUT_MS,
};

// ─── Provider timeout + circuit breaker (B-06) ────────────────────────────────
// See providerCircuitBreaker.js; re-exported below for stable import paths.

/**
 * Run an async provider call with a hard timeout. Aborts via AbortSignal (for
 * SDKs that honor it) AND rejects via race (guarantees the loop advances even if
 * the SDK ignores the signal). `fn` receives the signal to forward to the SDK.
 */
export async function callWithTimeout(fn, ms, label) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(Object.assign(new Error(`${label} timed out after ${ms}ms`), { code: "PROVIDER_TIMEOUT" }));
    }, ms);
  });
  try {
    return await Promise.race([Promise.resolve(fn(controller.signal)), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// ─── Channel rules ────────────────────────────────────────────────────────────

const CHANNEL_RULES = {
  ml: `## CANAL: MercadoLibre
- Respuesta máxima: 350 caracteres. Sé muy breve.
- Sin markdown (sin **, sin #, sin listas con guiones).
- Sin URLs.
- Tono: profesional, directo. Sin emojis.
- Si faltan dimensiones (largo, ancho, alto), pedirlas antes de cotizar.
- Precio siempre en U$S IVA incluido. No mencionar "lista web" ni "lista venta".
- Cerrar siempre con: Saludos, BMC Uruguay!`,

  wa: `## CANAL: WhatsApp
- Respuesta máxima: 800 caracteres.
- Tono amigable y profesional. Podés usar algún emoji ocasionalmente.
- Sin markdown complejo. Podés usar saltos de línea.
- Si hay múltiples ítems, numerarlos (1. 2. 3.).
- Pedí dimensiones si no las tenés para cotizar.
- Cerrar con: ¡Saludos! BMC Uruguay`,

  chat: `## CANAL: Chat Panelin (calculadora)
- Sin límite de longitud.
- Markdown habilitado (**, ##, listas).
- Podés usar las herramientas (tools) para calcular y generar PDF.
- Tono: experto técnico y comercial.`,
};

function buildChannelSection(channel) {
  return CHANNEL_RULES[channel] || CHANNEL_RULES.chat;
}

// ─── Core call ────────────────────────────────────────────────────────────────

// Centralized provider chain (replaces previous hardcoded list)
const getCentralProviderChain = () => getProviderChain();

// El módulo waConfig.js es runtime-side; agentCore se usa también offline en
// tests, así que importamos lazy para no romper si waConfig no está primed.
async function _readAiOverride(taskKey) {
  if (!taskKey) return null;
  try {
    const mod = await import("./waConfig.js");
    const cfg = mod.getConfig?.();
    return cfg?.ai?.[taskKey] || null;
  } catch {
    return null;
  }
}

// Mapeo de "provider canónico" del schema (anthropic/openai/grok/gemini) al
// nombre interno de la cadena (claude/openai/grok/gemini).
const SCHEMA_TO_INTERNAL = {
  anthropic: "claude",
  openai: "openai",
  grok: "grok",
  gemini: "gemini",
};

/**
 * Generate a single (non-streaming) agent response.
 *
 * @param {Array<{role:"user"|"assistant", content:string}>} messages
 * @param {object} opts
 * @param {"chat"|"ml"|"wa"} [opts.channel]
 * @param {object} [opts.calcState]
 * @param {string} [opts.provider]   — force a specific provider (alias del internal name)
 * @param {string} [opts.taskKey]    — 'classify'|'suggestions'|'quoteParse'|'followupText'
 *                                     Si se pasa, lee config.ai[taskKey] y override
 *                                     provider+model+temperature+maxTokens.
 * @param {object} [opts.override]   — { provider, model, temperature, maxTokens } directo.
 * @returns {Promise<{text:string, provider:string, model?:string, latencyMs?:number, estimatedCostUsd?:number}>}
 */
export async function callAgentOnce(messages, opts = {}) {
  const {
    channel = "chat",
    calcState = {},
    provider,
    taskKey,
    override = null,
    apiKeys: apiKeysOverride = null,
  } = opts;

  // Aplicar override directo, después taskKey desde waConfig, después fallback.
  const fromTask = taskKey ? await _readAiOverride(taskKey) : null;
  const eff = {
    provider: override?.provider || fromTask?.provider || null,
    model: override?.model || fromTask?.model || null,
    temperature: override?.temperature ?? fromTask?.temperature ?? null,
    maxTokens: override?.maxTokens || fromTask?.maxTokens || null,
  };

  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";

  // Bare mode: callers that need a specialized, self-contained system prompt (and
  // just want the provider-fallback loop) pass opts.bareSystemPrompt. We then skip
  // the Panelin base prompt + channel rules + KB examples entirely. Used by the
  // Email drafter and Wolfboard batch so they gain provider fallback WITHOUT
  // inheriting Panelin's persona. Existing callers don't pass it → unchanged.
  const bare = opts.bareSystemPrompt || null;
  const kbExamples = bare ? [] : findRelevantExamples(lastUser, { limit: 4 });
  const kbBlock = bare ? "" : renderExamplesBlock(kbExamples, channel);
  const channelSection = bare ? "" : buildChannelSection(channel);

  // Split the system prompt into a cacheable static prefix + a per-request dynamic
  // tail. Only the Anthropic branch consumes the split (stamps cache_control on the
  // ~20k-token prefix); `systemPrompt` (the joined string used by the other providers
  // and by logging) stays BYTE-IDENTICAL to the previous construction.
  let staticSystem, dynamicSystem;
  if (bare || opts.systemPrompt) {
    // Specialized/slim prompt (email drafter, wolfboard batch): fully static → cache
    // it whole; channel rules + KB (if any) form the small dynamic tail.
    staticSystem = bare || opts.systemPrompt;
    dynamicSystem = [channelSection, kbBlock].filter(Boolean).join("\n\n");
  } else {
    const { staticPrefix, dynamicTail } = buildSystemPromptParts(calcState, { trainingExamples: kbExamples });
    staticSystem = staticPrefix;
    dynamicSystem = [dynamicTail, channelSection, kbBlock].filter(Boolean).join("\n\n");
  }
  const systemPrompt = [staticSystem, dynamicSystem].filter(Boolean).join("\n\n");

  const channelDefault = channel === "ml" ? 120 : channel === "wa" ? 400 : 1200;
  const maxTokens = Number(eff.maxTokens) || channelDefault;

  // Determinar cadena a probar usando centralización:
  //   1) opts.provider explícito (legacy) → solo ese.
  //   2) eff.provider (vía taskKey) como first-try, después getProviderChain().
  //   3) getProviderChain() completo.
  let chain;
  if (provider) {
    chain = [provider];
  } else if (eff.provider) {
    const internal = SCHEMA_TO_INTERNAL[eff.provider] || eff.provider;
    const fullChain = getCentralProviderChain();
    chain = [internal, ...fullChain.filter((p) => p !== internal)];
  } else {
    chain = getCentralProviderChain();
  }

  // B-06: deprioritize cooling providers (never drop from chain).
  if (!provider && chain.length > 1) {
    chain = orderChainByHealth(chain);
  }

  const errors = [];

  for (const p of chain) {
    const apiKey = getApiKey(p);
    if (!apiKey) { errors.push(`${p}: no key`); continue; }

    // Resolver modelo usando centralización (respeta overrides + allowlists + defaults)
    const internalForOverride = SCHEMA_TO_INTERNAL[eff.provider] || eff.provider;
    const usingOverrideModel = eff.model && p === internalForOverride;
    const requestedModel = usingOverrideModel ? eff.model : null;
    const modelUsed = resolveModel(p, requestedModel, false); // prefer high-quality for interactive

    const t0 = Date.now();
    try {
      let text = "";
      let usage = {};

      if (p === "claude") {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic({ apiKey });
        // Structured system: cache_control on the large static prefix (identity,
        // catalog, canonical prices, tools ≈ 20k tokens) → cache reads are 0.1x on
        // hit within the 5-min TTL. The dynamic tail (calc state, KB, prefs) is a
        // second, uncached block. Falls back to a single cached block when there is
        // no dynamic tail (e.g. bare/slim prompts).
        const system = dynamicSystem
          ? [
              { type: "text", text: staticSystem, cache_control: { type: "ephemeral" } },
              { type: "text", text: dynamicSystem },
            ]
          : [{ type: "text", text: staticSystem, cache_control: { type: "ephemeral" } }];
        const params = {
          model: modelUsed,
          max_tokens: maxTokens,
          system,
          messages,
        };
        if (eff.temperature != null) params.temperature = eff.temperature;
        const msg = await callWithTimeout(
          (signal) => client.messages.create(params, { signal }),
          PROVIDER_TIMEOUT_MS, "claude",
        );
        text = msg.content?.[0]?.text || "";
        usage = msg.usage || {};

      } else if (p === "openai") {
        const { default: OpenAI } = await import("openai");
        const client = new OpenAI({ apiKey });
        const params = {
          model: modelUsed,
          max_tokens: maxTokens,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
        };
        if (eff.temperature != null) params.temperature = eff.temperature;
        const r = await callWithTimeout(
          (signal) => client.chat.completions.create(params, { signal }),
          PROVIDER_TIMEOUT_MS, "openai",
        );
        text = r.choices[0]?.message?.content || "";
        usage = r.usage || {};

      } else if (p === "grok") {
        const { default: OpenAI } = await import("openai");
        const client = new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" });
        const params = {
          model: modelUsed,
          max_tokens: maxTokens,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
        };
        if (eff.temperature != null) params.temperature = eff.temperature;
        const r = await callWithTimeout(
          (signal) => client.chat.completions.create(params, { signal }),
          PROVIDER_TIMEOUT_MS, "grok",
        );
        text = r.choices[0]?.message?.content || "";
        usage = r.usage || {};

      } else if (p === "openrouter") {
        // Terminal open-source-model fallback (Llama/Mistral/DeepSeek/Qwen). Same
        // OpenAI-compatible shape as grok — just a different baseURL. Tried LAST,
        // so if every commercial provider is down the seam STILL answers via an
        // open model. Attribution headers are recommended by OpenRouter, optional.
        const { default: OpenAI } = await import("openai");
        const client = new OpenAI({
          apiKey,
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": "https://calculadora-bmc.vercel.app",
            "X-Title": "Calculadora BMC",
          },
        });
        const params = {
          model: modelUsed,
          max_tokens: maxTokens,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
        };
        if (eff.temperature != null) params.temperature = eff.temperature;
        const r = await callWithTimeout(
          (signal) => client.chat.completions.create(params, { signal }),
          PROVIDER_TIMEOUT_MS, "openrouter",
        );
        text = r.choices[0]?.message?.content || "";
        usage = r.usage || {};

      } else if (p === "gemini") {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genai = new GoogleGenerativeAI(apiKey);
        const generationConfig = {
          // gemini-2.5-flash enables "thinking" by default, which burns part of
          // maxOutputTokens on hidden reasoning before any visible text — with
          // the tight per-channel budgets here (120 for ml, 400 for wa) that
          // starves the actual answer, truncating it mid-sentence. No tools are
          // used on this path, so thinking has no upside here. Same fix as
          // agentChat.js's Gemini branch.
          thinkingConfig: { thinkingBudget: 0 },
        };
        if (eff.temperature != null) generationConfig.temperature = eff.temperature;
        if (maxTokens) generationConfig.maxOutputTokens = maxTokens;
        // Pass the system prompt as a proper systemInstruction and the FULL
        // conversation as contents. Previously this branch sent only
        // `${systemPrompt}\n\n${lastUser}`, silently dropping all prior turns — any
        // multi-turn WA/ML conversation that fell to Gemini lost its history.
        const contents = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content ?? "") }] }));
        const model = genai.getGenerativeModel({ model: modelUsed, systemInstruction: systemPrompt, generationConfig });
        const result = await callWithTimeout(
          (signal) => model.generateContent(
            { contents: contents.length ? contents : [{ role: "user", parts: [{ text: lastUser }] }] },
            { signal },
          ),
          PROVIDER_TIMEOUT_MS, "gemini",
        );
        text = result.response.text() || "";
        // Gemini usage is in result.response.usageMetadata in newer SDKs
        usage = result.response?.usageMetadata || {};
      }

      if (text.trim()) {
        recordProviderSuccess(p); // clear any pending failure streak on a good call
        const cost = estimateCostUSD(p, modelUsed, usage);

        // Structured cost observability via costTelemetry (cache_read > 0 ⇒ Anthropic cache HIT).
        const inTok = usage.input_tokens ?? usage.prompt_tokens ?? null;
        const outTok = usage.output_tokens ?? usage.completion_tokens ?? null;
        const latencyMs = Date.now() - t0;
        logAgentCost({
          event: "agent_core_call",
          provider: p,
          model: modelUsed,
          channel,
          latency_ms: latencyMs,
          estimated_cost_usd: cost,
          input_tokens: inTok,
          output_tokens: outTok,
          cache_read_tokens: usage.cache_read_input_tokens ?? null,
          cache_write_tokens: usage.cache_creation_input_tokens ?? null,
          task_key: taskKey || null,
          source: "agentCore",
        });
        // IMP-02: turn-level parity envelope shared with SSE agentChat.
        logAgentTurn({
          event: "agent_turn",
          channel,
          assistant: opts.assistant ?? null,
          provider: p,
          model: modelUsed,
          input_tokens: inTok,
          output_tokens: outTok,
          estimated_cost_usd: cost,
          latency_ms: latencyMs,
          source: "agentCore",
        });

        return {
          text: text.trim(),
          provider: p,
          model: modelUsed,
          latencyMs,
          estimatedCostUsd: cost,
        };
      }
      // A provider that returns empty text is skipped silently too — surface it.
      console.log(JSON.stringify({ event: "provider_empty", provider: p, model: modelUsed, channel }));
      errors.push(`${p}: empty`);

    } catch (err) {
      // Surface the EXACT per-provider failure. Before this, an individual
      // provider error was only accumulated in errors[] and shown on the
      // ALL_PROVIDERS_FAILED throw — which never fires when a later provider
      // (e.g. gemini) rescues the call, so "why is claude failing on the seam?"
      // was invisible in the logs. status/error_type come from the Anthropic +
      // OpenAI SDK error shapes.
      const detail = String(err?.message || err).slice(0, 200);
      const status = err?.status ?? null;
      const errorType = err?.error?.type ?? err?.name ?? null;
      // feeds cooldown deprioritization + retains the reason for the control panel
      recordProviderFailure(p, Date.now(), { status, type: errorType, detail, model: modelUsed });
      console.log(JSON.stringify({
        event: "provider_error",
        provider: p,
        model: modelUsed,
        channel,
        status,
        error_type: errorType,
        detail,
        task_key: taskKey || null,
      }));
      errors.push(`${p}: ${detail.slice(0, 80)}`);
    }
  }

  const e = new Error(`All providers failed: ${errors.join("; ")}`);
  e.code = "ALL_PROVIDERS_FAILED";
  e.errors = errors;
  throw e;
}
