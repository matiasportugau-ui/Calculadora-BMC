/**
 * Public storefront text-to-text (Panelin Front).
 * Same allowlist as voice. Shop tools are returned for the browser widget.
 */
import OpenAI from "openai";
import { config } from "../../config.js";
import { isStorefrontShopTool } from "./storefrontVoicePack.js";

export const STOREFRONT_CHAT_MODEL = process.env.STOREFRONT_CHAT_MODEL || "grok-3-mini";
const MAX_ROUNDS = 6;
const MAX_HISTORY = 20;
const TEXT_HINT =
  "\n\n## Text channel\nThe shopper typed this message in the same thread as voice. " +
  "Do not reset context. Do not ask them to tap Hablar. " +
  "Classify → assess → green. Prefer website + cart. Quote only if they insist. " +
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
export async function runStorefrontTextTurn(opts) {
  const grokKey = config.grokApiKey;
  if (!grokKey) {
    const err = new Error("Texto no disponible (falta GROK_API_KEY).");
    err.status = 503;
    throw err;
  }
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

  const client = new OpenAI({ apiKey: grokKey, baseURL: "https://api.x.ai/v1" });
  let clientActions = [];
  let text = "";

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const completion = await client.chat.completions.create({
      model: STOREFRONT_CHAT_MODEL,
      messages,
      tools: tools.length ? tools : undefined,
      tool_choice: tools.length ? "auto" : undefined,
      temperature: 0.4,
      max_tokens: 700,
    });
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
    model: STOREFRONT_CHAT_MODEL,
  };
}
