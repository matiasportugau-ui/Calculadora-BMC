/**
 * Project driver trip_events onto repartos / trips status.
 * Must run after every successful insert *and* on idempotent replay (23505),
 * otherwise a lost response or failed projection leaves trips never closed.
 */

const FACTORY_TYPES = new Set([
  "factory_arrived",
  "load_started",
  "load_completed",
  "factory_departed",
]);

/** Events whose projection failure must surface to the client (retry / outbox). */
export function projectionMustSucceed(type) {
  return String(type || "") === "delivery_completed";
}

/**
 * @param {{ query: Function }} pool
 * @param {string} tripId
 * @param {string} type
 */
export async function projectRepartoFromDriverEvent(pool, tripId, type) {
  const { rows } = await pool.query(`select plan_snapshot from trips where trip_id = $1::uuid`, [tripId]);
  const repartoId = rows[0]?.plan_snapshot?.reparto_id;
  if (!repartoId) return;
  if (FACTORY_TYPES.has(type)) {
    await pool.query(
      `update repartos set status = 'en_curso', updated_at = now()
        where id = $1 and status = 'coordinado'`,
      [String(repartoId)],
    );
  }
  if (type === "delivery_completed") {
    const ev = await pool.query(
      `select stop_id from trip_events
        where trip_id = $1::uuid and event_type = 'delivery_completed'`,
      [tripId],
    );
    const stops = rows[0]?.plan_snapshot?.stops;
    const needed = Array.isArray(stops) ? stops.filter((s) => s && s.id).map((s) => String(s.id)) : [];
    const got = new Set(ev.rows.map((r) => String(r.stop_id || "")));
    const all = needed.length > 0 && needed.every((id) => got.has(id));
    if (all) {
      await pool.query(
        `update repartos set status = 'cerrado', updated_at = now()
          where id = $1 and status in ('coordinado', 'en_curso')`,
        [String(repartoId)],
      );
      await pool.query(
        `update trips set status = 'closed', closed_at = now(), updated_at = now()
          where trip_id = $1::uuid`,
        [tripId],
      );
    }
  }
}

/**
 * After inserting a driver event (or hitting unique idempotency), project status.
 * @returns {{ projected: boolean }}
 */
export async function afterDriverEventRecorded(pool, tripId, type) {
  if (type === "location_ping" || type === "presence") {
    return { projected: false };
  }
  try {
    await projectRepartoFromDriverEvent(pool, tripId, type);
    return { projected: true };
  } catch (err) {
    if (projectionMustSucceed(type)) throw err;
    return { projected: false, error: err };
  }
}
