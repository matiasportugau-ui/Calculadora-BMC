import { Router } from "express";
import { requireServiceOrUser } from "../middleware/requireServiceOrUser.js";
import { normalizeMlAnswerCurrencyText as defaultNormalizeMlAnswerCurrencyText } from "../lib/mlAnswerText.js";

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export function createMlLegacyRouter({
  ml,
  config,
  normalizeMlAnswerCurrencyText = defaultNormalizeMlAnswerCurrencyText,
}) {
  const router = Router();

  // All legacy /ml/* routes require an authenticated caller: an active identity
  // JWT (operators: mlFetch attaches it) OR the static service token.
  const requireMlAuth = requireServiceOrUser({ authOnly: true });

  router.get(
    "/users/me",
    requireMlAuth,
    asyncHandler(async (_req, res) => {
      const payload = await ml.requestWithRetries({
        method: "GET",
        path: "/users/me",
      });
      res.json(payload);
    }),
  );

  router.get(
    "/users/:id",
    requireMlAuth,
    asyncHandler(async (req, res) => {
      const payload = await ml.requestWithRetries({
        method: "GET",
        path: `/users/${req.params.id}`,
      });
      res.json(payload);
    }),
  );

  router.get(
    "/listings",
    requireMlAuth,
    asyncHandler(async (req, res) => {
      const { status = "active", limit = 50, offset = 0 } = req.query;
      const sellerId = await ml.resolveSellerId();
      const payload = await ml.requestWithRetries({
        method: "GET",
        path: `/users/${sellerId}/items/search?status=${status}&limit=${limit}&offset=${offset}`,
      });
      res.json(payload);
    }),
  );

  router.get(
    "/items/:id",
    requireMlAuth,
    asyncHandler(async (req, res) => {
      const payload = await ml.requestWithRetries({
        method: "GET",
        path: `/items/${req.params.id}`,
      });
      res.json(payload);
    }),
  );

  router.patch(
    "/items/:id",
    requireMlAuth,
    asyncHandler(async (req, res) => {
      const payload = await ml.requestWithRetries({
        method: "PUT",
        path: `/items/${req.params.id}`,
        body: req.body,
      });
      res.json(payload);
    }),
  );

  router.post(
    "/items/:id/description",
    requireMlAuth,
    asyncHandler(async (req, res) => {
      const { text } = req.body;
      try {
        const payload = await ml.requestWithRetries({
          method: "POST",
          path: `/items/${req.params.id}/description`,
          body: { plain_text: text },
        });
        res.json(payload);
      } catch (e) {
        if (e.payload?.message?.includes("already has a description")) {
          const payload = await ml.requestWithRetries({
            method: "PUT",
            path: `/items/${req.params.id}/description`,
            body: { plain_text: text },
          });
          res.json(payload);
        } else {
          throw e;
        }
      }
    }),
  );

  router.get(
    "/questions",
    requireMlAuth,
    asyncHandler(async (req, res) => {
      if (req.query.id) {
        const payload = await ml.requestWithRetries({
          method: "GET",
          path: `/questions/${req.query.id}`,
        });
        return res.json(payload);
      }
      // Only pass parameters accepted by ML /questions/search to avoid invalid_query_string.
      const allowedKeys = new Set([
        "seller_id",
        "item",
        "item_id",
        "api_version",
        "site_id",
        "offset",
        "limit",
        "status",
      ]);
      const query = {};
      for (const [k, v] of Object.entries(req.query)) {
        if (allowedKeys.has(k) && v != null && String(v) !== "") {
          query[k] = v;
        }
      }
      if (!query.seller_id) {
        const sellerId = await ml.resolveSellerId();
        if (sellerId) query.seller_id = sellerId;
      }
      if (!query.seller_id) {
        return res.status(400).json({
          ok: false,
          error:
            "Missing seller_id: complete OAuth (/auth/ml/start) or pass ?seller_id=… so /questions/search is valid.",
        });
      }
      if (query.api_version == null || query.api_version === "") {
        query.api_version = "4";
      }
      if (query.site_id == null || query.site_id === "") {
        query.site_id = config.mlSiteId;
      }
      const payload = await ml.requestWithRetries({
        method: "GET",
        path: "/questions/search",
        query,
      });
      res.json(payload);
    }),
  );

  router.get(
    "/questions/:id",
    requireMlAuth,
    asyncHandler(async (req, res) => {
      const payload = await ml.requestWithRetries({
        method: "GET",
        path: `/questions/${req.params.id}`,
      });
      res.json(payload);
    }),
  );

  router.post(
    "/questions/:id/answer",
    requireMlAuth,
    asyncHandler(async (req, res) => {
      if (!req.body?.text) {
        return res.status(400).json({ ok: false, error: "Missing body.text" });
      }
      const text = normalizeMlAnswerCurrencyText(req.body.text);
      const payload = await ml.requestWithRetries({
        method: "POST",
        path: "/answers",
        body: {
          question_id: Number(req.params.id),
          text,
        },
      });
      res.json(payload);
    }),
  );

  router.get(
    "/orders",
    requireMlAuth,
    asyncHandler(async (req, res) => {
      if (req.query.id) {
        const payload = await ml.requestWithRetries({
          method: "GET",
          path: `/orders/${req.query.id}`,
        });
        return res.json(payload);
      }
      const allowedKeys = new Set([
        "seller",
        "seller.id",
        "offset",
        "limit",
        "order.status",
        "sort",
        "tags",
      ]);
      const query = {};
      for (const [k, v] of Object.entries(req.query)) {
        if (allowedKeys.has(k) && v != null && String(v) !== "") {
          query[k] = v;
        }
      }
      const sellerId = await ml.resolveSellerId();
      // ML documents /orders/search?seller=ID; some callers use seller.id, so align with the token seller.
      if (!query.seller && !query["seller.id"] && sellerId) {
        query.seller = sellerId;
      }
      const payload = await ml.requestWithRetries({
        method: "GET",
        path: "/orders/search",
        query,
      });
      res.json(payload);
    }),
  );

  router.get(
    "/orders/:id",
    requireMlAuth,
    asyncHandler(async (req, res) => {
      const payload = await ml.requestWithRetries({
        method: "GET",
        path: `/orders/${req.params.id}`,
      });
      res.json(payload);
    }),
  );

  return router;
}

export default createMlLegacyRouter;
