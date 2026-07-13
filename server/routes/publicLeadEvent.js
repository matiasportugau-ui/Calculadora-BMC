// ═══════════════════════════════════════════════════════════════════════════
// server/routes/publicLeadEvent.js — anonymous quote-request event beacon.
// ───────────────────────────────────────────────────────────────────────────
//   POST /api/public/lead-event   fire-and-forget from the PUBLIC calculator
//                                 (no login — this is the ad-facing landing
//                                 flow). Writes to identity.user_activity_log
//                                 with actor_user_id=null via the same
//                                 logActivity() helper /api/me/activity uses.
//
// Exists because the highest-volume "solicitud de presupuesto" action (the
// WhatsApp-send button) was previously 100% client-side and invisible to the
// backend and to any ad platform. Restricted to PUBLIC_EMITTABLE so this
// endpoint can never be used to forge arbitrary activity-log actions.
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import rateLimit from "express-rate-limit";
import { getWaPool } from "../lib/waDb.js";
import { config } from "../config.js";
import { logActivity, ACTION_TAXONOMY, PUBLIC_EMITTABLE } from "../lib/userActivityLog.js";

const router = express.Router();

let _testPool = null;
function pool() {
  if (_testPool) return _testPool;
  const p = getWaPool(config.databaseUrl);
  if (!p) throw Object.assign(new Error("db_unavailable"), { status: 503 });
  return p;
}

/** Test-only — inject the same in-memory shim used by identityMe.js. */
export const __test__ = {
  setPool(p) { _testPool = p; },
  reset() { _testPool = null; },
};

// Generous per-IP cap — a real visitor fires this once or twice; this only
// bounds abuse, not legitimate ad-traffic spikes.
const publicLeadEventLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/api/public/lead-event", publicLeadEventLimiter, async (req, res) => {
  try {
    const { action, payload } = req.body || {};
    if (typeof action !== "string" || !action) {
      return res.status(400).json({ ok: false, error: "missing_action" });
    }
    if (!ACTION_TAXONOMY.has(action) || !PUBLIC_EMITTABLE.has(action)) {
      return res.status(403).json({ ok: false, error: "action_not_public_emittable", action });
    }
    await logActivity({
      pool: pool(),
      actorId: null,
      sessionId: null,
      action,
      module: "quote",
      resourceType: "public_lead",
      clientEmitted: true,
      payload: typeof payload === "object" && payload !== null ? payload : {},
      req,
    });
    res.status(202).json({ ok: true });
  } catch (e) {
    // Never let beacon failures surface as anything the caller should retry
    // hard on — this is fire-and-forget telemetry, not a business action.
    res.status(e.status || 500).json({ ok: false, error: e.status ? e.message : "internal_error" });
  }
});

export default router;
