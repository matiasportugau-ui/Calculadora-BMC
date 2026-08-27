/**
 * BMC Torre de Control — live fleet under /api/torre
 */
import { Router } from "express";
import { getTransportistaPool } from "../lib/transportistaDb.js";
import { loadTorreLive } from "../lib/torreLive.js";
import { ensureTransportistaSchema } from "../lib/transportistaSchema.js";
import {
  registerChofer,
  loginChofer,
  assignTripToChofer,
  listChoferInbox,
} from "../lib/choferRoster.js";
import { applyTowerAction } from "../../src/utils/logistica/torreAgent.js";
import { sha256Hex } from "../lib/driverToken.js";

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

  router.get(
    "/torre/health",
    asyncHandler(async (_req, res) => {
      if (!pool) {
        return res.json({ ok: true, module: "torre", db: false });
      }
      try {
        await ensureTransportistaSchema(pool);
        res.json({ ok: true, module: "torre", db: true, schema: true });
      } catch (err) {
        res.status(503).json({
          ok: false,
          module: "torre",
          db: true,
          schema: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );

  router.post(
    "/torre/chofer",
    auth,
    requireDb,
    asyncHandler(async (req, res) => {
      const out = await registerChofer(pool, req.body || {});
      if (!out.ok) return res.status(400).json(out);
      res.json(out);
    }),
  );

  router.post(
    "/torre/chofer/login",
    requireDb,
    asyncHandler(async (req, res) => {
      const out = await loginChofer(pool, req.body || {});
      if (!out.ok) return res.status(401).json(out);
      res.json(out);
    }),
  );

  router.post(
    "/torre/assign",
    auth,
    requireDb,
    asyncHandler(async (req, res) => {
      const out = await assignTripToChofer(pool, {
        tripId: req.body?.trip_id,
        choferId: req.body?.chofer_id,
      });
      if (!out.ok) return res.status(400).json(out);
      res.json(out);
    }),
  );

  router.get(
    "/torre/inbox",
    requireDb,
    asyncHandler(async (req, res) => {
      const authH = String(req.headers.authorization || "");
      const bearer = authH.startsWith("Bearer ") ? authH.slice(7).trim() : "";
      if (!bearer) return res.status(401).json({ ok: false, error: "Unauthorized" });
      await ensureTransportistaSchema(pool);
      const { rows } = await pool.query(
        `select * from chofer_sessions
          where token_hash = $1 and revoked_at is null and expires_at > now()
          limit 1`,
        [sha256Hex(bearer)],
      );
      const sess = rows[0];
      if (!sess) return res.status(401).json({ ok: false, error: "Unauthorized" });
      const out = await listChoferInbox(pool, sess.chofer_id);
      res.json(out);
    }),
  );

  router.post(
    "/torre/propose",
    auth,
    asyncHandler(async (req, res) => {
      const out = applyTowerAction({}, req.body || {});
      res.json(out);
    }),
  );

  return router;
}
