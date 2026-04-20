import { Router } from "express";
import { config } from "../config.js";
import {
  addTrainingEntry,
  appendTrainingSessionEvent,
  deleteTrainingEntry,
  findRelevantExamples,
  getTrainingPaths,
  getTrainingStats,
  listTrainingEntries,
  loadPromptSections,
  updatePromptSection,
  updateTrainingEntry,
} from "../lib/trainingKB.js";
import { buildSystemPrompt } from "../lib/chatPrompts.js";

const router = Router();

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

/**
 * POST /api/agent/training-kb/bulk — Import multiple training entries at once.
 * Body: { entries: [{ category, question, goodAnswer, ... }] }
 */
router.post("/agent/training-kb/bulk", requireDevModeAuth, (req, res) => {
  try {
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    if (entries.length === 0) {
      return res.status(400).json({ ok: false, error: "entries array required" });
    }
    if (entries.length > 100) {
      return res.status(400).json({ ok: false, error: "Max 100 entries per bulk import" });
    }
    const results = [];
    const errors = [];
    for (const [i, entry] of entries.entries()) {
      try {
        const created = addTrainingEntry(entry);
        results.push({ index: i, id: created.id, ok: true });
      } catch (err) {
        errors.push({ index: i, error: err.message || String(err) });
      }
    }
    appendTrainingSessionEvent({ type: "bulk_import", count: results.length, errors: errors.length });
    res.json({ ok: true, imported: results.length, errors, results });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

/**
 * GET /api/agent/training-kb/export — Export all training entries as JSON.
 */
router.get("/agent/training-kb/export", requireDevModeAuth, (req, res) => {
  const entries = listTrainingEntries();
  const stats = getTrainingStats();
  res.json({
    ok: true,
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    stats,
    entries,
  });
});

export default router;
