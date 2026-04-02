const DRIVER_EVENT_TYPES = new Set([
  "stop_arrived",
  "stop_departed",
  "factory_arrived",
  "load_started",
  "load_completed",
  "factory_departed",
  "delivery_completed",
  "delivery_partial",
  "delivery_failed",
  "incident_reported",
]);

export function isAllowedDriverEventType(type) {
  return DRIVER_EVENT_TYPES.has(String(type || ""));
}

/**
 * @param {import("pg").Pool} pool
 * @param {string} tripId
 * @param {string | null} stopId
 */
export async function hasEvidenceForStop(pool, tripId, stopId) {
  if (!stopId) return false;
  const { rows } = await pool.query(
    `select 1 from trip_events
     where trip_id = $1::uuid and event_type = 'evidence_committed' and stop_id = $2::uuid
     limit 1`,
    [tripId, stopId],
  );
  return rows.length > 0;
}
