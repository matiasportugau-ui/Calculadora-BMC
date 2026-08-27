/**
 * BMC Torre de Control — live fleet under /api/torre
 */
import { Router } from "express";
import { getTransportistaPool } from "../lib/transportistaDb.js";
import { loadTorreLive } from "../lib/torreLive.js";

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function requireCrmAuth(config) {
  return (req, res, next) => {
    const token = config.apiAuthToken;
    if (!token) {
      return res.status(503).json({
        ok: false,
        error: "API_AUTH_TOKEN not configured — torre API disabled",
      });
    }
    const auth = String(req.headers.authorization || "");
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const xKey = String(req.headers["x-api-key"] || req.query?.key || "");
    if (bearer === token || xKey === token) return next();
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  };
}

export default function createTorreRouter(config, logger) {
  const router = Router();
  const pool = getTransportistaPool(config.databaseUrl);
  const log = logger || console;
  const auth = requireCrmAuth(config);

  function requireDb(_req, res, next) {
    if (!pool) {
      return res.status(503).json({ ok: false, error: "DATABASE_URL not configured" });
    }
    return next();
  }

  router.get(
    "/torre/live",
    auth,
    requireDb,
    asyncHandler(async (_req, res) => {
      const out = await loadTorreLive(pool);
      if (!out.ok) {
        log.warn?.({ err: out.error }, "torre live failed");
        return res.status(503).json({ ok: false, error: out.error || "torre_unavailable" });
      }
      res.json(out);
    }),
  );

  router.get("/torre/health", (_req, res) => {
    res.json({ ok: true, module: "torre", db: Boolean(pool) });
  });

  return router;
}
