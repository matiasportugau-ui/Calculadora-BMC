/**
 * Conversation log and analysis endpoints for the Panelin AI agent.
 *
 * Protected by dev-mode auth — only accessible with API_AUTH_TOKEN.
 * Provides listing, detail, analysis, and summary for all logged conversations.
 */
import { Router } from "express";
import { config } from "../config.js";
import {
  listConversations,
  loadConversation,
  analyzeConversation,
  updateConversationMeta,
} from "../lib/chatLogger.js";

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

/** Clamp a pagination value between min and max with a default fallback. */
function clampPagination(value, defaultVal, min, max) {
  const num = Number(value) || defaultVal;
  return Math.min(Math.max(num, min), max);
}

/**
 * GET /api/agent/conversations — List conversations with optional filters.
 * Query params: limit, offset, since (ISO date), devMode (true/false), provider
 */
router.get("/agent/conversations", requireDevModeAuth, (req, res) => {
  try {
    const filters = {
      limit: clampPagination(req.query.limit, 50, 1, 200),
      offset: Math.max(Number(req.query.offset) || 0, 0),
      since: req.query.since || undefined,
      devMode: req.query.devMode === "true" ? true : req.query.devMode === "false" ? false : undefined,
      provider: req.query.provider || undefined,
    };
    const result = listConversations(filters);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

/**
 * GET /api/agent/conversations/:id — Full conversation with all turns.
 */
router.get("/agent/conversations/:id", requireDevModeAuth, (req, res) => {
  try {
    const conversation = loadConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ ok: false, error: "Conversation not found" });
    }
    res.json({ ok: true, conversation });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

/**
 * GET /api/agent/conversations/:id/analysis — Rule-based analysis of conversation.
 * Returns strengths, issues, and improvement suggestions.
 */
router.get("/agent/conversations/:id/analysis", requireDevModeAuth, (req, res) => {
  try {
    const conversation = loadConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ ok: false, error: "Conversation not found" });
    }
    const analysis = analyzeConversation(conversation);

    // Persist the analysis to the conversation file
    updateConversationMeta(req.params.id, { analysis });

    res.json({ ok: true, conversationId: req.params.id, analysis });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

/** Maximum number of top issues/suggestions returned in aggregate reports */
const MAX_TOP_ITEMS = 10;

/**
 * GET /api/agent/conversations/report/aggregate — Aggregate report across all conversations.
 * Returns overall stats, common issues, and improvement recommendations.
 */
router.get("/agent/conversations/report/aggregate", requireDevModeAuth, (req, res) => {
  try {
    const since = req.query.since || undefined;
    const { conversations } = listConversations({ limit: 500, since });

    if (conversations.length === 0) {
      return res.json({
        ok: true,
        report: {
          totalConversations: 0,
          message: "No hay conversaciones registradas en el período.",
        },
      });
    }

    // Load and analyze each conversation
    let totalTurns = 0;
    let totalActions = 0;
    let totalMismatches = 0;
    let totalRepetitions = 0;
    let totalKbMatches = 0;
    const allIssues = [];
    const allStrengths = [];
    const allSuggestions = [];
    const providerCounts = {};
    let devModeCount = 0;

    for (const summary of conversations) {
      const conv = loadConversation(summary.id);
      if (!conv) continue;

      const analysis = analyzeConversation(conv);
      totalTurns += analysis.turnCount || 0;
      totalActions += analysis.totalActions || 0;
      totalMismatches += analysis.mismatchCount || 0;
      totalRepetitions += analysis.repetitionCount || 0;
      totalKbMatches += analysis.kbMatchTurns || 0;
      if (conv.devMode) devModeCount++;
      providerCounts[conv.provider] = (providerCounts[conv.provider] || 0) + 1;

      for (const issue of analysis.issues) allIssues.push(issue);
      for (const s of analysis.strengths) allStrengths.push(s);
      for (const s of analysis.suggestions) allSuggestions.push(s);
    }

    // Count recurring issues
    const issueCounts = {};
    for (const issue of allIssues) {
      issueCounts[issue] = (issueCounts[issue] || 0) + 1;
    }
    const topIssues = Object.entries(issueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TOP_ITEMS)
      .map(([issue, count]) => ({ issue, count }));

    const suggestionCounts = {};
    for (const s of allSuggestions) {
      suggestionCounts[s] = (suggestionCounts[s] || 0) + 1;
    }
    const topSuggestions = Object.entries(suggestionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TOP_ITEMS)
      .map(([suggestion, count]) => ({ suggestion, count }));

    res.json({
      ok: true,
      report: {
        totalConversations: conversations.length,
        totalTurns,
        totalActions,
        totalMismatches,
        totalRepetitions,
        totalKbMatches,
        devModeConversations: devModeCount,
        providerDistribution: providerCounts,
        avgTurnsPerConversation: +(totalTurns / conversations.length).toFixed(1),
        topIssues,
        topSuggestions,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

export default router;
