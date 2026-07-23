/**
 * IMP-02 — Shared turn observability for SSE chat and callAgentOnce.
 * Normalizes field names so Cloud Logging queries work across paths.
 */
import { estimateCostUSD } from "./aiProviderConfig.js";
import { logAgentCost } from "./costTelemetry.js";

/**
 * @typedef {object} AgentTurnInput
 * @property {string} path — "sse" | "agentCore"
 * @property {string} provider
 * @property {string} [model]
 * @property {string} [channel]
 * @property {string} [assistant]
 * @property {number} [latency_ms]
 * @property {number|null} [ttft_ms]
 * @property {number|null} [input_tokens]
 * @property {number|null} [output_tokens]
 * @property {number|null} [cache_read_tokens]
 * @property {number|null} [cache_write_tokens]
 * @property {string|null} [conversation_id]
 * @property {string|null} [task_key]
 * @property {number} [kb_match_count]
 * @property {boolean} [dev_mode]
 */

/**
 * Emit normalized turn + cost events (pino when logger provided).
 *
 * @param {AgentTurnInput} input
 * @param {{ info?: Function, debug?: Function } | null} [logger]
 * @returns {{ turn: object, cost: object }}
 */
export function logAgentTurn(input, logger = null) {
  const provider = input.provider ?? null;
  const model = input.model ?? null;
  const channel = input.channel ?? null;
  const latency_ms = input.latency_ms ?? null;
  const input_tokens = input.input_tokens ?? null;
  const output_tokens = input.output_tokens ?? null;

  const estimated_cost_usd = estimateCostUSD(provider, model, {
    input_tokens,
    output_tokens,
    cache_read_input_tokens: input.cache_read_tokens ?? undefined,
    cache_creation_input_tokens: input.cache_write_tokens ?? undefined,
  });

  const turn = {
    event: "agent_turn",
    path: input.path || "unknown",
    provider,
    model,
    channel,
    assistant: input.assistant ?? channel,
    latency_ms,
    ttft_ms: input.ttft_ms ?? null,
    input_tokens,
    output_tokens,
    cache_read_tokens: input.cache_read_tokens ?? null,
    cache_write_tokens: input.cache_write_tokens ?? null,
    estimated_cost_usd,
    conversation_id: input.conversation_id ?? null,
    task_key: input.task_key ?? null,
    kb_match_count: input.kb_match_count ?? null,
    dev_mode: input.dev_mode ?? undefined,
    ts: new Date().toISOString(),
  };

  const costEvent = input.path === "agentCore" ? "agent_core_call" : "chat_turn_cost";
  const cost = logAgentCost(
    {
      event: costEvent,
      provider,
      model,
      channel,
      latency_ms,
      estimated_cost_usd,
      input_tokens,
      output_tokens,
      cache_read_tokens: input.cache_read_tokens ?? null,
      cache_write_tokens: input.cache_write_tokens ?? null,
      task_key: input.task_key ?? null,
      source: input.path === "agentCore" ? "agentCore" : "agentChat",
    },
    logger,
  );

  if (logger && typeof logger.info === "function") {
    logger.info(turn, "agent_turn");
  } else {
    console.log(JSON.stringify(turn));
  }

  return { turn, cost };
}
