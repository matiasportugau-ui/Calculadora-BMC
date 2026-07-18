// POST /api/ml/optimize/listing — Listing Quality Agent (MLOMS P0).
// Read-only on ML: fetches item + description, returns audit JSON. No auto-apply.

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../config.js";
import { requireServiceOrUser } from "../middleware/requireServiceOrUser.js";
import requireAssistantEnabled from "../middleware/requireAssistantEnabled.js";
import { auditListingQuality } from "../lib/mlListingQuality.js";
import { buildMlPlaybooks } from "../lib/mlPlaybooks.js";

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const aiGenLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "rate_limited", detail: "Demasiadas auditorías IA. Esperá un momento." },
});

/**
 * @param {{ ml: object, logger?: object }} deps
 */
export default function createMlOptimizeRouter({ ml, config: cfg, logger }) {
  const apiConfig = cfg || config;
  const router = Router();

  router.post(
    "/api/ml/optimize/listing",
    aiGenLimiter,
    requireServiceOrUser({ authOnly: true }),
    requireAssistantEnabled("ml"),
    asyncHandler(async (req, res) => {
      const { itemId, provider } = req.body || {};
      const id = String(itemId || "").trim();
      if (!id) {
        return res.status(400).json({ ok: false, error: "Missing itemId" });
      }

      const apiKeys = {
        claude: apiConfig.anthropicApiKey,
        openai: apiConfig.openaiApiKey,
        grok: apiConfig.grokApiKey,
        gemini: apiConfig.geminiApiKey,
      };
      const hasAnyKey = Object.values(apiKeys).some((k) => String(k || "").trim().length > 0);
      if (!hasAnyKey) {
        return res.status(503).json({
          ok: false,
          code: "IA_NOT_CONFIGURED",
          error: "Ninguna clave IA configurada.",
        });
      }

      let item;
      try {
        item = await ml.requestWithRetries({ method: "GET", path: `/items/${id}` });
      } catch (err) {
        const status = err.status || 502;
        return res.status(status).json({
          ok: false,
          error: "Failed to load listing from MercadoLibre",
          detail: err.message || String(err),
        });
      }

      let descriptionText = "";
      try {
        const desc = await ml.requestWithRetries({
          method: "GET",
          path: `/items/${id}/description`,
        });
        descriptionText = desc?.plain_text || desc?.text || "";
      } catch {
        /* item may have no description yet */
      }

      try {
        const result = await auditListingQuality({
          item,
          descriptionText,
          provider: provider || undefined,
        });
        return res.json({ ok: true, ...result });
      } catch (err) {
        logger?.warn?.({ err: err.message, itemId: id }, "ml optimize listing failed");
        return res.status(503).json({
          ok: false,
          error: "Listing quality audit failed",
          detail: err.message || String(err),
        });
      }
    }),
  );

  router.get(
    "/api/ml/playbooks",
    requireServiceOrUser({ authOnly: true }),
    asyncHandler(async (_req, res) => {
      try {
        const payload = buildMlPlaybooks();
        return res.json({ ok: true, ...payload });
      } catch (err) {
        logger?.warn?.({ err: err.message }, "ml playbooks load failed");
        return res.status(503).json({
          ok: false,
          error: "Failed to load ML playbooks",
          detail: err.message || String(err),
        });
      }
    }),
  );

  return router;
}
