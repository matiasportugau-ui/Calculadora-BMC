/**
 * Driver PWA auth. Magic-link driver_sessions and HITL chofer_sessions
 * both unlock GET /api/driver/trips (the path BMC Driver already calls).
 *
 * Intentionally does NOT run ensureTransportistaSchema — this sits on the
 * GPS/presence hot path (requireDriver). Schema is ensured at login/assign.
 */
import { sha256Hex } from "./driverToken.js";

/**
 * @param {{ query: Function }} pool
 * @param {string} bearer
 */
export async function resolveDriverAuth(pool, bearer) {
  if (!pool) return { ok: false, error: "no_pool" };
  const token = String(bearer || "").trim();
  if (!token) return { ok: false, error: "Missing Bearer token" };
  const tokenHash = sha256Hex(token);

  const ds = await pool.query(
    `select * from driver_sessions
      where token_hash = $1 and revoked_at is null and expires_at > now()
      limit 1`,
    [tokenHash],
  );
  if (ds.rows[0]) {
    const s = ds.rows[0];
    return {
      ok: true,
      kind: "driver_session",
      trip_id: s.trip_id,
      driver_id: s.driver_id,
      chofer_id: null,
      session: s,
    };
  }

  const cs = await pool.query(
    `select * from chofer_sessions
      where token_hash = $1 and revoked_at is null and expires_at > now()
      limit 1`,
    [tokenHash],
  );
  if (cs.rows[0]) {
    const s = cs.rows[0];
    return {
      ok: true,
      kind: "chofer_session",
      trip_id: null,
      driver_id: s.chofer_id,
      chofer_id: s.chofer_id,
      session: s,
    };
  }
  return { ok: false, error: "Invalid or expired session" };
}

/**
 * Same listing GET /api/driver/trips returns.
 * @param {{ query: Function }} pool
 * @param {Awaited<ReturnType<typeof resolveDriverAuth>>} auth
 */
export async function listTripsForDriverAuth(pool, auth) {
  if (!auth?.ok) return { ok: false, error: auth?.error || "Unauthorized", trips: [] };
  if (auth.kind === "driver_session") {
    const { rows } = await pool.query(`select * from trips where trip_id = $1::uuid`, [auth.trip_id]);
    return { ok: true, trips: rows };
  }
  const { rows } = await pool.query(
    `select * from trips
      where assigned_driver_id = $1::uuid
      order by updated_at desc`,
    [auth.chofer_id],
  );
  return { ok: true, trips: rows };
}

export async function driverAuthOwnsTrip(pool, auth, tripId) {
  if (!auth?.ok || !tripId) return false;
  if (auth.kind === "driver_session") return String(auth.trip_id) === String(tripId);
  const { rows } = await pool.query(
    `select trip_id from trips
      where trip_id = $1::uuid and assigned_driver_id = $2::uuid`,
    [tripId, auth.chofer_id],
  );
  return Boolean(rows[0]);
}
