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

const PROVIDER_CHAIN = ["claude", "openai", "grok", "gemini"];

/**
 * Generate a single (non-streaming) agent response.
 *
 * @param {Array<{role:"user"|"assistant", content:string}>} messages
 * @param {object} opts
 * @param {"chat"|"ml"|"wa"} opts.channel
 * @param {object} [opts.calcState]  — calculator state (optional, enriches system prompt)
 * @param {string} [opts.provider]   — force a specific provider
 * @returns {Promise<{text:string, provider:string}>}
 */
export async function callAgentOnce(messages, { channel = "chat", calcState = {}, provider } = {}) {
  const apiKeys = {
    claude: config.anthropicApiKey,
    openai: config.openaiApiKey,
    grok:   config.grokApiKey,
    gemini: config.geminiApiKey,
  };

  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const kbExamples = findRelevantExamples(lastUser, { limit: 4 });

  // Render KB examples using channel-appropriate text (respects goodAnswerML/goodAnswerWA overrides)
  const kbBlock = renderExamplesBlock(kbExamples, channel);
  const basePrompt = buildSystemPrompt(calcState, { trainingExamples: kbExamples });
  const channelSection = buildChannelSection(channel);
  // kbBlock uses channel-rendered answers (ML truncated, WA friendly, chat full)
  const systemPrompt = [basePrompt, channelSection, kbBlock].filter(Boolean).join("\n\n");

  const maxTokens = channel === "ml" ? 120 : channel === "wa" ? 400 : 1200;
  const chain = provider ? [provider] : PROVIDER_CHAIN;
  const errors = [];

  for (const p of chain) {
    const apiKey = apiKeys[p];
    if (!apiKey) { errors.push(`${p}: no key`); continue; }

    try {
      let text = "";

      if (p === "claude") {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic({ apiKey });
        const msg = await client.messages.create({
          model: config.anthropicChatModel || "claude-haiku-4-5-20251001",
          max_tokens: maxTokens,
          system: systemPrompt,
          messages,
        });
        text = msg.content?.[0]?.text || "";

      } else if (p === "openai") {
        const { default: OpenAI } = await import("openai");
        const client = new OpenAI({ apiKey });
        const r = await client.chat.completions.create({
          model: config.openaiChatModel || "gpt-4o-mini",
          max_tokens: maxTokens,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
        });
        text = r.choices[0]?.message?.content || "";

      } else if (p === "grok") {
        const { default: OpenAI } = await import("openai");
        const client = new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" });
        const r = await client.chat.completions.create({
          model: config.grokChatModel || "grok-3-mini",
          max_tokens: maxTokens,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
        });
        text = r.choices[0]?.message?.content || "";

      } else if (p === "gemini") {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genai = new GoogleGenerativeAI(apiKey);
        const model = genai.getGenerativeModel({ model: config.geminiChatModel || "gemini-2.0-flash" });
        const result = await model.generateContent(`${systemPrompt}\n\n${lastUser}`);
        text = result.response.text() || "";
      }

      if (text.trim()) return { text: text.trim(), provider: p };
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
