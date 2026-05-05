// ═══════════════════════════════════════════════════════════════════════════
// /api/ml/search — Search MercadoLibre listings (competitors lookup)
// ───────────────────────────────────────────────────────────────────────────
// Wraps GET /sites/{site_id}/search of the MercadoLibre API behind:
//   • Bearer / x-api-key auth (same as other internal endpoints)
//   • In-memory TTL cache (30 min) keyed by site|q|limit|offset
//   • Rate limit (60 req/min per IP)
//   • Slim response shape geared to price-monitoring use cases
//
// Usage from a client:
//   GET /api/ml/search?q=isopanel&limit=20&offset=0
//   Headers: Authorization: Bearer ${API_AUTH_TOKEN}
//
// Why a router (factory) instead of a top-level app.get():
//   The existing /ml/* routes in server/index.js are legacy. New ML endpoints
//   under /api/ml/* live in dedicated routers so they are independently
//   testable and we keep server/index.js from growing further.
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/requireAuth.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CACHE_MAX_ENTRIES = 500;

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Map a raw MercadoLibre search hit to the slim shape we care about.
 * Keeping this small reduces payload size for the artifact / scheduled task.
 */
const slimResult = (r) => ({
  id: r?.id ?? null,
  title: r?.title ?? "",
  price: typeof r?.price === "number" ? r.price : null,
  currency_id: r?.currency_id ?? null,
  condition: r?.condition ?? null,
  listing_type_id: r?.listing_type_id ?? null,
  permalink: r?.permalink ?? null,
  thumbnail: r?.thumbnail ?? null,
  seller_id: r?.seller?.id ?? null,
  seller_nickname: r?.seller?.nickname ?? null,
  sold_quantity: r?.sold_quantity ?? null,
  available_quantity: r?.available_quantity ?? null,
  accepts_mercadopago: !!r?.accepts_mercadopago,
  shipping_free: !!r?.shipping?.free_shipping,
  installments: r?.installments
    ? {
        quantity: r.installments.quantity ?? null,
        amount: r.installments.amount ?? null,
        currency_id: r.installments.currency_id ?? null,
      }
    : null,
});

/**
 * Factory returning an Express Router that exposes GET /api/ml/search.
 *
 * @param {Object}   deps
 * @param {Object}   deps.ml      — MercadoLibre client (server/mercadoLibreClient.js)
 * @param {Object}   deps.config  — server/config.js singleton
 * @param {Object} [ deps.logger ] — pino-compatible logger
 */
export default function createMlSearchRouter({ ml, config, logger }) {
  const router = Router();
  const cache = new Map();

  const getCached = (key) => {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return null;
    }
    return entry.value;
  };

  const setCached = (key, value) => {
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    // Cheap LRU-ish trim: drop oldest insertion when over cap.
    if (cache.size > CACHE_MAX_ENTRIES) {
      const firstKey = cache.keys().next().value;
      if (firstKey != null) cache.delete(firstKey);
    }
  };

  const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: "Too many requests, please try again later." },
  });

  router.get(
    "/api/ml/search",
    searchLimiter,
    requireAuth,
    asyncHandler(async (req, res) => {
      const q = String(req.query.q || "").trim();
      if (!q) {
        return res
          .status(400)
          .json({ ok: false, error: "Missing required query parameter `q`." });
      }

      const siteId = String(req.query.site_id || config.mlSiteId || "MLU");
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT),
      );
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const noCache = String(req.query.nocache || "") === "1";

      const cacheKey = `${siteId}|${q.toLowerCase()}|${limit}|${offset}`;
      if (!noCache) {
        const cached = getCached(cacheKey);
        if (cached) {
          res.setHeader("X-Cache", "HIT");
          return res.json(cached);
        }
      }

      const t0 = Date.now();
      const payload = await ml.requestWithRetries({
        method: "GET",
        path: `/sites/${siteId}/search`,
        query: { q, limit, offset },
      });

      const results = Array.isArray(payload?.results)
        ? payload.results.map(slimResult)
        : [];

      const response = {
        ok: true,
        site_id: siteId,
        query: q,
        paging: payload?.paging ?? null,
        results,
        cached_at: new Date().toISOString(),
      };

      setCached(cacheKey, response);

      logger?.info?.(
        {
          msg: "ml-search",
          q,
          site: siteId,
          limit,
          offset,
          total: payload?.paging?.total ?? null,
          returned: results.length,
          ms: Date.now() - t0,
        },
        "ml-search ok",
      );

      res.setHeader("X-Cache", "MISS");
      res.json(response);
    }),
  );

  return router;
}
