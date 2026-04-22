import { Router } from "express";
import { config } from "../config.js";
import {
  addTrainingEntry,
  appendTrainingSessionEvent,
  bulkDeleteEntries,
  bulkPatchEntries,
  deleteTrainingEntry,
  findRelevantExamples,
  getTrainingPaths,
  getTrainingStats,
  listTrainingEntries,
  loadPromptSectionHistory,
  loadPromptSections,
  loadScoringConfig,
  revertPromptSection,
  saveScoringConfig,
  DEFAULT_SCORING_CONFIG,
  updatePromptSection,
  updateTrainingEntry,
} from "../lib/trainingKB.js";
import { clearKnowledgeCache } from "../lib/knowledgeLoader.js";
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

router.get("/agent/training-kb", requireDevModeAuth, (req, res) => {
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

export default router;
