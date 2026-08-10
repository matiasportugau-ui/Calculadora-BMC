/**
 * voiceRealtimeProviders.js — OpenAI Realtime vs Grok Voice Agent (xAI) mint config.
 *
 * Grok Voice Agent API is OpenAI Realtime–compatible:
 *   POST https://api.x.ai/v1/realtime/client_secrets
 *   SDP / WebSocket against https://api.x.ai/v1/realtime?model=…
 *
 * @see https://docs.x.ai/developers/model-capabilities/audio/voice-agent
 */

import { config } from "../config.js";
import { isUsableApiKey } from "./apiKeyUtils.js";
import {
  resolveRealtimeModel,
  buildRealtimeAllowlist,
  isAllowedRealtimeModel,
} from "./resolveRealtimeModel.js";

export const GROK_VOICE_MODELS = Object.freeze([
  "grok-voice-latest",
  "grok-voice-think-fast-1.0",
]);

export const OPENAI_REALTIME_BASE = "https://api.openai.com/v1/realtime";
export const XAI_REALTIME_BASE = "https://api.x.ai/v1/realtime";
export const OPENAI_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";
export const XAI_CLIENT_SECRETS_URL = "https://api.x.ai/v1/realtime/client_secrets";
export const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";
export const XAI_MODELS_URL = "https://api.x.ai/v1/models";

// Dead-mark: tras un fallo de mint/health de un engine (cuota, auth, timeout de
// egress — visto 2026-08-10: api.openai.com inalcanzable desde Cloud Run), se lo
// marca muerto por 5 min para que "auto" resuelva directo al otro engine sin
// esperar otro timeout. Mismo patrón que server/lib/embeddings.js.
const VOICE_DEAD_COOLDOWN_MS = 5 * 60 * 1000;
const _voiceDeadUntil = new Map();

/** @param {"openai"|"grok"} provider */
export function markVoiceProviderDead(provider) {
  _voiceDeadUntil.set(provider, Date.now() + VOICE_DEAD_COOLDOWN_MS);
}

/** @param {"openai"|"grok"} provider */
export function isVoiceProviderDead(provider) {
  return (_voiceDeadUntil.get(provider) || 0) > Date.now();
}

/** Test helper — clears in-process dead-marks. */
export function clearVoiceProviderDeadMarks() {
  _voiceDeadUntil.clear();
}

/**
 * Errores de mint que justifican fallback al otro engine: cuota/auth
 * (401/402/403/429), fallo del lado del provider (>=500) o error de red /
 * timeout (sin status HTTP).
 *
 * @param {Error & { status?: number }} err
 */
export function isVoiceMintFallbackError(err) {
  const s = Number(err?.status) || 0;
  if ([401, 402, 403, 429].includes(s)) return true;
  if (s >= 500) return true;
  return s === 0; // network error / AbortSignal timeout
}

/**
 * Effective duplex voice engine from chat selection.
 *
 * Prioridad: elección explícita del usuario > pin de ops (VOICE_PROVIDER) >
 * mapeo de aiProvider — y en el default "openai", fallback a Grok cuando la
 * key OpenAI no es usable o el engine está dead-marked y Grok sí está vivo.
 *
 * @param {string} aiProvider
 * @param {string} [explicitVoiceProvider]  optional override "openai" | "grok"
 * @param {{ pin?: string, openaiKeyOk?: boolean, grokKeyOk?: boolean }} [opts]
 *   test seams; production callers omit them.
 * @returns {"openai"|"grok"}
 */
export function resolveVoiceProvider(aiProvider, explicitVoiceProvider, opts = {}) {
  const ex = String(explicitVoiceProvider || "").trim().toLowerCase();
  if (ex === "openai" || ex === "grok") return ex;

  const pin = String(opts.pin ?? config.voiceProvider ?? "").trim().toLowerCase();
  if (pin === "openai" || pin === "grok") return pin;

  const p = String(aiProvider || "auto").trim().toLowerCase();
  if (p === "grok") return "grok";

  const openaiOk =
    opts.openaiKeyOk ?? (isUsableApiKey(config.openaiApiKey) && !isVoiceProviderDead("openai"));
  const grokOk =
    opts.grokKeyOk ??
    (isUsableApiKey(config.grokApiKey || process.env.XAI_API_KEY) && !isVoiceProviderDead("grok"));
  if (!openaiOk && grokOk) return "grok";
  return "openai";
}

/**
 * @param {"openai"|"grok"} voiceProvider
 * @param {string} aiProvider
 * @param {string} aiModel
 * @param {string|null} rawRealtimeModel
 */
export function resolveSessionModel(voiceProvider, aiProvider, aiModel, rawRealtimeModel) {
  if (voiceProvider === "grok") {
    const allow = [...GROK_VOICE_MODELS];
    const def = process.env.GROK_VOICE_MODEL || GROK_VOICE_MODELS[0];
    if (rawRealtimeModel && isAllowedRealtimeModel(String(rawRealtimeModel).trim(), allow)) {
      return String(rawRealtimeModel).trim();
    }
    // If user picked a grok text model, still use voice model (text ≠ voice)
    return def;
  }
  // openai
  const allow = buildRealtimeAllowlist(config.openaiRealtimeModel);
  let sessionModel = resolveRealtimeModel(aiProvider, aiModel, config.openaiRealtimeModel, allow);
  if (rawRealtimeModel != null && String(rawRealtimeModel).trim()) {
    const cand = String(rawRealtimeModel).trim();
    if (!isAllowedRealtimeModel(cand, allow)) {
      const err = new Error(`realtimeModel no permitido: ${cand}`);
      err.status = 400;
      err.allowlist = allow;
      throw err;
    }
    sessionModel = cand;
  }
  return sessionModel;
}

/**
 * @param {"openai"|"grok"} voiceProvider
 */
export function getVoiceProviderConfig(voiceProvider) {
  if (voiceProvider === "grok") {
    const apiKey = config.grokApiKey || process.env.XAI_API_KEY || "";
    return {
      voiceProvider: "grok",
      apiKey,
      keyOk: isUsableApiKey(apiKey),
      clientSecretsUrl: XAI_CLIENT_SECRETS_URL,
      realtimeBase: XAI_REALTIME_BASE,
      modelsUrl: XAI_MODELS_URL,
      missingKeyError: "GROK_API_KEY / XAI_API_KEY not configured for Grok Voice",
    };
  }
  const apiKey = config.openaiApiKey || "";
  return {
    voiceProvider: "openai",
    apiKey,
    keyOk: isUsableApiKey(apiKey),
    clientSecretsUrl: OPENAI_CLIENT_SECRETS_URL,
    realtimeBase: OPENAI_REALTIME_BASE,
    modelsUrl: OPENAI_MODELS_URL,
    missingKeyError: "OpenAI API key not configured",
  };
}

/**
 * Mint ephemeral client secret for the given provider.
 * @returns {Promise<{ id: string|null, model: string, client_secret: { value: string, expires_at: * }, voiceProvider: string, realtime_base: string }>}
 */
export async function mintRealtimeClientSecret({
  voiceProvider,
  sessionModel,
  systemPrompt,
  tools,
  signal,
}) {
  const cfg = getVoiceProviderConfig(voiceProvider);
  if (!cfg.keyOk) {
    const err = new Error(cfg.missingKeyError);
    err.status = 503;
    throw err;
  }

  let body;
  if (voiceProvider === "grok") {
    // xAI client_secrets: expires_after only (no nested session like OpenAI)
    body = {
      expires_after: { seconds: 300 },
    };
  } else {
    body = {
      session: {
        type: "realtime",
        model: sessionModel,
        instructions: systemPrompt,
        audio: {
          input: {
            transcription: { model: "whisper-1" },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 800,
            },
          },
          output: { voice: "shimmer" },
        },
        tools,
        tool_choice: "auto",
      },
    };
  }

  const response = await fetch(cfg.clientSecretsUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: signal || AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    const err = new Error(`mint failed ${response.status}`);
    err.status = response.status;
    err.body = errText;
    throw err;
  }

  const mintData = await response.json();

  // Normalize OpenAI vs xAI response shapes
  const secretValue =
    mintData.value ||
    mintData.client_secret?.value ||
    mintData.secret ||
    mintData.token ||
    null;
  const expiresAt =
    mintData.expires_at ||
    mintData.client_secret?.expires_at ||
    mintData.expires_after ||
    null;
  const sessionId = mintData.session?.id || mintData.id || mintData.session_id || null;
  const model =
    mintData.session?.model || mintData.model || sessionModel;

  if (!secretValue) {
    const err = new Error("No client_secret in mint response");
    err.status = 502;
    err.body = JSON.stringify(mintData).slice(0, 400);
    throw err;
  }

  return {
    id: sessionId,
    model,
    client_secret: { value: secretValue, expires_at: expiresAt },
    voiceProvider: cfg.voiceProvider,
    realtime_base: cfg.realtimeBase,
  };
}
