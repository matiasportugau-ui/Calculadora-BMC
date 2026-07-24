/**
 * IMP-02 — Shared agent-turn observability for SSE chat and callAgentOnce.
 *
 * Normalizes core fields so both brains emit the same shape for Cloud Logging
 * queries. Cost-specific sinks still use costTelemetry.logAgentCost; this is
 * the turn-level parity envelope.
 */

/**
 * @typedef {object} AgentTurnEvent
 * @property {string} event
 * @property {string|null} [channel]
 * @property {string|null} [assistant]
 * @property {string|null} [provider]
 * @property {string|null} [model]
 * @property {number|null} [input_tokens]
 * @property {number|null} [output_tokens]
 * @property {number|null} [estimated_cost_usd]
 * @property {number|null} [latency_ms]
 * @property {string|null} [source]
 * @property {string} [ts]
 */

/**
 * Build a normalized turn payload (pure; no I/O).
 * @param {Partial<AgentTurnEvent> & Record<string, unknown>} partial
 * @returns {AgentTurnEvent}
 */
export function normalizeAgentTurn(partial = {}) {
  const num = (v) => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    event: partial.event || "agent_turn",
    ts: partial.ts || new Date().toISOString(),
    channel: partial.channel ?? null,
    assistant: partial.assistant ?? null,
    provider: partial.provider ?? null,
    model: partial.model ?? null,
    input_tokens: num(partial.input_tokens),
    output_tokens: num(partial.output_tokens),
    estimated_cost_usd: num(partial.estimated_cost_usd),
    latency_ms: num(partial.latency_ms),
    source: partial.source ?? null,
  };
}

/**
 * Core field names required for SSE ↔ callAgentOnce parity.
 */
export const AGENT_TURN_CORE_FIELDS = [
  "event",
  "channel",
  "provider",
  "input_tokens",
  "output_tokens",
  "estimated_cost_usd",
  "latency_ms",
  "source",
];

/**
 * @param {Partial<AgentTurnEvent>} partial
 * @returns {boolean}
 */
export function hasCoreAgentTurnFields(partial) {
  const n = normalizeAgentTurn(partial);
  return AGENT_TURN_CORE_FIELDS.every((k) => Object.prototype.hasOwnProperty.call(n, k));
}

/**
 * Emit a structured agent-turn event (pino when provided, else JSON stdout).
 * @param {Partial<AgentTurnEvent>} partial
 * @param {{ info?: Function } | null} [logger]
 * @returns {AgentTurnEvent}
 */
export function logAgentTurn(partial, logger = null) {
  const payload = normalizeAgentTurn(partial);
  if (logger && typeof logger.info === "function") {
    logger.info(payload, payload.event);
  } else {
    console.log(JSON.stringify(payload));
  }
  return payload;
}
