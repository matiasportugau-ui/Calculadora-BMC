/**
 * Provider readiness status + force probe (SDD Phase B).
 *
 * GET  /api/agent/providers/status
 * POST /api/agent/providers/probe  (admin)
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireServiceOrUser } from "../middleware/requireServiceOrUser.js";
import { getAggregateReadiness, _clearReadinessCache } from "../lib/providerReadiness.js";
import { resetProviderCooldowns } from "../lib/providerCircuitBreaker.js";

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const probeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "probe_rate_limited" },
});

export default function createProviderStatusRouter() {
  const router = Router();

  // GET status is public (same class as /api/agent/ai-options): payload has no secrets
  // (prefix only). Rate-limited. Cache-first only — never honor ?deep= here.
  // Unauthenticated force probes burn paid provider API calls (cost amplification).
  // Admins use POST /agent/providers/probe.
  const adminGuard = requireServiceOrUser({ role: "admin" });

  router.get("/agent/providers/status", readLimiter, async (req, res) => {
    try {
      const only = String(req.query.provider || "").trim().toLowerCase();
      const providers = only ? [only] : undefined;
      // Intentionally ignore ?deep= / force on the public GET.
      const agg = await getAggregateReadiness({ force: false, providers });
      res.json({
        ok: true,
        ready: agg.ready,
        light: agg.light,
        activeProvider: agg.activeProvider,
        generatedAt: agg.generatedAt,
        providers: agg.providers,
        available: agg.available,
        readyIds: agg.readyIds,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err?.message || err).slice(0, 200) });
    }
  });

  router.post("/agent/providers/probe", probeLimiter, adminGuard, async (req, res) => {
    try {
      const bodyProviders = Array.isArray(req.body?.providers) ? req.body.providers : undefined;
      // Force live re-probe
      _clearReadinessCache();
      const agg = await getAggregateReadiness({ force: true, providers: bodyProviders });
      res.json({
        ok: true,
        ready: agg.ready,
        light: agg.light,
        activeProvider: agg.activeProvider,
        generatedAt: agg.generatedAt,
        providers: agg.providers,
        available: agg.available,
        readyIds: agg.readyIds,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err?.message || err).slice(0, 200) });
    }
  });

  // Convenience: reset CB + clear readiness cache (admin)
  router.post("/agent/providers/reset", probeLimiter, adminGuard, (_req, res) => {
    try {
      resetProviderCooldowns();
      _clearReadinessCache();
      res.json({ ok: true, reset: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err?.message || err).slice(0, 200) });
    }
  });

  return router;
}
