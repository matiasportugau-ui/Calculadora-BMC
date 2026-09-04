/**
 * Public storefront text-to-text (Panelin Front).
 * Same allowlist as voice. Shop tools are returned for the browser widget.
 */
import OpenAI from "openai";
import { config } from "../../config.js";
import { isUsableApiKey } from "../apiKeyUtils.js";
import { isStorefrontShopTool } from "./storefrontVoicePack.js";
import {
  isStorefrontBackendFailoverError,
  isStorefrontTextQuotaError,
  markStorefrontCreditsDead,
  markStorefrontCreditsLive,
  normalizeLlmError,
  storefrontVoiceBubbleOn,
} from "./storefrontVoiceCredits.js";

export const STOREFRONT_CHAT_MODEL = process.env.STOREFRONT_CHAT_MODEL || "grok-3-mini";
export const STOREFRONT_CHAT_FALLBACK_MODEL =
  process.env.STOREFRONT_CHAT_FALLBACK_MODEL || "gemini-2.5-flash-lite";
export const GEMINI_OPENAI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/";

export function listStorefrontChatBackends(cfg = config) {
  const out = [];
  if (isUsableApiKey(cfg.grokApiKey)) {
    out.push({
      provider: "grok",
      apiKey: cfg.grokApiKey,
      baseURL: "https://api.x.ai/v1",
      model: STOREFRONT_CHAT_MODEL,
    });
  }
  if (isUsableApiKey(cfg.geminiApiKey)) {
    out.push({
      provider: "gemini",
      apiKey: cfg.geminiApiKey,
      baseURL: GEMINI_OPENAI_BASE,
      model: STOREFRONT_CHAT_FALLBACK_MODEL,
    });
  }
  if (isUsableApiKey(cfg.openaiApiKey)) {
    out.push({
      provider: "openai",
      apiKey: cfg.openaiApiKey,
      baseURL: "",
      model: "gpt-4o-mini",
    });
  }
  return out;
}
const MAX_ROUNDS = 6;
const MAX_HISTORY = 20;
const TEXT_HINT =
  "\n\n## Text channel\nThe shopper typed this message in the same thread as voice. " +
  "Do not reset context. Do not ask them to tap Hablar. " +
  "Sell loop: name the buy, open the ficha, cart listed SKUs, offer aproximación+PDF for obra. " +
  "When they must pick, call present_choices (2–4 tap chips). Do not wait for them to insist. " +
  "Never quote flete. Same disclaimer + calculator + PDF + capture_lead rules as voice.";

export function packToolsToOpenAI(packTools) {
  const out = [];
  for (const t of packTools || []) {
    if (!t || t.type === "web_search") continue;
    const name = t.name;
    if (!name) continue;
    out.push({
      type: "function",
      function: {
        name,
        description: t.description || "",
        parameters: t.parameters || { type: "object", properties: {} },
      },
    });
  }
  return out;
}

export function sanitizeChatHistory(history) {
  if (!Array.isArray(history)) return [];
  const out = [];
  for (const row of history.slice(-MAX_HISTORY)) {
    if (!row || typeof row !== "object") continue;
    const role = String(row.role || "");
    if (role === "user" || role === "assistant") {
      const content = String(row.content || "").slice(0, 4000);
      if (Array.isArray(row.tool_calls) && row.tool_calls.length) {
        out.push({ role: "assistant", content: content || null, tool_calls: row.tool_calls });
        continue;
      }
      if (content) out.push({ role, content });
      continue;
    }
    if (role === "tool") {
      out.push({
        role: "tool",
        tool_call_id: String(row.tool_call_id || "").slice(0, 80),
        content: String(row.content || "").slice(0, 6000),
      });
    }
  }
  return out;
}

function parseArgs(raw) {
  if (raw && typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw || "{}"));
  } catch {
    return {};
  }
}

/**
 * @param {{
 *   message?: string,
 *   history?: object[],
 *   pageUrl?: string,
 *   toolResults?: { id?: string, tool_call_id?: string, name?: string, result?: string }[],
 *   pack: object,
 *   runServerTool: (name: string, args: object) => Promise<string>,
 * }} opts
 */
function openBackendClient(backend) {
  const opts = { apiKey: backend.apiKey };
  if (backend.baseURL) opts.baseURL = backend.baseURL;
  return new OpenAI(opts);
}

function completionPayload(backend, messages, tools) {
  return {
    model: backend.model,
    messages,
    tools: tools.length ? tools : undefined,
    tool_choice: tools.length ? "auto" : undefined,
    temperature: 0.4,
    max_tokens: 700,
  };
}

async function createCompletion(client, backend, messages, tools) {
  const payload = completionPayload(backend, messages, tools);
  try {
    return await client.chat.completions.create(payload);
  } catch (err) {
    if (normalizeLlmError(err).status !== 429 && !/\b429\b/.test(String(err?.message || ""))) throw err;
    await new Promise((r) => setTimeout(r, 800));
    return client.chat.completions.create(payload);
  }
}

async function completeStorefrontTurn(messages, tools) {
  let backends = listStorefrontChatBackends();
  if (!storefrontVoiceBubbleOn()) {
    const rest = backends.filter((b) => b.provider !== "grok");
    if (rest.length) backends = rest;
  }
  if (!backends.length) {
    const err = new Error("Texto no disponible (falta clave de IA).");
    err.status = 503;
    throw err;
  }

  let lastErr = null;
  for (const backend of backends) {
    const client = openBackendClient(backend);
    try {
      const completion = await createCompletion(client, backend, messages, tools);
      if (backend.provider === "grok") markStorefrontCreditsLive();
      return { completion, backend, client };
    } catch (err) {
      lastErr = err;
      if (backend.provider === "grok") markStorefrontCreditsDead(err);
      // Credits/429 and Grok 5xx/network must not strand /chat when Gemini/OpenAI exist.
      if (isStorefrontBackendFailoverError(err)) continue;
      throw err;
    }
  }
  const fail = lastErr || new Error("No se pudo responder.");
  if (!fail.status) {
    fail.status = isStorefrontTextQuotaError(fail) ? 403 : 502;
  }
  throw fail;
}

export async function runStorefrontTextTurn(opts) {
  const pack = opts.pack;
  const tools = packToolsToOpenAI(pack.tools);
  const messages = [
    { role: "system", content: String(pack.instructions || "") + TEXT_HINT },
    ...sanitizeChatHistory(opts.history),
  ];
  const incoming = String(opts.message || "").trim().slice(0, 2000);
  if (incoming) messages.push({ role: "user", content: incoming });
  if (Array.isArray(opts.toolResults) && opts.toolResults.length) {
    for (const tr of opts.toolResults) {
      messages.push({
        role: "tool",
        tool_call_id: String(tr.tool_call_id || tr.id || "").slice(0, 80),
        content: String(tr.result || tr.content || "").slice(0, 6000),
      });
    }
  }
  if (messages.length < 2) {
    const err = new Error("Escribí una consulta.");
    err.status = 400;
    throw err;
  }

  let clientActions = [];
  let text = "";
  let used = { provider: "grok", model: STOREFRONT_CHAT_MODEL };
  let lockedClient = null;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    let completion;
    if (lockedClient) {
      try {
        completion = await createCompletion(
          lockedClient.client,
          lockedClient.backend,
          messages,
          tools,
        );
      } catch (err) {
        if (lockedClient.backend.provider === "grok") markStorefrontCreditsDead(err);
        if (!isStorefrontBackendFailoverError(err)) throw err;
        // Drop the dead lock and re-pick (skips Grok when bubble cache is dry).
        lockedClient = null;
        const picked = await completeStorefrontTurn(messages, tools);
        lockedClient = picked;
        used = { provider: picked.backend.provider, model: picked.backend.model };
        completion = picked.completion;
      }
    } else {
      const picked = await completeStorefrontTurn(messages, tools);
      lockedClient = picked;
      used = { provider: picked.backend.provider, model: picked.backend.model };
      completion = picked.completion;
    }
    const msg = completion.choices?.[0]?.message;
    if (!msg) break;
    messages.push(msg);
    const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
    if (!calls.length) {
      text = String(msg.content || "").trim();
      break;
    }

    const shopCalls = [];
    for (const call of calls) {
      const name = call.function?.name || call.name || "";
      const args = parseArgs(call.function?.arguments);
      const id = call.id || "";
      if (isStorefrontShopTool(name)) {
        shopCalls.push({ id, name, payload: args });
        continue;
      }
      let result = JSON.stringify({ ok: false, error: "tool failed" });
      try {
        result = await opts.runServerTool(name, args);
      } catch (err) {
        result = JSON.stringify({ ok: false, error: err?.message || "tool failed" });
      }
      messages.push({ role: "tool", tool_call_id: id, content: result });
      if (name === "generar_pdf") {
        try {
          const parsed = JSON.parse(result);
          const lines = Array.isArray(parsed.cart_lines) ? parsed.cart_lines : [];
          if (lines.length) {
            shopCalls.push({
              id: `${id}-cart`,
              name: "add_quote_to_cart",
              payload: {
                lines,
                pdf_url: parsed.pdf_url || parsed.pdf_file_url || "",
                code: parsed.code || "",
              },
            });
          }
        } catch {
          /* ignore */
        }
      }
    }

    if (shopCalls.length) {
      clientActions = shopCalls;
      text = String(msg.content || "").trim();
      break;
    }
  }

  const historyOut = messages
    .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "tool")
    .map((m) => {
      if (m.role === "tool") {
        return { role: "tool", tool_call_id: m.tool_call_id, content: m.content };
      }
      if (m.role === "assistant" && m.tool_calls) {
        return { role: "assistant", content: m.content || "", tool_calls: m.tool_calls };
      }
      return { role: m.role, content: m.content || "" };
    })
    .slice(-MAX_HISTORY);

  return {
    ok: true,
    text,
    client_actions: clientActions,
    history: historyOut,
    model: used.model,
    provider: used.provider,
  };
}
