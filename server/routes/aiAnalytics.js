import { Router } from "express";
import path from "node:path";
import { config } from "../config.js";
import { buildAiEnvironmentTrends, defaultKnowledgeEventsLogPath } from "../lib/aiEnvironmentTrends.js";

const router = Router();

function requireAnalyticsAuth(req, res, next) {
  const token = config.apiAuthToken;
  if (token) {
    const auth = String(req.headers.authorization || "");
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const xKey = String(req.headers["x-api-key"] || req.query?.key || "");
    if (bearer === token || xKey === token) return next();
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  if (config.appEnv === "development") return next();
  return res.status(503).json({
    ok: false,
    error: "API_AUTH_TOKEN required in production for /api/ai-analytics",
  });
}

/**
 * GET /api/ai-analytics/trends?days=90
 * Lee `AI_KNOWLEDGE_EVENTS_LOG` o por defecto `docs/team/knowledge/events-log.jsonl`.
 */
router.get("/ai-analytics/trends", requireAnalyticsAuth, (req, res) => {
  try {
    const days = Math.max(7, Math.min(Number(req.query.days) || 60, 365));
    const custom = String(req.query.path || "").trim();
    const configured = config.aiKnowledgeEventsLog || process.env.AI_KNOWLEDGE_EVENTS_LOG || "";
    const filePath = custom
      ? path.isAbsolute(custom)
        ? custom
        : path.resolve(process.cwd(), custom)
      : configured
        ? path.isAbsolute(configured)
          ? configured
          : path.resolve(process.cwd(), configured)
        : defaultKnowledgeEventsLogPath();

    const payload = buildAiEnvironmentTrends({ filePath, daysWindow: days });
    res.json({
      ok: payload.ok !== false,
      mode: "ai_environment_analytics",
      ...payload,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

export default router;
