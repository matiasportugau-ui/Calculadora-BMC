// ═══════════════════════════════════════════════════════════════════════════
// server/lib/visionExtract.js
// Extracción de JSON estructurado desde imagen / PDF / texto usando TODOS los
// proveedores de IA configurados, con fallback en cadena.
//
// Reusa la configuración central (aiProviderConfig) y los SDK ya instalados:
//   - Claude  (@anthropic-ai/sdk)      imagen + PDF + texto
//   - Gemini  (@google/generative-ai)  imagen + PDF + texto
//   - OpenAI  (openai)                 imagen + texto   (gpt-4o vision)
//   - Grok    (openai, baseURL x.ai)   imagen + texto   (grok-2-vision-1212)
//
// El orden viene de getProviderChain() (proveedores con API key, en el orden
// preferido). Se saltean proveedores que no soportan el tipo de entrada.
// ═══════════════════════════════════════════════════════════════════════════

import { config } from "../config.js";
import {
  getProviderChain, getApiKey, resolveModel, isAllowedModel, PROVIDER_LABELS,
} from "./aiProviderConfig.js";

/** Orden preferido de proveedores para tareas de VISIÓN (planos/diagramas). */
export const VISION_PROVIDER_PREFERENCE = ["claude", "gemini", "openai", "grok"];

/** Capacidad por proveedor según tipo de entrada. */
const SUPPORTS = {
  claude: { image: true, pdf: true, text: true },
  gemini: { image: true, pdf: true, text: true },
  openai: { image: true, pdf: false, text: true },
  grok: { image: true, pdf: false, text: true },
};

/** Modelo con capacidad de visión por proveedor (con override opcional validado). */
function visionModel(provider, kind, override) {
  if (override && isAllowedModel(provider, override)) return override;
  switch (provider) {
    case "claude":
      return config.anthropicPlanModel || config.anthropicChatModel || resolveModel("claude");
    case "gemini":
      return config.geminiChatModel || resolveModel("gemini");
    case "openai":
      // gpt-4o tiene visión; el "mini" puede no ver diagramas finos de forma fiable.
      return kind === "image" ? "gpt-4o" : (config.openaiChatModel || resolveModel("openai"));
    case "grok":
      return kind === "image" ? "grok-2-vision-1212" : resolveModel("grok");
    default:
      return resolveModel(provider);
  }
}

/** Reordena la cadena poniendo `prefer` primero (si está disponible). */
function orderChain(chain, prefer) {
  if (!prefer || !chain.includes(prefer)) return chain;
  return [prefer, ...chain.filter((p) => p !== prefer)];
}

/**
 * Proveedor recomendado para visión: el primero disponible según
 * VISION_PROVIDER_PREFERENCE. Devuelve null si no hay ninguno.
 */
export function recommendedVisionProvider() {
  const available = getProviderChain();
  return VISION_PROVIDER_PREFERENCE.find((p) => available.includes(p)) || available[0] || null;
}

function kindOf(mimeType, filename) {
  if ((mimeType || "").startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if ((filename || "").toLowerCase().endsWith(".dxf") || mimeType === "text/plain") return "text";
  return "image";
}

/** Extrae el primer objeto JSON balanceado del texto del modelo. */
export function parseJsonLoose(text) {
  const match = (text || "").match(/\{[\s\S]*\}/);
  if (!match) throw Object.assign(new Error("La IA no devolvió JSON interpretable."), { status: 422 });
  try { return JSON.parse(match[0]); }
  catch { throw Object.assign(new Error("La IA devolvió JSON con formato inválido."), { status: 422 }); }
}

// ── Builders por proveedor ──────────────────────────────────────────────────

async function callClaude(model, { system, instruction, buffer, mimeType, kind }) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: getApiKey("claude") });
  const content = [];
  if (kind === "image") content.push({ type: "image", source: { type: "base64", media_type: mimeType, data: buffer.toString("base64") } });
  else if (kind === "pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } });
  else content.push({ type: "text", text: `Archivo de plano (texto):\n\n${buffer.toString("utf-8").slice(0, 40_000)}` });
  content.push({ type: "text", text: instruction });
  const resp = await client.messages.create({ model, max_tokens: 1500, system, messages: [{ role: "user", content }] });
  if (resp.stop_reason === "max_tokens") throw Object.assign(new Error("Respuesta truncada — plano demasiado complejo."), { status: 422 });
  return resp.content?.[0]?.text || "";
}

async function callGemini(model, { system, instruction, buffer, mimeType, kind }) {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(getApiKey("gemini"));
  const m = genAI.getGenerativeModel({ model });
  const parts = [];
  if (kind === "image") parts.push({ inlineData: { data: buffer.toString("base64"), mimeType } });
  else if (kind === "pdf") parts.push({ inlineData: { data: buffer.toString("base64"), mimeType: "application/pdf" } });
  else parts.push({ text: `Archivo de plano (texto):\n\n${buffer.toString("utf-8").slice(0, 40_000)}` });
  parts.push({ text: `${system}\n\n${instruction}` });
  const result = await m.generateContent({ contents: [{ role: "user", parts }] });
  return result.response.text() || "";
}

async function callOpenAICompatible(provider, model, { system, instruction, buffer, mimeType, kind }) {
  const { default: OpenAI } = await import("openai");
  const client = provider === "grok"
    ? new OpenAI({ apiKey: getApiKey("grok"), baseURL: "https://api.x.ai/v1" })
    : new OpenAI({ apiKey: getApiKey("openai") });
  const userContent = [{ type: "text", text: instruction }];
  if (kind === "image") {
    userContent.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${buffer.toString("base64")}` } });
  } else {
    userContent[0].text = `${instruction}\n\nArchivo de plano (texto):\n\n${buffer.toString("utf-8").slice(0, 40_000)}`;
  }
  const r = await client.chat.completions.create({
    model, max_tokens: 1500,
    messages: [{ role: "system", content: system }, { role: "user", content: userContent }],
  });
  return r.choices?.[0]?.message?.content || "";
}

/**
 * Intenta extraer JSON con todos los proveedores configurados (fallback en cadena).
 * @returns {Promise<{ json: object, provider: string, providerLabel: string, model: string, attempts: Array }>}
 */
export async function extractVisionJSON({ system, instruction, buffer, mimeType, filename, preferProvider, model }) {
  const kind = kindOf(mimeType, filename);
  // Default: priorizar el recomendado para visión; si el operador eligió uno, va primero.
  const baseChain = getProviderChain();
  const chain = orderChain(baseChain, preferProvider || recommendedVisionProvider());

  if (chain.length === 0) {
    throw Object.assign(
      new Error("Sin proveedor de IA configurado. Cargá al menos una de: ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, GROK_API_KEY."),
      { status: 503 },
    );
  }

  const attempts = [];
  for (const provider of chain) {
    if (!SUPPORTS[provider]?.[kind]) {
      attempts.push({ provider, skipped: `no soporta ${kind}` });
      continue;
    }
    // El override de modelo solo aplica al proveedor explícitamente elegido.
    const modelOverride = preferProvider === provider ? model : undefined;
    const usedModel = visionModel(provider, kind, modelOverride);
    try {
      let text;
      if (provider === "claude") text = await callClaude(usedModel, { system, instruction, buffer, mimeType, kind });
      else if (provider === "gemini") text = await callGemini(usedModel, { system, instruction, buffer, mimeType, kind });
      else text = await callOpenAICompatible(provider, usedModel, { system, instruction, buffer, mimeType, kind });

      const json = parseJsonLoose(text);
      attempts.push({ provider, model: usedModel, ok: true });
      return { json, provider, providerLabel: PROVIDER_LABELS[provider], model: usedModel, attempts };
    } catch (err) {
      attempts.push({ provider, model: usedModel, error: err.message });
      // seguir con el siguiente proveedor
    }
  }

  const detail = attempts.map((a) => `${a.provider}: ${a.ok ? "ok" : a.skipped || a.error}`).join(" · ");
  throw Object.assign(
    new Error(`No se pudo interpretar el plano con ningún proveedor de IA (${detail}).`),
    { status: 502, attempts },
  );
}

/** Lista de proveedores de IA conectados (con API key). Para /health, UI, etc. */
export function connectedProviders() {
  return getProviderChain().map((p) => ({ id: p, label: PROVIDER_LABELS[p] }));
}

/**
 * Recomendación de proveedor+modelo para la tarea de visión (interpretar planos).
 * @returns {{ provider:string, providerLabel:string, model:string, reason:string }|null}
 */
export function recommendedVision() {
  const provider = recommendedVisionProvider();
  if (!provider) return null;
  return {
    provider,
    providerLabel: PROVIDER_LABELS[provider],
    model: visionModel(provider, "image"),
    reason: "Mejor capacidad de visión disponible para leer planos/croquis.",
  };
}
