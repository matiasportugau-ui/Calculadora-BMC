/**
 * ActivityWatch (passive OS observation) — opt-in proxy, OFF by default.
 *
 * Surfaces a local `aw-server` to the agent/UI so it can answer
 * "¿en qué trabajé hoy?" and propose TraKtiMe entries. Gated by
 * `config.traktimeAwEnabled`: when disabled every route returns 404
 * (`aw_disabled`) so nothing leaks and Cloud Run stays inert.
 *
 * Auth: requireUser() — only logged-in operators may query. The data is
 * machine-scoped (whatever runs on the co-located aw-server), not per-user.
 *
 * Error semantics: 404 aw_disabled (flag off) · 503 aw_unreachable (daemon
 * down) · never 500 for the daemon being absent.
 */
import { Router } from "express";
import { requireUser } from "../lib/identityAuth.js";
import { awEnabled, getTodaySummary, getBuckets } from "../lib/activityWatchClient.js";

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export default function createActivityRouter(config, logger) {
  const router = Router();
  const log = logger || console;

  function requireEnabled(_req, res, next) {
    if (!awEnabled()) {
      return res.status(404).json({ ok: false, error: "aw_disabled" });
    }
    return next();
  }

  // Status is readable regardless of the flag (so the UI can show enable hints).
  router.get(
    "/api/activity/status",
    requireUser(),
    asyncHandler(async (_req, res) => {
      res.json({ ok: true, enabled: awEnabled(), base_url: awEnabled() ? config.traktimeAwBaseUrl : null });
    }),
  );

  router.get(
    "/api/activity/today",
    requireUser(),
    requireEnabled,
    asyncHandler(async (req, res) => {
      try {
        const tz = req.query.tz ? String(req.query.tz) : undefined;
        const summary = await getTodaySummary({ tz });
        res.json({ ok: true, ...summary });
      } catch (e) {
        log.warn?.({ err: e }, "[activity] aw today failed");
        res.status(503).json({ ok: false, error: "aw_unreachable" });
      }
    }),
  );

  // Bucket listing — handy for debugging which watchers are running.
  router.get(
    "/api/activity/buckets",
    requireUser(),
    requireEnabled,
    asyncHandler(async (_req, res) => {
      try {
        const buckets = await getBuckets();
        res.json({ ok: true, buckets: Object.keys(buckets || {}) });
      } catch (e) {
        log.warn?.({ err: e }, "[activity] aw buckets failed");
        res.status(503).json({ ok: false, error: "aw_unreachable" });
      }
    }),
  );

  return router;
}
