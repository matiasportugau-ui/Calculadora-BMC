/**
 * Public Order ID → same sanitized projection as token track (T7).
 */
import { ensureTransportistaSchema } from "./transportistaSchema.js";
import { buildPublicTrackPayload, sanitizeSnapshot } from "./customerTrack.js";

export async function lookupTrackByOrderId(pool, orderId, { now = Date.now() } = {}) {
  if (!pool) return { ok: false, error: "no_pool" };
  const ref = String(orderId || "").trim();
  if (!ref) return { ok: false, error: "missing_order_id" };
  await ensureTransportistaSchema(pool);
  const { rows } = await pool.query(
    `select * from customer_track_tokens
      where quote_ref = $1 and revoked_at is null and expires_at > now()
      order by created_at desc
      limit 1`,
    [ref],
  );
  const row = rows[0];
  if (!row) return { ok: false, error: "not_found" };

  let tripStatus = null;
  let events = [];
  if (row.trip_id) {
    const trips = await pool.query(`select status from trips where trip_id = $1::uuid`, [row.trip_id]);
    tripStatus = trips.rows[0]?.status || null;
    // Stage events + recent GPS only — full location_ping history grows ~90/h after #1129.
    // Same window as token track (#1130); by-order must not re-open the public GPS bomb.
    const ev = await pool.query(
      `select event_type, at_server, geo_lat, geo_lng, stop_id
         from trip_events
        where trip_id = $1::uuid
          and (
            event_type not in ('location_ping', 'presence')
            or (
              event_type = 'location_ping'
              and at_server > now() - interval '45 minutes'
            )
          )
        order by at_server asc`,
      [row.trip_id],
    );
    events = ev.rows;
  }

  const snapshot = sanitizeSnapshot(row.public_snapshot || {});
  const payload = buildPublicTrackPayload({ snapshot, tripStatus, events, now });
  return payload;
}
