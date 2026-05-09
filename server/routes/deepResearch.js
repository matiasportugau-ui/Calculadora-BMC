/**
 * Deep Research API — wrapper sobre OpenAI Responses API en background mode.
 *
 *   POST /api/research/deep        { query, model?, system?, tools? }
 *   GET  /api/research/deep/:id    → estado + output cuando esté listo
 *   POST /api/research/deep/:id/cancel
 *
 * Usa los modelos `o4-mini-deep-research` / `o3-deep-research`, que requieren
 * al menos una herramienta de búsqueda (web_search_preview por defecto).
 */
import { Router } from "express";
import { config } from "../config.js";

const DEFAULT_MODEL = "o4-mini-deep-research";
const ALLOWED_MODELS = new Set(["o4-mini-deep-research", "o3-deep-research"]);
const OPENAI_BASE = "https://api.openai.com/v1";

async function openaiFetch(path, init = {}) {
  const apiKey = config.openaiApiKey;
  if (!apiKey) {
    const err = new Error("OPENAI_API_KEY not configured");
    err.status = 503;
    throw err;
  }
  const res = await fetch(`${OPENAI_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error?.message || `OpenAI ${res.status}`);
    err.status = res.status;
    err.details = body;
    throw err;
  }
  return body;
}

function extractFinalText(response) {
  if (!response?.output) return "";
  const messages = response.output.filter((o) => o.type === "message");
  const last = messages[messages.length - 1];
  if (!last?.content) return "";
  return last.content
    .filter((c) => c.type === "output_text")
    .map((c) => c.text)
    .join("\n")
    .trim();
}

function extractCitations(response) {
  if (!response?.output) return [];
  const cites = [];
  for (const item of response.output) {
    if (item.type !== "message" || !item.content) continue;
    for (const c of item.content) {
      if (Array.isArray(c.annotations)) {
        for (const a of c.annotations) {
          if (a.type === "url_citation") {
            cites.push({ title: a.title || "", url: a.url, start: a.start_index, end: a.end_index });
          }
        }
      }
    }
  }
  return cites;
}

const router = Router();

router.post("/research/deep", async (req, res) => {
  try {
    const { query, model, system, tools } = req.body || {};
    const q = typeof query === "string" ? query.trim() : "";
    if (!q) return res.status(400).json({ error: "query required" });

    const useModel = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;
    const useTools =
      Array.isArray(tools) && tools.length > 0
        ? tools
        : [{ type: "web_search_preview" }];

    const input = [];
    if (typeof system === "string" && system.trim()) {
      input.push({ role: "developer", content: [{ type: "input_text", text: system.trim() }] });
    }
    input.push({ role: "user", content: [{ type: "input_text", text: q }] });

    const response = await openaiFetch("/responses", {
      method: "POST",
      body: JSON.stringify({
        model: useModel,
        input,
        background: true,
        reasoning: { summary: "auto" },
        tools: useTools,
      }),
    });

    res.json({
      id: response.id,
      status: response.status,
      model: response.model,
      created_at: response.created_at,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, details: e.details });
  }
});

router.get("/research/deep/:id", async (req, res) => {
  try {
    const r = await openaiFetch(`/responses/${encodeURIComponent(req.params.id)}`);
    const done = r.status === "completed";
    res.json({
      id: r.id,
      status: r.status,
      model: r.model,
      created_at: r.created_at,
      error: r.error || null,
      ...(done
        ? {
            text: extractFinalText(r),
            citations: extractCitations(r),
            usage: r.usage || null,
          }
        : {}),
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, details: e.details });
  }
});

router.post("/research/deep/:id/cancel", async (req, res) => {
  try {
    const r = await openaiFetch(`/responses/${encodeURIComponent(req.params.id)}/cancel`, {
      method: "POST",
    });
    res.json({ id: r.id, status: r.status });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, details: e.details });
  }
});

export default router;
