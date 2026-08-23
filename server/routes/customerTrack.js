/**
 * Customer purchase observability — tokenized public status.
 *   POST /api/track/issue   (service token or identity JWT)
 *   GET  /api/track/:token  (public, rate-limited)
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getTransportistaPool } from "../lib/transportistaDb.js";
import { sha256Hex } from "../lib/driverToken.js";
import { requireServiceOrUser } from "../middleware/requireServiceOrUser.js";
import {
  ensureCustomerTrackTable,
  mintTrackToken,
  trackingPublicUrl,
  buildPublicTrackPayload,
  sanitizeSnapshot,
  clampCustomerTrackTtlDays,
  isPublicTrackTokenShape,
  canIssueCustomerTrack,
} from "../lib/customerTrack.js";

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const getLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

export default function createCustomerTrackRouter(config, logger) {
  const router = Router();
  const pool = getTransportistaPool(config.databaseUrl);
  const log = logger || console;
  const issueAuth = requireServiceOrUser({ authOnly: true });

  function requireDb(_req, res, next) {
    if (!pool) {
      return res.status(503).json({ ok: false, error: "DATABASE_URL not configured" });
    }
    return next();
  }

  router.post(
    "/track/issue",
    requireDb,
    issueAuth,
    asyncHandler(async (req, res) => {
      await ensureCustomerTrackTable(pool);
      const body = req.body || {};
      const snapshot = sanitizeSnapshot(body);
      if (!canIssueCustomerTrack(snapshot)) {
        return res.status(400).json({
          ok: false,
          error: "quote_ref or customer_display_name required",
        });
      }
      const ttlDays = clampCustomerTrackTtlDays(body.ttl_days);
      const expires = new Date(Date.now() + ttlDays * 86400_000);
      const { token, tokenHash } = mintTrackToken();
      const tripId = body.trip_id || null;
      const stopId = body.stop_id || null;

      await pool.query(
        `insert into customer_track_tokens
           (token_hash, trip_id, stop_id, quote_ref, public_snapshot, expires_at)
         values ($1, $2::uuid, $3::uuid, $4, $5::jsonb, $6)`,
        [
          tokenHash,
          tripId,
          stopId,
          snapshot.quote_ref || null,
          JSON.stringify(snapshot),
          expires.toISOString(),
        ],
      );

      const url = trackingPublicUrl(config.frontendBaseUrl, token);
      log.info?.({ quote_ref: snapshot.quote_ref }, "[track] issued");
      res.json({
        ok: true,
        url,
        token,
        expires_at: expires.toISOString(),
      });
    }),
  );

  router.get(
    "/track/:token",
    requireDb,
    getLimiter,
    asyncHandler(async (req, res) => {
      await ensureCustomerTrackTable(pool);
      const token = String(req.params.token || "");
      if (!isPublicTrackTokenShape(token)) {
        return res.status(404).json({ ok: false, error: "not_found" });
      }
      const tokenHash = sha256Hex(token);
      const { rows } = await pool.query(
        `select * from customer_track_tokens
         where token_hash = $1 and revoked_at is null and expires_at > now()
         limit 1`,
        [tokenHash],
      );
      const row = rows[0];
      if (!row) {
        return res.status(404).json({ ok: false, error: "not_found" });
      }

      let tripStatus = null;
      let events = [];
      if (row.trip_id) {
        const trips = await pool.query(`select status from trips where trip_id = $1::uuid`, [row.trip_id]);
        tripStatus = trips.rows[0]?.status || null;
        const ev = await pool.query(
          `select event_type, at_server, geo_lat, geo_lng, stop_id
           from trip_events
           where trip_id = $1::uuid
           order by at_server asc`,
          [row.trip_id],
        );
        events = ev.rows;
      }

      const payload = buildPublicTrackPayload({
        snapshot: row.public_snapshot || {},
        tripStatus,
        events,
      });
      res.set("Cache-Control", "no-store");
      res.json(payload);
    }),
  );

  return router;
}
