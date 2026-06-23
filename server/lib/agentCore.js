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
import { buildSystemPrompt } from "./chatPrompts.js";
import { findRelevantExamples } from "./trainingKB.js";
import { renderExamplesBlock } from "./channelRenderer.js";
import {
  getProviderChain,
  resolveModel,
  estimateCostUSD,
  getApiKey,
} from "./aiProviderConfig.js";

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
  const kbExamples = findRelevantExamples(lastUser, { limit: 4 });

  const kbBlock = renderExamplesBlock(kbExamples, channel);
  const basePrompt = buildSystemPrompt(calcState, { trainingExamples: kbExamples });
  const channelSection = buildChannelSection(channel);
  const promptCore = opts.systemPrompt || basePrompt;
  const systemPrompt = [promptCore, channelSection, kbBlock].filter(Boolean).join("\n\n");

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
        const params = {
          model: modelUsed,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages,
        };
        if (eff.temperature != null) params.temperature = eff.temperature;
        const msg = await client.messages.create(params);
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
        const r = await client.chat.completions.create(params);
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
        const r = await client.chat.completions.create(params);
        text = r.choices[0]?.message?.content || "";
        usage = r.usage || {};

      } else if (p === "gemini") {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genai = new GoogleGenerativeAI(apiKey);
        const generationConfig = {};
        if (eff.temperature != null) generationConfig.temperature = eff.temperature;
        if (maxTokens) generationConfig.maxOutputTokens = maxTokens;
        const model = genai.getGenerativeModel({ model: modelUsed, generationConfig });
        const result = await model.generateContent(`${systemPrompt}\n\n${lastUser}`);
        text = result.response.text() || "";
        // Gemini usage is in result.response.usageMetadata in newer SDKs
        usage = result.response?.usageMetadata || {};
      }

      if (text.trim()) {
        const cost = estimateCostUSD(p, modelUsed, usage);

        // Structured cost observability (consistent with Phase 0 changes)
        // TODO: thread pino logger here once cost-telemetry module exists
        console.log(JSON.stringify({
          event: "agent_core_call",
          provider: p,
          model: modelUsed,
          channel,
          latency_ms: Date.now() - t0,
          estimated_cost_usd: cost,
          task_key: taskKey || null,
        }));

        return {
          text: text.trim(),
          provider: p,
          model: modelUsed,
          latencyMs: Date.now() - t0,
          estimatedCostUsd: cost,
        };
      }
      errors.push(`${p}: empty`);

    } catch (err) {
      errors.push(`${p}: ${err.message?.slice(0, 80)}`);
    }
  }

  const e = new Error(`All providers failed: ${errors.join("; ")}`);
  e.code = "ALL_PROVIDERS_FAILED";
  e.errors = errors;
  throw e;
}
