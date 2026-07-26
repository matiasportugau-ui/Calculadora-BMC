/**
 * providerProbes.js — cheapest synthetic generation per LLM provider.
 *
 * Used by providerReadiness for live Ready/Not-ready lights (SDD Phases A).
 * Never logs full API keys. max_tokens ≤ 8.
 */

import { getApiKey, getDefaultModel, PROVIDER_LABELS } from "./aiProviderConfig.js";

export const PROBE_PROMPT = "Reply with exactly: OK";
export const PROBE_MAX_TOKENS = 8;
export const PROBE_TIMEOUT_MS = Number(process.env.PROVIDER_PROBE_TIMEOUT_MS) || 8_000;

/**
 * Map provider error text/status → reasonCode (SDD §6.5).
 * Exported for unit tests without network.
 *
 * @param {{ status?: number|string, message?: string, body?: string }} err
 * @returns {string}
 */
export function mapProbeErrorToReasonCode(err = {}) {
  const status = Number(err.status) || 0;
  const msg = String(err.message || err.body || "").toLowerCase();

  if (status === 429 || /rate.?limit|too many requests|resource_exhausted|quota exceeded|free_tier/.test(msg)) {
    // Soft free-tier / RPM limits (Gemini free_tier_*, rate-limit docs) → amber
    if (/free_tier|rate-limits|retry in \d|resource_exhausted/.test(msg)) {
      return "rate_limited";
    }
    // Hard OpenAI-style billing (no free-tier path)
    if (/insufficient_quota|credit balance|please check your plan and billing/.test(msg)) {
      return "billing";
    }
    return "rate_limited";
  }
  if (
    status === 401 ||
    status === 403 ||
    /access_token_type_unsupported|unauthenticated|invalid authentication|permission_denied/.test(msg)
  ) {
    return "auth_failed";
  }
  if (
    /credit balance|insufficient_quota|billing|payment|exceeded your current quota|too low to access/.test(msg)
  ) {
    return "billing";
  }
  if (
    /incorrect api key|invalid.?api.?key|invalid_api_key|wrong api key|api key not valid|invalid x-api-key/.test(
      msg,
    )
  ) {
    return "invalid_key";
  }
  if (status === 408 || /timeout|aborted|abort/.test(msg)) return "timeout";
  if (status >= 500) return "timeout";
  return "sdk_error";
}

/**
 * Spanish operator messages (SDD §7.7).
 * @param {string} reasonCode
 */
export function reasonMessage(reasonCode) {
  switch (reasonCode) {
    case "ok":
      return "Listo";
    case "missing_key":
      return "No hay API key configurada para este proveedor.";
    case "placeholder_key":
      return "La key parece un placeholder de .env.example. Reemplazala en Doppler/GSM.";
    case "billing":
      return "Cuenta sin créditos o sin cuota. Revisá billing del proveedor.";
    case "auth_failed":
      return "Key rechazada (401/403). Rotá la key (Gemini: Generative Language / AI Studio válida).";
    case "invalid_key":
      return "El proveedor reporta key incorrecta. Regenerá la key.";
    case "rate_limited":
      return "Límite temporal (429). Esperá o subí cuota.";
    case "timeout":
      return "Timeout o error de red al verificar el proveedor.";
    case "cooldown":
      return "Proveedor en pausa tras fallos recientes.";
    case "probe_disabled":
      return "Probe deshabilitado.";
    case "sdk_error":
    default:
      return "No se pudo verificar el proveedor.";
  }
}

/**
 * @param {string} provider
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ ok: boolean, reasonCode: string, model: string|null, latencyMs: number, text?: string, status?: number }>}
 */
export async function probeProvider(provider, signal) {
  const t0 = Date.now();
  const key = getApiKey(provider);
  if (!key) {
    return {
      ok: false,
      reasonCode: "missing_key",
      model: null,
      latencyMs: Date.now() - t0,
    };
  }

  const model = getDefaultModel(provider, true);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    let text = "";
    if (provider === "claude") {
      text = await probeClaude(key, model, controller.signal);
    } else if (provider === "gemini") {
      text = await probeGemini(key, model, controller.signal);
    } else if (provider === "openai" || provider === "grok" || provider === "openrouter") {
      text = await probeOpenAICompat(provider, key, model, controller.signal);
    } else {
      return {
        ok: false,
        reasonCode: "sdk_error",
        model,
        latencyMs: Date.now() - t0,
      };
    }

    const latencyMs = Date.now() - t0;
    if (!text || !String(text).trim()) {
      return { ok: false, reasonCode: "sdk_error", model, latencyMs, status: 200 };
    }
    return { ok: true, reasonCode: "ok", model, latencyMs, text: String(text).trim().slice(0, 32) };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    const status = err?.status || err?.statusCode || (err?.name === "AbortError" ? 408 : 0);
    const message = err?.message || String(err);
    return {
      ok: false,
      reasonCode: mapProbeErrorToReasonCode({ status, message }),
      model,
      latencyMs,
      status: Number(status) || undefined,
    };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

async function probeClaude(apiKey, model, signal) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create(
    {
      model,
      max_tokens: PROBE_MAX_TOKENS,
      messages: [{ role: "user", content: PROBE_PROMPT }],
    },
    { signal },
  );
  const block = (res.content || []).find((b) => b.type === "text");
  return block?.text || "";
}

async function probeGemini(apiKey, model, signal) {
  // REST avoids SDK treating some key types oddly; matches working smoke path.
  // Gemini 2.5 "thinking" models burn tokens before text — maxOutputTokens: 8
  // often returns empty with finishReason MAX_TOKENS. Use a higher floor.
  const geminiMaxOut = Math.max(PROBE_MAX_TOKENS, 64);
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROBE_PROMPT }] }],
      generationConfig: { maxOutputTokens: geminiMaxOut },
    }),
    signal,
  });
  const body = await r.text();
  if (!r.ok) {
    const err = new Error(body.slice(0, 400) || `gemini HTTP ${r.status}`);
    err.status = r.status;
    throw err;
  }
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    return "";
  }
  const parts = json?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text).filter(Boolean).join("") || "";
}

async function probeOpenAICompat(provider, apiKey, model, signal) {
  let baseURL = "https://api.openai.com/v1";
  if (provider === "grok") baseURL = "https://api.x.ai/v1";
  if (provider === "openrouter") baseURL = "https://openrouter.ai/api/v1";

  const r = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(provider === "openrouter"
        ? { "HTTP-Referer": "https://calculadora-bmc.local", "X-Title": "BMC Panelin readiness" }
        : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: PROBE_MAX_TOKENS,
      messages: [{ role: "user", content: PROBE_PROMPT }],
    }),
    signal,
  });
  const body = await r.text();
  if (!r.ok) {
    const err = new Error(body.slice(0, 400) || `HTTP ${r.status}`);
    err.status = r.status;
    throw err;
  }
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    return "";
  }
  return json?.choices?.[0]?.message?.content || "";
}

/** @param {string} provider */
export function providerLabel(provider) {
  return PROVIDER_LABELS[provider] || provider;
}
