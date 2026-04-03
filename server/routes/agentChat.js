/**
 * POST /api/agent/chat — SSE streaming endpoint for the Panelin AI agent.
 *
 * Provider chain: claude → grok → openai (first available key wins; falls through on error).
 *
 * Request:  { messages: [{role, content}], calcState: {...} }
 * Response: text/event-stream, events:
 *   {"type":"text","delta":"..."}
 *   {"type":"action","action":{"type":"setTecho","payload":{...}}}
 *   {"type":"done"}
 *   {"type":"error","message":"..."}
 */
import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { buildSystemPrompt } from "../lib/chatPrompts.js";

const router = Router();

router.post("/agent/chat", async (req, res) => {
  const { messages = [], calcState = {} } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ ok: false, error: "messages array required" });
  }

  const hasAnthropic = !!config.anthropicApiKey;
  const hasGrok      = !!config.grokApiKey;
  const hasOpenAI    = !!config.openaiApiKey;

  if (!hasAnthropic && !hasGrok && !hasOpenAI) {
    return res.status(503).json({ ok: false, error: "AI not configured" });
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx / Cloud Run buffering

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  /** Process buffered text: emit text events, extract ACTION_JSON directives. Returns leftover tail. */
  function flushLines(buf) {
    const lines = buf.split("\n");
    const tail = lines.pop(); // keep incomplete last line
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("ACTION_JSON:")) {
        try {
          const action = JSON.parse(trimmed.slice("ACTION_JSON:".length).trim());
          send({ type: "action", action });
        } catch {
          if (line) send({ type: "text", delta: line + "\n" });
        }
      } else if (line !== "") {
        send({ type: "text", delta: line + "\n" });
      }
    }
    return tail;
  }

  function flushTail(tail) {
    const trimmed = tail.trim();
    if (!trimmed) return;
    if (trimmed.startsWith("ACTION_JSON:")) {
      try {
        const action = JSON.parse(trimmed.slice("ACTION_JSON:".length).trim());
        send({ type: "action", action });
      } catch {
        send({ type: "text", delta: trimmed });
      }
    } else {
      send({ type: "text", delta: trimmed });
    }
  }

  const systemPrompt = buildSystemPrompt(calcState);
  const msgs = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content || "") }));

  const providerChain = [];
  if (hasAnthropic) providerChain.push("claude");
  if (hasGrok)      providerChain.push("grok");
  if (hasOpenAI)    providerChain.push("openai");

  for (const provider of providerChain) {
    try {
      let buf = "";

      if (provider === "claude") {
        const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
        const stream = anthropic.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: systemPrompt,
          messages: msgs,
        });
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta?.type === "text_delta" &&
            chunk.delta.text
          ) {
            buf += chunk.delta.text;
            buf = flushLines(buf);
          }
        }
      } else {
        const { default: OpenAI } = await import("openai");
        const client =
          provider === "grok"
            ? new OpenAI({ apiKey: config.grokApiKey, baseURL: "https://api.x.ai/v1" })
            : new OpenAI({ apiKey: config.openaiApiKey });
        const model = provider === "grok" ? "grok-3-mini" : "gpt-4o-mini";

        const stream = await client.chat.completions.create({
          model,
          max_tokens: 1024,
          stream: true,
          messages: [{ role: "system", content: systemPrompt }, ...msgs],
        });
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            buf += delta;
            buf = flushLines(buf);
          }
        }
      }

      flushTail(buf);
      send({ type: "done" });
      res.end();
      return; // success
    } catch {
      // Try next provider
    }
  }

  // All providers failed
  send({ type: "error", message: "Todos los proveedores de IA fallaron. Intentá más tarde." });
  res.end();
});

export default router;
