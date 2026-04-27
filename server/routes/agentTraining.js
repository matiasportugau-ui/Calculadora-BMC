import { Router } from "express";
import { config } from "../config.js";
import {
  addTrainingEntry,
  appendTrainingSessionEvent,
  approveTrainingEntry,
  bulkDeleteEntries,
  bulkPatchEntries,
  deleteTrainingEntry,
  detectConflicts,
  findAllConflicts,
  findRelevantExamples,
  getHealthEntries,
  getTrainingPaths,
  getTrainingStats,
  hasSimilarQuestion,
  listPendingEntries,
  listTrainingEntries,
  loadPromptSectionHistory,
  loadPromptSections,
  loadScoringConfig,
  rejectTrainingEntry,
  revertPromptSection,
  saveScoringConfig,
  DEFAULT_SCORING_CONFIG,
  updatePromptSection,
  updateTrainingEntry,
  ensureGcsInit,
} from "../lib/trainingKB.js";
import { clearKnowledgeCache } from "../lib/knowledgeLoader.js";
import { extractLearnablePairs } from "../lib/autoLearnExtractor.js";
import { loadConversationById } from "../lib/conversationLog.js";
import { buildSystemPrompt } from "../lib/chatPrompts.js";

const router = Router();

const VALID_PROMPT_SECTIONS = new Set(["IDENTITY", "CATALOG", "WORKFLOW", "ACTIONS_DOC"]);

function validateSectionParam(req, res) {
  const section = String(req.params.section || "").toUpperCase();
  if (!VALID_PROMPT_SECTIONS.has(section)) {
    res.status(400).json({ ok: false, error: `Invalid section. Allowed: ${[...VALID_PROMPT_SECTIONS].join(", ")}` });
    return null;
  }
  return section;
}

function requireDevModeAuth(req, res, next) {
  const token = config.apiAuthToken;
  if (!token) {
    return res.status(503).json({
      ok: false,
      error: "API_AUTH_TOKEN not configured — developer mode disabled",
    });
  }
  const auth = String(req.headers.authorization || "");
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const xKey = String(req.headers["x-api-key"] || req.query?.key || "");
  if (bearer === token || xKey === token) return next();
  return res.status(401).json({ ok: false, error: "Unauthorized" });
}

router.post("/agent/train", requireDevModeAuth, (req, res) => {
  try {
    const entry = addTrainingEntry(req.body || {});
    appendTrainingSessionEvent({ type: "train_entry_created", entryId: entry.id, category: entry.category });
    res.json({ ok: true, entry });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

router.put("/agent/train/:id", requireDevModeAuth, (req, res) => {
  try {
    const entry = updateTrainingEntry(req.params.id, req.body || {});
    appendTrainingSessionEvent({ type: "train_entry_updated", entryId: entry.id, category: entry.category });
    res.json({ ok: true, entry });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// Bulk routes MUST come before /:id to prevent Express matching "bulk" as an id param
router.delete("/agent/train/bulk", requireDevModeAuth, (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ ok: false, error: "ids array required" });
    const result = bulkDeleteEntries(ids);
    appendTrainingSessionEvent({ type: "train_bulk_deleted", count: ids.length });
    res.json(result);
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

router.patch("/agent/train/bulk", requireDevModeAuth, (req, res) => {
  try {
    const { ids, patch } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ ok: false, error: "ids array required" });
    const result = bulkPatchEntries(ids, patch || {});
    appendTrainingSessionEvent({ type: "train_bulk_patched", count: ids.length });
    res.json(result);
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

router.delete("/agent/train/:id", requireDevModeAuth, (req, res) => {
  try {
    deleteTrainingEntry(req.params.id);
    appendTrainingSessionEvent({ type: "train_entry_deleted", entryId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

router.get("/agent/training-kb", requireDevModeAuth, async (req, res) => {
  await ensureGcsInit(); // wait for GCS cold-start load before reading KB
  const entries = listTrainingEntries({ category: req.query.category });
  const stats = getTrainingStats();
  res.json({ ok: true, entries, stats, paths: getTrainingPaths() });
});

router.get("/agent/training-kb/match", requireDevModeAuth, (req, res) => {
  const q = String(req.query.q || "").trim();
  const limit = Number(req.query.limit) || 5;
  const matches = findRelevantExamples(q, { limit: Math.max(1, Math.min(limit, 20)) });
  res.json({ ok: true, q, matches });
});

router.get("/agent/dev-config", requireDevModeAuth, (req, res) => {
  const sections = loadPromptSections();
  res.json({ ok: true, sections });
});

router.post("/agent/dev-config", requireDevModeAuth, (req, res) => {
  try {
    const { section, content } = req.body || {};
    const result = updatePromptSection(section, content);
    appendTrainingSessionEvent({ type: "prompt_section_updated", section: result.section });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

router.post("/agent/prompt-preview", requireDevModeAuth, (req, res) => {
  const { calcState = {}, query = "" } = req.body || {};
  const matches = findRelevantExamples(String(query), { limit: 5 });
  const prompt = buildSystemPrompt(calcState, { trainingExamples: matches, devMode: true });
  res.json({ ok: true, prompt, matched: matches.length, matches });
});

router.post("/agent/training/log-event", requireDevModeAuth, (req, res) => {
  const filePath = appendTrainingSessionEvent(req.body || {});
  res.json({ ok: true, filePath });
});

router.get("/agent/dev-config/:section/history", requireDevModeAuth, (req, res) => {
  const section = validateSectionParam(req, res);
  if (!section) return;
  const history = loadPromptSectionHistory(section);
  res.json({ ok: true, section, versions: history });
});

router.post("/agent/dev-config/:section/revert", requireDevModeAuth, (req, res) => {
  try {
    const section = validateSectionParam(req, res);
    if (!section) return;
    const { versionIndex } = req.body || {};
    const result = revertPromptSection(section, Number(versionIndex));
    appendTrainingSessionEvent({ type: "prompt_section_reverted", section, versionIndex });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

router.post("/agent/knowledge/clear-cache", requireDevModeAuth, (req, res) => {
  clearKnowledgeCache();
  res.json({ ok: true, message: "Knowledge docs cache cleared" });
});

router.get("/agent/training-kb/score-config", requireDevModeAuth, (req, res) => {
  const config = loadScoringConfig();
  res.json({ ok: true, config, defaults: DEFAULT_SCORING_CONFIG });
});

function parseScoreConfigNumber(value, defaultValue, fieldName) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${fieldName} must be a finite number`);
  if (parsed < 0) throw new Error(`${fieldName} must be non-negative`);
  return parsed;
}

router.post("/agent/training-kb/score-config", requireDevModeAuth, (req, res) => {
  try {
    const { permanentBonus, questionMatchWeight, contextMatchWeight, answerMatchWeight } = req.body || {};
    const cfg = {
      permanentBonus: parseScoreConfigNumber(permanentBonus, DEFAULT_SCORING_CONFIG.permanentBonus, "permanentBonus"),
      questionMatchWeight: parseScoreConfigNumber(questionMatchWeight, DEFAULT_SCORING_CONFIG.questionMatchWeight, "questionMatchWeight"),
      contextMatchWeight: parseScoreConfigNumber(contextMatchWeight, DEFAULT_SCORING_CONFIG.contextMatchWeight, "contextMatchWeight"),
      answerMatchWeight: parseScoreConfigNumber(answerMatchWeight, DEFAULT_SCORING_CONFIG.answerMatchWeight, "answerMatchWeight"),
    };
    saveScoringConfig(cfg);
    res.json({ ok: true, config: cfg });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// ─── Auto-learn queue ────────────────────────────────────────────────────────

router.post("/agent/autolearn", requireDevModeAuth, async (req, res) => {
  try {
    const { conversationId, turns: rawTurns } = req.body || {};
    let turns = rawTurns;
    if (!turns && conversationId) {
      const conv = loadConversationById(String(conversationId));
      if (!conv) return res.status(404).json({ ok: false, error: "Conversation not found" });
      turns = conv.turns;
    }
    if (!Array.isArray(turns) || turns.length < 2) {
      return res.status(400).json({ ok: false, error: "turns array required (min 2)" });
    }
    const pairs = await extractLearnablePairs(turns);
    const added = pairs.map((p) =>
      addTrainingEntry({
        question: p.question,
        goodAnswer: p.goodAnswer,
        badAnswer: p.badAnswer || "",
        category: p.category || "conversational",
        context: p.rationale || "",
        source: "autolearned",
        status: p.confidence >= 0.92 ? "active" : "pending",
        confidence: p.confidence,
        convId: conversationId || null,
      })
    );
    const autoApproved = added.filter((e) => e.status === "active").length;
    const pending = added.filter((e) => e.status === "pending").length;
    res.json({ ok: true, extracted: pairs.length, autoApproved, pending, entries: added });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.get("/agent/autolearn/pending", requireDevModeAuth, (req, res) => {
  try {
    res.json({ ok: true, entries: listPendingEntries() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post("/agent/autolearn/:id/approve", requireDevModeAuth, (req, res) => {
  try {
    const entry = approveTrainingEntry(req.params.id);
    clearKnowledgeCache();
    res.json({ ok: true, entry });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

router.post("/agent/autolearn/:id/reject", requireDevModeAuth, (req, res) => {
  try {
    const entry = rejectTrainingEntry(req.params.id, req.body?.reason || "");
    res.json({ ok: true, entry });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// ─── Health panel ─────────────────────────────────────────────────────────────

router.get("/agent/training-kb/health", requireDevModeAuth, (req, res) => {
  try {
    const { stale, zeroRetrieval, mlGap } = getHealthEntries();
    res.json({ ok: true, stale, zeroRetrieval, mlGap });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

// Mark reviewed — resets reviewDueAt for next cycle
router.post("/agent/training-kb/:id/mark-reviewed", requireDevModeAuth, (req, res) => {
  try {
    const FRESHNESS_DAYS = { sales: 30, product: 90, conversational: 180, math: null };
    const all = listTrainingEntries();
    const entry = all.find((e) => e.id === req.params.id);
    if (!entry) return res.status(404).json({ ok: false, error: "Entry not found" });
    const days = FRESHNESS_DAYS[entry.category] ?? null;
    const newDue = days ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
    const updated = updateTrainingEntry(req.params.id, { reviewDueAt: newDue });
    res.json({ ok: true, entry: updated });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// ─── Import with dedup ────────────────────────────────────────────────────────

router.post("/agent/training-kb/import", requireDevModeAuth, (req, res) => {
  try {
    const { entries } = req.body || {};
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ ok: false, error: "entries array required" });
    }
    const MAX_IMPORT = 100;
    const batch = entries.slice(0, MAX_IMPORT);
    let imported = 0, skipped = 0;
    const skippedItems = [];
    const importedItems = [];

    for (const item of batch) {
      const question = String(item.question || "").trim();
      const goodAnswer = String(item.goodAnswer || item.answer || "").trim();
      if (!question || !goodAnswer) { skipped++; skippedItems.push({ question, reason: "missing fields" }); continue; }
      if (hasSimilarQuestion(question, { threshold: 3 })) {
        skipped++;
        skippedItems.push({ question: question.slice(0, 60), reason: "similar entry exists" });
        continue;
      }
      const entry = addTrainingEntry({
        question,
        goodAnswer,
        badAnswer: item.badAnswer || "",
        category: item.category || "conversational",
        context: item.context || "",
        permanent: !!item.permanent,
        source: item.source || "import",
        goodAnswerML: item.goodAnswerML || null,
        goodAnswerWA: item.goodAnswerWA || null,
      });
      imported++;
      importedItems.push({ id: entry.id, question: question.slice(0, 60) });
    }

    res.json({ ok: true, imported, skipped, total: batch.length, importedItems, skippedItems });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

// ─── Conflict detection ───────────────────────────────────────────────────────

router.get("/agent/training-kb/conflicts", requireDevModeAuth, (req, res) => {
  try {
    const pairs = findAllConflicts();
    res.json({ ok: true, count: pairs.length, pairs });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.post("/agent/training-kb/:id/resolve-conflict", requireDevModeAuth, (req, res) => {
  try {
    const { keepId, archiveId } = req.body || {};
    if (!keepId || !archiveId) return res.status(400).json({ ok: false, error: "keepId and archiveId required" });
    // Archive the losing entry and clear conflictWith on winner
    const archived = updateTrainingEntry(archiveId, { status: "rejected" });
    const winner = updateTrainingEntry(keepId, { conflictWith: [] });
    res.json({ ok: true, kept: winner, archived });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

// ─── ML override batch generator ──────────────────────────────────────────────

router.post("/agent/training-kb/generate-ml-overrides", requireDevModeAuth, async (req, res) => {
  const apiKey = config.anthropicApiKey;
  if (!apiKey) return res.status(503).json({ ok: false, error: "ANTHROPIC_API_KEY not set" });

  const { ids } = req.body || {}; // optional: specific entry IDs; omit = all gaps
  const all = listTrainingEntries();
  const targets = ids
    ? all.filter((e) => ids.includes(e.id))
    : all.filter((e) => (e.goodAnswer || "").length > 350 && !e.goodAnswerML && e.status !== "rejected");

  if (targets.length === 0) return res.json({ ok: true, processed: 0, message: "No ML gaps found" });

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const results = [];
  for (const entry of targets) {
    try {
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: `Resumí esta respuesta en máximo 320 caracteres para MercadoLibre. Sin markdown, sin URLs. Mantené los datos clave (precios, plazos, datos técnicos). Directo y profesional. Solo devolvé el texto, sin comillas ni explicaciones.\n\nRespuesta original:\n${entry.goodAnswer}`,
        }],
      });
      const mlText = (msg.content?.[0]?.text || "").trim().slice(0, 350);
      if (mlText) {
        updateTrainingEntry(entry.id, { goodAnswerML: mlText });
        results.push({ id: entry.id, ok: true, chars: mlText.length });
      } else {
        results.push({ id: entry.id, ok: false, error: "empty response" });
      }
    } catch (err) {
      results.push({ id: entry.id, ok: false, error: err.message });
    }
  }

  const done = results.filter((r) => r.ok).length;
  res.json({ ok: true, processed: targets.length, generated: done, failed: results.filter((r) => !r.ok).length, results });
});

export default router;
