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

const EVENTS_SQL = `
select trip_id, event_type, at_server, geo_lat, geo_lng
  from trip_events
 where trip_id = any($1::uuid[])
 order by trip_id, at_server asc
`;

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
    const { rows: ev } = await pool.query(EVENTS_SQL, [ids]);
    for (const e of ev) {
      const k = e.trip_id;
      if (!eventsByTrip[k]) eventsByTrip[k] = [];
      eventsByTrip[k].push(e);
    }
  }
  return {
    ok: true,
    generated_at: new Date(now).toISOString(),
    trips: projectLiveBoard({ trips, eventsByTrip, now }),
  };
}
