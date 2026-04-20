import { Router } from "express";
import { config } from "../config.js";
import {
  loadConversations,
  loadConversationById,
  computeResume,
} from "../lib/conversationLog.js";
import { callAiCompletion } from "../lib/aiCompletion.js";

const router = Router();

// Simple in-memory analysis cache (10 min TTL)
const analysisCache = new Map();
const ANALYSIS_TTL_MS = 10 * 60 * 1000;

function requireDevModeAuth(req, res, next) {
  const token = config.apiAuthToken;
  if (!token) return res.status(503).json({ ok: false, error: "API_AUTH_TOKEN not configured" });
  const auth = String(req.headers.authorization || "");
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const xKey = String(req.headers["x-api-key"] || req.query?.key || "");
  if (bearer === token || xKey === token) return next();
  return res.status(401).json({ ok: false, error: "Unauthorized" });
}

/** GET /api/agent/conversations — paginated list of conversation resumes */
router.get("/agent/conversations", requireDevModeAuth, (req, res) => {
  const days = Math.max(1, Math.min(Number(req.query.days) || 30, 90));
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 100));

  const result = loadConversations({ days, page, limit });
  const resumes = result.items.map(computeResume);
  res.json({ ok: true, total: result.total, page: result.page, limit: result.limit, conversations: resumes });
});

/** GET /api/agent/conversations/:id — full conversation record */
router.get("/agent/conversations/:id", requireDevModeAuth, (req, res) => {
  const conv = loadConversationById(req.params.id);
  if (!conv) return res.status(404).json({ ok: false, error: "Conversation not found" });
  res.json({ ok: true, conversation: conv, resume: computeResume(conv) });
});

/** GET /api/agent/conversations/:id/analysis — AI-generated pros/cons (cached 10 min) */
router.get("/agent/conversations/:id/analysis", requireDevModeAuth, async (req, res) => {
  const id = req.params.id;

  const cached = analysisCache.get(id);
  if (cached && Date.now() - cached.ts < ANALYSIS_TTL_MS) {
    return res.json({ ok: true, cached: true, analysis: cached.analysis });
  }

  const conv = loadConversationById(id);
  if (!conv) return res.status(404).json({ ok: false, error: "Conversation not found" });

  const transcript = conv.turns
    .map((t) => `[${t.role.toUpperCase()}]: ${t.content}`)
    .join("\n");

  try {
    const { text } = await callAiCompletion({
      systemPrompt: `Sos un analista QA de chatbots de ventas. Analizá esta conversación y devolvé SOLO JSON válido con este esquema:
{"pros":["..."],"cons":["..."],"kbSuggestions":[{"question":"...","answer":"...","category":"sales|math|product|conversational"}],"hedgeTopics":["..."],"improvementSuggestions":["..."]}
- pros: qué hizo bien el bot
- cons: qué falló o podría mejorar
- kbSuggestions: pares pregunta/respuesta para agregar al KB de entrenamiento
- hedgeTopics: temas donde el bot mostró incertidumbre
- improvementSuggestions: cambios concretos al prompt o KB`,
      userMessage: `Conversación:\n${transcript.slice(0, 8000)}`,
      maxTokens: 800,
    });

    let analysis;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      analysis = { raw: text, parseError: true };
    }

    analysisCache.set(id, { ts: Date.now(), analysis });
    res.json({ ok: true, cached: false, analysis });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message || "AI analysis failed" });
  }
});

/** POST /api/agent/conversations/analyze-batch — analyze recent conversations → suggest KB entries */
router.post("/agent/conversations/analyze-batch", requireDevModeAuth, async (req, res) => {
  const days = Math.max(1, Math.min(Number(req.body?.days) || 7, 30));
  const minHedges = Number(req.body?.minHedges) ?? 2;
  const limit = Math.max(1, Math.min(Number(req.body?.limit) || 30, 100));

  const result = loadConversations({ days, page: 1, limit });
  const candidates = result.items.filter((c) => c.hedgeCount >= minHedges);

  if (candidates.length === 0) {
    return res.json({ ok: true, suggestions: [], analyzed: 0, message: "No conversations with hedges found" });
  }

  const pairs = [];
  for (const conv of candidates.slice(0, 10)) {
    const userTurns = conv.turns.filter((t) => t.role === "user");
    const assistantTurns = conv.turns.filter((t) => t.role === "assistant");
    for (let i = 0; i < Math.min(userTurns.length, assistantTurns.length); i++) {
      pairs.push(`Q: ${userTurns[i].content.slice(0, 300)}\nA: ${assistantTurns[i].content.slice(0, 300)}`);
    }
  }

  try {
    const { text } = await callAiCompletion({
      systemPrompt: `Analizás pares Q/A de un chatbot de ventas de paneles de aislamiento (BMC Uruguay). Identificá casos donde el bot dio respuestas incompletas o vagas. Para cada caso relevante, sugería una entrada para la base de conocimiento. Devolvé SOLO JSON: [{"question":"...","answer":"...","category":"sales|math|product|conversational"}]`,
      userMessage: pairs.slice(0, 20).join("\n\n---\n\n").slice(0, 8000),
      maxTokens: 1000,
    });

    let suggestions;
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      suggestions = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      if (!Array.isArray(suggestions)) suggestions = [];
    } catch {
      suggestions = [];
    }

    res.json({ ok: true, suggestions, analyzed: candidates.length });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message || "Batch analysis failed" });
  }
});

/** GET /api/agent/conversations/weekly-digest — usage stats + AI narrative */
router.get("/agent/conversations/weekly-digest", requireDevModeAuth, async (req, res) => {
  const result = loadConversations({ days: 7, page: 1, limit: 500 });
  const convs = result.items;

  if (convs.length === 0) {
    return res.json({ ok: true, stats: { totalConversations: 0 }, narrative: "No hay conversaciones en los últimos 7 días." });
  }

  const providerCounts = {};
  let totalTurns = 0;
  let totalHedges = 0;
  const actionCounts = {};

  for (const c of convs) {
    providerCounts[c.provider] = (providerCounts[c.provider] || 0) + 1;
    totalTurns += c.turnCount || 0;
    totalHedges += c.hedgeCount || 0;
    for (const a of c.actionsEmitted || []) {
      actionCounts[a] = (actionCounts[a] || 0) + 1;
    }
  }

  const stats = {
    totalConversations: convs.length,
    totalTurns,
    avgTurnsPerConv: +(totalTurns / convs.length).toFixed(1),
    hedgeRate: +((totalHedges / Math.max(totalTurns, 1)) * 100).toFixed(1),
    providerCounts,
    topActions: Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
  };

  try {
    const { text: narrative } = await callAiCompletion({
      systemPrompt: "Sos un analista de producto. Resumí estas estadísticas de uso de un chatbot en 5 puntos clave, en español, en formato bullets.",
      userMessage: JSON.stringify(stats),
      maxTokens: 400,
    });
    res.json({ ok: true, stats, narrative });
  } catch {
    res.json({ ok: true, stats, narrative: null });
  }
});

export default router;
