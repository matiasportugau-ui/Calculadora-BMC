// ═══════════════════════════════════════════════════════════════════════════
// server/routes/identityAnalytics.js — admin analytics over user_activity_log.
// ───────────────────────────────────────────────────────────────────────────
// Powers /hub/admin/analytics. All routes gated requireUser({role:"admin"}).
// Read-only; never writes. Designed for low-frequency dashboard polling
// (no expensive queries — every endpoint covered by an existing index).
//
//   GET /api/admin/analytics/active-users?window=day|week|month
//   GET /api/admin/analytics/module-usage?from=&to=
//   GET /api/admin/analytics/error-rate?from=&to=
//   GET /api/admin/analytics/timeline?from=&to=&interval=hour|day
//   GET /api/admin/analytics/top-actions?from=&to=&limit=
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import rateLimit from "express-rate-limit";
import { getWaPool } from "../lib/waDb.js";
import { config } from "../config.js";
import { requireUser } from "../lib/identityAuth.js";
import { safeErr as _safeErr } from "../lib/safeErr.js";

const router = express.Router();

function pool() {
  const p = getWaPool(config.databaseUrl);
  if (!p) throw Object.assign(new Error("db_unavailable"), { status: 503 });
  return p;
}

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const ADMIN_ANALYTICS = requireUser({ role: "admin" });

function parseWindow(w) {
  if (w === "day") return "1 day";
  if (w === "week") return "7 days";
  if (w === "month") return "30 days";
  return "1 day";
}

function parseRange(req) {
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  const from = req.query.from
    ? new Date(String(req.query.from))
    : new Date(to.getTime() - 30 * 86_400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

// ─── GET /api/admin/analytics/active-users ─────────────────────────────
// Distinct actor_user_id in the chosen window.
router.get("/api/admin/analytics/active-users", readLimiter, ADMIN_ANALYTICS, async (req, res) => {
  try {
    const window = parseWindow(String(req.query.window || "day"));
    const { rows } = await pool().query(
      `SELECT COUNT(DISTINCT actor_user_id)::int AS active
         FROM identity.user_activity_log
        WHERE at >= now() - ($1)::interval
          AND actor_user_id IS NOT NULL`,
      [window],
    );
    res.json({ ok: true, window, active: rows[0]?.active || 0 });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// ─── GET /api/admin/analytics/module-usage ─────────────────────────────
router.get("/api/admin/analytics/module-usage", readLimiter, ADMIN_ANALYTICS, async (req, res) => {
  try {
    const { from, to } = parseRange(req);
    const { rows } = await pool().query(
      `SELECT module, COUNT(*)::int AS event_count,
              COUNT(DISTINCT actor_user_id)::int AS distinct_users
         FROM identity.user_activity_log
        WHERE at >= $1::timestamptz AND at <= $2::timestamptz
          AND module IS NOT NULL
        GROUP BY module
        ORDER BY event_count DESC`,
      [from, to],
    );
    res.json({ ok: true, from, to, items: rows });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// ─── GET /api/admin/analytics/error-rate ───────────────────────────────
router.get("/api/admin/analytics/error-rate", readLimiter, ADMIN_ANALYTICS, async (req, res) => {
  try {
    const { from, to } = parseRange(req);
    const { rows } = await pool().query(
      `SELECT
         COUNT(*) FILTER (WHERE outcome = 'failure')::int AS failures,
         COUNT(*) FILTER (WHERE outcome = 'success')::int AS successes,
         COUNT(*)::int AS total
       FROM identity.user_activity_log
       WHERE at >= $1::timestamptz AND at <= $2::timestamptz`,
      [from, to],
    );
    const { failures, successes, total } = rows[0] || {};
    const rate = total > 0 ? failures / total : 0;
    res.json({ ok: true, from, to, failures, successes, total, rate });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// ─── GET /api/admin/analytics/timeline ─────────────────────────────────
router.get("/api/admin/analytics/timeline", readLimiter, ADMIN_ANALYTICS, async (req, res) => {
  try {
    const { from, to } = parseRange(req);
    const interval = req.query.interval === "hour" ? "hour" : "day";
    const { rows } = await pool().query(
      `SELECT
         date_trunc($1, at) AS bucket,
         COUNT(*)::int AS event_count,
         COUNT(DISTINCT actor_user_id)::int AS distinct_users
       FROM identity.user_activity_log
       WHERE at >= $2::timestamptz AND at <= $3::timestamptz
       GROUP BY bucket
       ORDER BY bucket ASC`,
      [interval, from, to],
    );
    res.json({ ok: true, from, to, interval, items: rows });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// ─── GET /api/admin/analytics/top-actions ──────────────────────────────
router.get("/api/admin/analytics/top-actions", readLimiter, ADMIN_ANALYTICS, async (req, res) => {
  try {
    const { from, to } = parseRange(req);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const { rows } = await pool().query(
      `SELECT action, COUNT(*)::int AS event_count,
              COUNT(DISTINCT actor_user_id)::int AS distinct_users,
              COUNT(*) FILTER (WHERE outcome = 'failure')::int AS failures
         FROM identity.user_activity_log
        WHERE at >= $1::timestamptz AND at <= $2::timestamptz
        GROUP BY action
        ORDER BY event_count DESC
        LIMIT $3`,
      [from, to, limit],
    );
    res.json({ ok: true, from, to, items: rows });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

export default router;
