import { projectLiveBoard } from "../../src/utils/logistica/torreLiveView.js";
import { ensureTransportistaSchema } from "./transportistaSchema.js";

const LIVE_SQL = `
select trip_id, status, plan_snapshot, assigned_phone_e164, assigned_driver_id, updated_at, closed_at
  from trips
 where closed_at is null
   and status in ('draft', 'assigned', 'confirmed')
 order by updated_at desc
 limit 80
`;

/** Latest GPS ping with coordinates per live trip (not full history). */
const LAST_PING_SQL = `
select distinct on (trip_id) trip_id, event_type, at_server, geo_lat, geo_lng
  from trip_events
 where trip_id = any($1::uuid[])
   and event_type = 'location_ping'
   and geo_lat is not null
   and geo_lng is not null
 order by trip_id, at_server desc
`;

/** Latest non-heartbeat event per trip (for last_event on the board). */
const LAST_MEANINGFUL_SQL = `
select distinct on (trip_id) trip_id, event_type, at_server, geo_lat, geo_lng
  from trip_events
 where trip_id = any($1::uuid[])
   and event_type not in ('location_ping', 'presence')
 order by trip_id, at_server desc
`;

const EVIDENCE_COUNT_SQL = `
select trip_id, count(*)::int as evidence_count
  from trip_events
 where trip_id = any($1::uuid[])
   and event_type = 'evidence_committed'
 group by trip_id
`;

/**
 * Build a compact events list for projectLiveTrip without shipping full GPS history.
 * Order: evidence stubs → last meaningful → latest ping
 * (lastNonPingEvent / lastLocationPing both scan from the end).
 * @param {{ lastMeaningful?: object|null, lastPing?: object|null, evidenceCount?: number }} parts
 */
export function compactEventsForProjection(parts = {}) {
  const events = [];
  const n = Math.max(0, Number(parts.evidenceCount) || 0);
  for (let i = 0; i < n; i += 1) {
    events.push({ event_type: "evidence_committed" });
  }
  if (parts.lastMeaningful) events.push(parts.lastMeaningful);
  if (parts.lastPing) events.push(parts.lastPing);
  return events;
}

/**
 * @param {import("pg").Pool} pool
 * @param {{ now?: number }} [opts]
 */
export async function loadTorreLive(pool, opts = {}) {
  if (!pool) {
    return { ok: false, error: "no_pool" };
  }
  try {
    await ensureTransportistaSchema(pool);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
  const now = opts.now ?? Date.now();
  let tripRows;
  try {
    const q = await pool.query(LIVE_SQL);
    tripRows = q.rows;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
  const trips = tripRows || [];
  const ids = trips.map((t) => t.trip_id).filter(Boolean);
  const eventsByTrip = {};
  if (ids.length) {
    try {
      const [pings, meaningful, evidence] = await Promise.all([
        pool.query(LAST_PING_SQL, [ids]),
        pool.query(LAST_MEANINGFUL_SQL, [ids]),
        pool.query(EVIDENCE_COUNT_SQL, [ids]),
      ]);
      const pingBy = Object.fromEntries(pings.rows.map((r) => [r.trip_id, r]));
      const meaningfulBy = Object.fromEntries(meaningful.rows.map((r) => [r.trip_id, r]));
      const evidenceBy = Object.fromEntries(
        evidence.rows.map((r) => [r.trip_id, r.evidence_count]),
      );
      for (const id of ids) {
        eventsByTrip[id] = compactEventsForProjection({
          lastMeaningful: meaningfulBy[id] || null,
          lastPing: pingBy[id] || null,
          evidenceCount: evidenceBy[id] || 0,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }
  return {
    ok: true,
    generated_at: new Date(now).toISOString(),
    trips: projectLiveBoard({ trips, eventsByTrip, now }),
  };
}
