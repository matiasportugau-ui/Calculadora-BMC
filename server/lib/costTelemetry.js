/**
 * Cost telemetry for agent / completion calls.
 * Closes the agentCore "cost-telemetry module" TODO with a single structured sink.
 */

/**
 * @typedef {object} CostEvent
 * @property {string} event
 * @property {string} [provider]
 * @property {string} [model]
 * @property {string} [channel]
 * @property {number} [latency_ms]
 * @property {number|null} [estimated_cost_usd]
 * @property {number|null} [input_tokens]
 * @property {number|null} [output_tokens]
 * @property {number|null} [cache_read_tokens]
 * @property {number|null} [cache_write_tokens]
 * @property {string|null} [task_key]
 * @property {string} [source]
 */

/**
 * Normalize and emit a structured cost/usage event.
 * Prefer pino logger when provided; fall back to JSON stdout (Cloud Run friendly).
 *
 * @param {CostEvent} partial
 * @param {{ info?: Function, debug?: Function } | null} [logger]
 * @returns {CostEvent}
 */
export function logAgentCost(partial, logger = null) {
  const payload = {
    event: partial.event || "agent_cost",
    ts: new Date().toISOString(),
    provider: partial.provider ?? null,
    model: partial.model ?? null,
    channel: partial.channel ?? null,
    latency_ms: partial.latency_ms ?? null,
    estimated_cost_usd: partial.estimated_cost_usd ?? null,
    input_tokens: partial.input_tokens ?? null,
    output_tokens: partial.output_tokens ?? null,
    cache_read_tokens: partial.cache_read_tokens ?? null,
    cache_write_tokens: partial.cache_write_tokens ?? null,
    task_key: partial.task_key ?? null,
    source: partial.source ?? "agent",
  };

  if (logger && typeof logger.info === "function") {
    logger.info(payload, payload.event);
  } else {
    // Structured single-line JSON — same shape agentCore used before.
    console.log(JSON.stringify(payload));
  }
  return payload;
}

/**
 * @param {number|null|undefined} usd
 * @returns {boolean}
 */
export function isPlausibleCost(usd) {
  if (usd == null || Number.isNaN(Number(usd))) return false;
  const n = Number(usd);
  return n >= 0 && n < 100;
}
