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
import { getAvailableProviders } from "./aiProviderConfig.js";
import { getOmniPool, omniHealthCheck } from "./omni/omniDb.js";
import { isChatwootConfigured } from "./chatwootClient.js";
import { getSetting } from "./waConfig.js";

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
    // Health mirrors the SAME gate the route + tools use: isChatwootConfigured()
    // requires base + token + accountId (chatwootClient.js). Checking the token
    // alone reported a false "live" when base/accountId were missing while every
    // Chatwoot tool still threw chatwoot_not_configured. (Live email via Gmail/Omni
    // runs under the `canales` assistant, not here.)
    deps: async () => ({
      ok: isChatwootConfigured(),
      detail: isChatwootConfigured()
        ? ""
        : "chatwoot not configured (need CHATWOOT_API_BASE + CHATWOOT_API_TOKEN + CHATWOOT_ACCOUNT_ID)",
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
  if (key === "seam") return true; // safety net: always on, not overridable
  // Runtime override (wa_settings 'assistants' map) wins over the env allowlist,
  // so an admin can enable/disable an assistant WITHOUT a redeploy. getSetting
  // reads waConfig's in-memory cache (sync, cross-instance via LISTEN/NOTIFY).
  // Tolerant: if waConfig isn't primed (offline/tests), fall back to the env.
  try {
    const ov = getSetting("assistants")?.[key];
    if (typeof ov === "boolean") return ov;
  } catch { /* not primed → env default */ }
  return config.assistantsActive.includes(key);
}

/**
 * Priority order for the assistant fallback LINE. When the requested assistant is
 * unavailable or fails, dispatch advances to the next ENABLED assistant in this
 * order (disabled ones are skipped — honors ASSISTANTS_ACTIVE), and finally the
 * always-on shared `seam` (provider chain). So there is always an available agent
 * as long as at least one LLM provider key is set.
 */
export const ASSISTANT_PRIORITY = ["canales", "panelin", "email", "wa", "ml", "wolfboard"];

/**
 * O(1) availability probe for a fallback node — no I/O, no LLM call, no DB. A node
 * is available iff a provider key exists AND (it's the seam OR it's enabled). We
 * deliberately do NOT run the assistant's `deps` probe here: it can hit the DB
 * (canales → omniHealthCheck), and the copilot's LLM call doesn't need the inbox
 * schema anyway, so a slow/missing schema must not skip a copilot that can answer.
 * `deps` is still used for the health panel (assistantHealth), which is cached.
 * @param {object} node
 */
function isNodeAvailable(node) {
  if (!node) return false;
  if (getAvailableProviders().length === 0) return false; // no LLM at all → nothing can serve
  if (node.terminal) return true; // seam: a provider exists
  return isAssistantEnabled(node.key);
}

/**
 * Build the ordered fallback line for a primary assistant: the primary first,
 * then every OTHER **enabled** assistant in ASSISTANT_PRIORITY order (disabled
 * ones excluded), terminating at the always-on `seam`.
 * @param {string} primaryKey
 */
export function buildFallbackLine(primaryKey) {
  const line = [];
  const primary = getAssistant(primaryKey);
  if (primary) line.push(primary);
  for (const k of ASSISTANT_PRIORITY) {
    if (k === primaryKey) continue;
    if (isAssistantEnabled(k)) line.push(getAssistant(k));
  }
  line.push(getAssistant("seam"));
  return line.filter(Boolean);
}

/**
 * Assistant-level dispatch with a guaranteed-available fallback LINE.
 *
 * Tries the requested assistant's `handler` first; if that assistant is
 * unavailable (skipped proactively) or throws, it advances to the next ENABLED
 * assistant in ASSISTANT_PRIORITY, and finally the shared `seam` (which calls
 * agentCore directly and is available as long as any provider key exists). Every
 * skip/error/failover is logged. Disabled assistants are never promoted — the
 * line honors ASSISTANTS_ACTIVE, so canales-only stays canales-only.
 *
 * @param {string} key                     assistant to try first
 * @param {Array} messages                 chat messages for the seam terminal
 * @param {object} [opts]
 * @param {(a:object)=>Promise<any>} [opts.handler]  primary handler; defaults to the seam call
 * @param {object} [opts.callOpts]         opts forwarded to callAgentOnce at seam/promoted nodes
 * @returns {Promise<{ ok:true, result:any, servedBy:string, failovers:string[] }
 *                   | { ok:false, reason:string, assistant:string }>}
 * @throws {Error} code `ASSISTANT_DISPATCH_FAILED` when the whole line is
 *   exhausted (no available agent — e.g. no provider keys). Callers should catch
 *   this; the canales copilot lets it fall to its 502 handler.
 */
export async function dispatchAssistant(key, messages, opts = {}) {
  const { handler = null, callOpts = {} } = opts;
  if (!isAssistantEnabled(key)) {
    return { ok: false, reason: "assistant_disabled", assistant: key };
  }

  const line = buildFallbackLine(key);
  const failovers = [];
  let activeHandler = handler;
  let lastErr = null;

  for (const node of line) {
    // Proactively skip an unavailable node before spending an LLM call.
    if (!isNodeAvailable(node)) {
      failovers.push(node.key);
      activeHandler = null; // the primary's surface-specific handler can't serve a later node
      console.log(JSON.stringify({ event: "assistant_skip", assistant: node.key, reason: "unavailable" }));
      continue;
    }
    try {
      const result =
        node.terminal || !activeHandler
          ? await callAgentOnce(messages, { channel: node.channel, ...callOpts })
          : await activeHandler(node);
      if (failovers.length) {
        console.log(JSON.stringify({ event: "assistant_failover", servedBy: node.key, passedOver: failovers }));
      }
      return { ok: true, result, servedBy: node.key, failovers };
    } catch (err) {
      lastErr = err;
      failovers.push(node.key);
      activeHandler = null; // downstream nodes are surface-specific — only the seam can serve them
      console.log(JSON.stringify({ event: "assistant_error", assistant: node.key, reason: String(err?.message).slice(0, 100) }));
    }
  }

  const e = new Error(
    `dispatchAssistant(${key}) exhausted fallback line: ${lastErr?.message || "no available agent"}`,
  );
  e.code = "ASSISTANT_DISPATCH_FAILED";
  e.cause = lastErr;
  throw e;
}
