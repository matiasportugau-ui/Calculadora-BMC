/**
 * grokRealtimeTransport.js — pure helpers for xAI Grok Voice (WebSocket path).
 *
 * xAI Speech-to-Speech is WebSocket-first. Browser clients must NOT POST SDP to
 * https://api.x.ai/v1/realtime (returns 405 "Request method must be GET").
 * Use wss:// + ephemeral subprotocol instead.
 *
 * @see https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech
 */

export const GROK_VOICE_SAMPLE_RATE = 24_000;
export const XAI_CLIENT_SECRET_PROTOCOL_PREFIX = "xai-client-secret.";

/**
 * Build wss URL for Grok realtime from server mint fields.
 *
 * @param {{ realtime_base?: string|null, model?: string|null }} session
 * @returns {string}
 */
export function buildGrokRealtimeWsUrl(session = {}) {
  const rawBase = String(session.realtime_base || session.realtimeBase || "https://api.x.ai/v1/realtime")
    .trim()
    .replace(/\/+$/, "");
  if (!rawBase) {
    throw new Error("realtime_base missing for Grok WebSocket");
  }
  // Accept https or wss; normalize to wss for browser WS.
  let base = rawBase;
  if (/^https:\/\//i.test(base)) {
    base = base.replace(/^https:/i, "wss:");
  } else if (/^http:\/\//i.test(base)) {
    base = base.replace(/^http:/i, "ws:");
  } else if (!/^wss?:\/\//i.test(base)) {
    throw new Error(`realtime_base must be http(s)/ws(s) URL, got: ${base.slice(0, 48)}`);
  }
  const model = session.model != null ? String(session.model).trim() : "";
  if (!model) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}model=${encodeURIComponent(model)}`;
}

/**
 * Browser WebSocket cannot set Authorization headers.
 * xAI documents: pass ephemeral token as subprotocol `xai-client-secret.<token>`.
 *
 * @param {string} ephemeralToken
 * @returns {string[]}
 */
export function buildGrokWsProtocols(ephemeralToken) {
  const t = String(ephemeralToken || "").trim();
  if (!t) {
    throw new Error("ephemeral token required for Grok WebSocket");
  }
  // Token may already include a prefix in some mint shapes — avoid double prefix.
  if (t.startsWith(XAI_CLIENT_SECRET_PROTOCOL_PREFIX)) {
    return [t];
  }
  // Strip accidental "Bearer " if a caller passed the header value.
  const bare = t.replace(/^Bearer\s+/i, "");
  return [`${XAI_CLIENT_SECRET_PROTOCOL_PREFIX}${bare}`];
}

/**
 * True when duplex must use WebSocket (Grok/xAI), not OpenAI-style SDP POST.
 * @param {string} voiceProvider
 */
export function usesGrokWebSocketTransport(voiceProvider) {
  const p = String(voiceProvider || "").trim().toLowerCase();
  return p === "grok" || p === "xai";
}

/**
 * Float32 [-1,1] → base64 little-endian PCM16 (Realtime input_audio_buffer.append).
 * @param {Float32Array} float32
 * @returns {string}
 */
export function float32ToBase64Pcm16(float32) {
  const len = float32?.length || 0;
  const pcm16 = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return bytesToBase64(new Uint8Array(pcm16.buffer));
}

/**
 * base64 PCM16 LE → Float32 [-1,1]
 * @param {string} b64
 * @returns {Float32Array}
 */
export function base64Pcm16ToFloat32(b64) {
  const bytes = base64ToBytes(String(b64 || ""));
  const pcm16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
  const out = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    out[i] = pcm16[i] / 32768;
  }
  return out;
}

/**
 * Naive resample Float32 (linear). Used when AudioContext.sampleRate ≠ target.
 * @param {Float32Array} input
 * @param {number} fromRate
 * @param {number} toRate
 * @returns {Float32Array}
 */
export function resampleFloat32Linear(input, fromRate, toRate) {
  if (!input?.length || !fromRate || !toRate || fromRate === toRate) {
    return input || new Float32Array(0);
  }
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const t = src - i0;
    out[i] = input[i0] * (1 - t) + input[i1] * t;
  }
  return out;
}

/**
 * Build session.update payload for Grok after WS open.
 * @param {{ instructions?: string, tools?: unknown[], tool_choice?: string, voice?: string }} boot
 */
export function buildGrokSessionUpdate(boot = {}) {
  const session = {
    instructions: boot.instructions || "",
    voice: boot.voice || "eve",
    turn_detection: {
      type: "server_vad",
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 800,
    },
    audio: {
      input: { format: { type: "audio/pcm", rate: GROK_VOICE_SAMPLE_RATE } },
      output: { format: { type: "audio/pcm", rate: GROK_VOICE_SAMPLE_RATE } },
    },
  };
  if (boot.language_hint || (Array.isArray(boot.keyterms) && boot.keyterms.length)) {
    session.audio.input.transcription = {};
    if (boot.language_hint) session.audio.input.transcription.language_hint = boot.language_hint;
    if (Array.isArray(boot.keyterms) && boot.keyterms.length) {
      session.audio.input.transcription.keyterms = boot.keyterms;
    }
  }
  if (boot.replace && typeof boot.replace === "object") {
    session.replace = boot.replace;
  }
  if (boot.turn_detection && typeof boot.turn_detection === "object") {
    session.turn_detection = { ...session.turn_detection, ...boot.turn_detection };
  }
  if (boot.reasoning && typeof boot.reasoning === "object") {
    session.reasoning = boot.reasoning;
  }
  if (boot.resumption && typeof boot.resumption === "object") {
    session.resumption = boot.resumption;
  }
  if (Array.isArray(boot.tools) && boot.tools.length) {
    session.tools = boot.tools;
    session.tool_choice = boot.tool_choice || "auto";
  }
  return { type: "session.update", session };
}

function bytesToBase64(bytes) {
  // Browser-safe (and Node via global btoa when available). Avoid bare `Buffer`
  // so ESLint browser env does not flag no-undef.
  const btoaFn = globalThis.btoa?.bind(globalThis);
  if (!btoaFn) {
    throw new Error("btoa not available for PCM base64 encode");
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoaFn(binary);
}

function base64ToBytes(b64) {
  const atobFn = globalThis.atob?.bind(globalThis);
  if (!atobFn) {
    throw new Error("atob not available for PCM base64 decode");
  }
  const binary = atobFn(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
