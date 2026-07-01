/**
 * AI Assistant Control Plane — registry (single source of truth)
 *
 * Every AI "assistant" (channel-bound surface) is declared here once: its human
 * label, the channel rules it uses, how to know if its dependencies are healthy,
 * and which assistant it falls back to when its own primary path is unhealthy or
 * throws. The terminal fallback for everyone is `seam` — the shared
 * `callAgentOnce()` in agentCore.js, which already fails over between LLM
 * providers (claude → grok → gemini → openai). So assistant-level failover always
 * degrades toward *more* robustness, never less.
 *
 * Two orthogonal layers of fallback exist:
 *   1. Provider layer — inside callAgentOnce (already built).
 *   2. Assistant layer — dispatchAssistant() walks `fallbackTo` to `seam`.
 *
 * The master switch (config.assistantsActive) decides which assistants are
 * allowed to GENERATE responses. `seam` is always enabled (it is the safety net).
 */
import { config } from "../config.js";
import { callAgentOnce } from "./agentCore.js";
import { getOmniPool, omniHealthCheck } from "./omni/omniDb.js";

/** @typedef {"canales"|"panelin"|"email"|"wa"|"ml"|"wolfboard"|"seam"} AssistantKey */

/**
 * Dependency probe result: { ok, detail } where detail names what's missing.
 * Probes must be cheap and side-effect-free (no LLM calls).
 */

/** Omni DB reachable + schema present — shared by canales (and the seam is DB-agnostic). */
async function checkOmniDb() {
  const pool = getOmniPool(config.databaseUrl);
  if (!pool) return { ok: false, detail: "no DATABASE_URL" };
  try {
    const h = await omniHealthCheck(pool);
    return { ok: h.ok, detail: h.ok ? "" : "omni schema missing" };
  } catch (err) {
    return { ok: false, detail: `omni db: ${String(err?.message).slice(0, 60)}` };
  }
}

/**
 * Registry. `deps` is an async fn returning { ok, detail }; omit for assistants
 * with no external dependency beyond a live provider (which is checked centrally).
 * `terminal: true` marks the seam — it has no fallback and is always enabled.
 */
export const ASSISTANTS = [
  {
    key: "canales",
    label: "Canales (Omni copilot)",
    channel: "chat",
    fallbackTo: "seam",
    deps: checkOmniDb,
  },
  {
    key: "panelin",
    label: "Panelin Chat",
    channel: "chat",
    fallbackTo: "seam",
  },
  {
    key: "email",
    label: "Email Agent",
    channel: "chat",
    fallbackTo: "seam",
    deps: async () => ({
      ok: !!config.chatwootApiToken,
      detail: config.chatwootApiToken ? "" : "no CHATWOOT_API_TOKEN",
    }),
  },
  {
    key: "wa",
    label: "WhatsApp Cockpit",
    channel: "wa",
    fallbackTo: "seam",
    deps: async () => ({
      ok: !!config.databaseUrl,
      detail: config.databaseUrl ? "" : "no DATABASE_URL",
    }),
  },
  {
    key: "ml",
    label: "MercadoLibre",
    channel: "ml",
    fallbackTo: "seam",
    deps: async () => ({
      ok: !!config.mlClientSecret,
      detail: config.mlClientSecret ? "" : "no ML_CLIENT_SECRET",
    }),
  },
  {
    key: "wolfboard",
    label: "Wolfboard Batch",
    channel: "chat",
    fallbackTo: "seam",
  },
  {
    key: "seam",
    label: "Shared agentCore seam",
    channel: "chat",
    fallbackTo: null,
    terminal: true,
  },
];

const BY_KEY = new Map(ASSISTANTS.map((a) => [a.key, a]));

/** @param {string} key */
export function getAssistant(key) {
  return BY_KEY.get(key) || null;
}

export function listAssistants() {
  return ASSISTANTS;
}

/**
 * Master switch. The shared seam is always enabled (it is the terminal safety
 * net); every other assistant must be listed in config.assistantsActive.
 * @param {string} key
 */
export function isAssistantEnabled(key) {
  if (key === "seam") return true;
  return config.assistantsActive.includes(key);
}

/**
 * Assistant-level dispatch with fallback. Runs the assistant's `handler`; if the
 * assistant is disabled it short-circuits, and if the handler throws it walks the
 * `fallbackTo` chain until it reaches an enabled assistant (ultimately `seam`,
 * which calls agentCore directly). Every hop is logged as `assistant_failover`
 * (mirrors the `agent_core_call` telemetry in agentCore.js).
 *
 * @param {string} key                     assistant to try first
 * @param {Array} messages                 chat messages for the seam terminal
 * @param {object} [opts]
 * @param {(a:object)=>Promise<any>} [opts.handler]  primary handler; defaults to the seam call
 * @param {object} [opts.callOpts]         opts forwarded to callAgentOnce at the seam
 * @returns {Promise<{ ok:true, result:any, servedBy:string, failovers:string[] }
 *                   | { ok:false, reason:string, assistant:string }>}
 */
export async function dispatchAssistant(key, messages, opts = {}) {
  const { handler = null, callOpts = {} } = opts;
  if (!isAssistantEnabled(key)) {
    return { ok: false, reason: "assistant_disabled", assistant: key };
  }

  const failovers = [];
  let current = getAssistant(key);
  let activeHandler = handler;
  let lastErr = null;

  while (current) {
    try {
      let result;
      if (current.terminal || !activeHandler) {
        result = await callAgentOnce(messages, {
          channel: current.channel,
          ...callOpts,
        });
      } else {
        result = await activeHandler(current);
      }
      return { ok: true, result, servedBy: current.key, failovers };
    } catch (err) {
      lastErr = err;
      const next = current.fallbackTo ? getAssistant(current.fallbackTo) : null;
      console.log(
        JSON.stringify({
          event: "assistant_failover",
          from: current.key,
          to: next?.key || null,
          reason: String(err?.message).slice(0, 100),
        }),
      );
      if (!next) break;
      failovers.push(next.key);
      current = next;
      // Only the seam handler runs past the first hop; downstream handlers are
      // surface-specific and can't serve another assistant's request.
      activeHandler = null;
    }
  }

  const e = new Error(
    `dispatchAssistant(${key}) exhausted fallback chain: ${lastErr?.message || "unknown"}`,
  );
  e.code = "ASSISTANT_DISPATCH_FAILED";
  e.cause = lastErr;
  throw e;
}
