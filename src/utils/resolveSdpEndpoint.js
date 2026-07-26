/**
 * Build the WebRTC SDP POST URL for OpenAI Realtime / Grok Voice Agent.
 * Client MUST use the server-returned realtime_base (not a hardcoded host).
 *
 * @param {{ realtime_base?: string|null, model?: string|null }} session
 * @param {string} [fallbackBase]
 * @returns {string}
 */
export const DEFAULT_REALTIME_SDP_BASE = "https://api.openai.com/v1/realtime";

export function resolveSdpEndpoint(session, fallbackBase = DEFAULT_REALTIME_SDP_BASE) {
  const rawBase =
    (session && (session.realtime_base || session.realtimeBase)) ||
    fallbackBase ||
    DEFAULT_REALTIME_SDP_BASE;
  const base = String(rawBase).trim().replace(/\/+$/, "");
  const model = session?.model != null ? String(session.model).trim() : "";
  if (!base) {
    throw new Error("realtime_base missing for SDP negotiation");
  }
  // Reject accidental empty-host or relative URLs — Realtime is always absolute HTTPS.
  if (!/^https:\/\//i.test(base)) {
    throw new Error(`realtime_base must be https URL, got: ${base.slice(0, 40)}`);
  }
  return `${base}?model=${encodeURIComponent(model)}`;
}

/**
 * Effective Live duplex engine from chat AI selection.
 * @param {string} aiProvider
 * @returns {"openai"|"grok"}
 */
export function resolveLiveVoiceEngine(aiProvider) {
  const p = String(aiProvider || "auto").trim().toLowerCase();
  if (p === "grok") return "grok";
  return "openai";
}
