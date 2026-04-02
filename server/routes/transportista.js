/**
 * Modo Transportista — API bajo /api (montar con app.use("/api", router))
 */
import { Router } from "express";
import { getTransportistaPool } from "../lib/transportistaDb.js";
import { generateOpaqueToken, sha256Hex } from "../lib/driverToken.js";
import { isAllowedDriverEventType, hasEvidenceForStop } from "../lib/transportistaFsm.js";
import { createGcsV4UploadUrl, writeLocalDevEvidence } from "../lib/transportistaEvidence.js";
import path from "node:path";
import crypto from "node:crypto";

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function requireCrmAuth(config) {
  return (req, res, next) => {
    const token = config.apiAuthToken;
    if (!token) {
      return res.status(503).json({
        ok: false,
        error: "API_AUTH_TOKEN not configured — transportista backoffice disabled",
      });
    }
    const auth = String(req.headers.authorization || "");
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const xKey = String(req.headers["x-api-key"] || req.query?.key || "");
    if (bearer === token || xKey === token) return next();
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  };
}

function conductorBaseUrl(config) {
  const base = String(config.publicBaseUrl || "").replace(/\/$/, "");
  return `${base}/calculadora/conductor`;
}

/**
 * @param {import("../config.js").config} config
 * @param {import("pino").Logger} [logger]
 */
export default function createTransportistaRouter(config, logger) {
  const router = Router();
  const pool = getTransportistaPool(config.databaseUrl);
  const log = logger || console;
  const auth = requireCrmAuth(config);

  function requireDb(_req, res, next) {
    if (!pool) {
      return res.status(503).json({ ok: false, error: "DATABASE_URL not configured" });
    }
    return next();
  }

  const requireDriver = asyncHandler(async (req, res, next) => {
    const authH = String(req.headers.authorization || "");
    const bearer = authH.startsWith("Bearer ") ? authH.slice(7).trim() : "";
    if (!bearer) {
      return res.status(401).json({ ok: false, error: "Missing Bearer token" });
    }
    const tokenHash = sha256Hex(bearer);
    const { rows } = await pool.query(
      `select * from driver_sessions
       where token_hash = $1 and revoked_at is null and expires_at > now()
       limit 1`,
      [tokenHash],
    );
    const session = rows[0];
    if (!session) {
      return res.status(401).json({ ok: false, error: "Invalid or expired session" });
    }
    req.transportistaSession = session;
    req.transportistaTokenPlain = bearer;
    next();
  });

  router.get(
    "/transportista/health",
    requireDb,
    asyncHandler(async (_req, res) => {
      await pool.query("select 1");
      res.json({ ok: true, module: "transportista" });
    }),
  );

  router.post(
    "/trips",
    requireDb,
    auth,
    asyncHandler(async (req, res) => {
      const plan = req.body?.plan_snapshot ?? {};
      const { rows } = await pool.query(
        `insert into trips (plan_snapshot) values ($1::jsonb) returning trip_id, status, created_at`,
        [JSON.stringify(plan)],
      );
      res.status(201).json({ ok: true, trip: rows[0] });
    }),
  );

  router.post(
    "/trips/:trip_id/confirm",
    requireDb,
    auth,
    asyncHandler(async (req, res) => {
      const tripId = req.params.trip_id;
      const idempotency_key = req.body?.idempotency_key;
      const actor_id = req.body?.actor_id || null;
      const actor_type = req.body?.actor_type || "dispatcher";
      const snapshot_plan = req.body?.snapshot_plan;

      if (!idempotency_key) {
        return res.status(400).json({ ok: false, error: "idempotency_key required" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const dup = await client.query(
          `select event_id from trip_events where trip_id = $1::uuid and idempotency_key = $2`,
          [tripId, idempotency_key],
        );
        if (dup.rows.length > 0) {
          await client.query("COMMIT");
          return res.json({ ok: true, idempotent: true });
        }

        const { rows: trips } = await client.query(
          `select * from trips where trip_id = $1::uuid for update`,
          [tripId],
        );
        if (trips.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ ok: false, error: "Trip not found" });
        }
        const trip = trips[0];
        if (trip.status === "confirmed" || trip.status === "assigned" || trip.status === "closed") {
          await client.query("COMMIT");
          return res.json({ ok: true, idempotent: true, status: trip.status });
        }
        if (trip.status !== "draft") {
          await client.query("ROLLBACK");
          return res.status(409).json({ ok: false, error: `Cannot confirm from status ${trip.status}` });
        }

        const snapshot =
          snapshot_plan != null ? snapshot_plan : typeof trip.plan_snapshot === "object" ? trip.plan_snapshot : {};
        await client.query(
          `update trips set status = 'confirmed', confirmed_at = now(), plan_snapshot = $2::jsonb, updated_at = now()
           where trip_id = $1::uuid`,
          [tripId, JSON.stringify(snapshot)],
        );
        await client.query(
          `insert into trip_events (trip_id, stop_id, event_type, actor_type, actor_id, idempotency_key, payload)
           values ($1::uuid, null, 'trip_confirmed', $2, $3::uuid, $4, $5::jsonb)`,
          [tripId, actor_type, actor_id, idempotency_key, JSON.stringify({ snapshot_plan: snapshot })],
        );
        await client.query("COMMIT");
        res.json({ ok: true, trip_id: tripId, status: "confirmed" });
      } catch (e) {
        await client.query("ROLLBACK");
        if (e.code === "23505") {
          return res.json({ ok: true, idempotent: true });
        }
        log.error({ err: e }, "confirm trip failed");
        throw e;
      } finally {
        client.release();
      }
    }),
  );

  router.post(
    "/trips/:trip_id/assign",
    requireDb,
    auth,
    asyncHandler(async (req, res) => {
      const tripId = req.params.trip_id;
      const idempotency_key = req.body?.idempotency_key;
      const driver_id = req.body?.driver_id;
      const vehicle_id = req.body?.vehicle_id || null;
      const phone_e164 = req.body?.phone_e164 || null;
      const note = req.body?.note || null;

      if (!idempotency_key || !driver_id) {
        return res.status(400).json({ ok: false, error: "idempotency_key and driver_id required" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const dupAssign = await client.query(
          `select event_id from trip_events where trip_id = $1::uuid and event_type = 'trip_assigned' and idempotency_key = $2`,
          [tripId, idempotency_key],
        );
        if (dupAssign.rows.length > 0) {
          await client.query("COMMIT");
          return res.json({ ok: true, idempotent: true });
        }

        const { rows: trips } = await client.query(
          `select * from trips where trip_id = $1::uuid for update`,
          [tripId],
        );
        if (trips.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ ok: false, error: "Trip not found" });
        }
        const trip = trips[0];
        if (trip.status !== "confirmed") {
          await client.query("ROLLBACK");
          return res.status(409).json({ ok: false, error: "Trip must be confirmed before assign" });
        }

        await client.query(
          `update trips set status = 'assigned', assigned_driver_id = $2::uuid, assigned_phone_e164 = $3, updated_at = now()
           where trip_id = $1::uuid`,
          [tripId, driver_id, phone_e164],
        );

        await client.query(
          `insert into trip_events (trip_id, stop_id, event_type, actor_type, actor_id, idempotency_key, payload)
           values ($1::uuid, null, 'trip_assigned', 'dispatcher', null, $2, $3::jsonb)`,
          [tripId, idempotency_key, JSON.stringify({ driver_id, vehicle_id, phone_e164, note })],
        );

        await client.query(
          `insert into trip_events (trip_id, stop_id, event_type, actor_type, actor_id, idempotency_key, payload)
           values ($1::uuid, null, 'driver_link_requested', 'system', null, $2, $3::jsonb)`,
          [tripId, `${idempotency_key}:driver_link_requested`, JSON.stringify({ driver_id, phone_e164 })],
        );

        const plainToken = generateOpaqueToken();
        const tokenHash = sha256Hex(plainToken);
        const ttlMs = Math.max(1, Number(config.transportistaDriverTokenTtlHours) || 24) * 3600 * 1000;
        const expiresAt = new Date(Date.now() + ttlMs);

        await client.query(
          `update driver_sessions set revoked_at = now()
           where trip_id = $1::uuid and driver_id = $2::uuid and revoked_at is null`,
          [tripId, driver_id],
        );

        await client.query(
          `insert into driver_sessions (trip_id, driver_id, token_hash, expires_at)
           values ($1::uuid, $2::uuid, $3, $4::timestamptz)`,
          [tripId, driver_id, tokenHash, expiresAt.toISOString()],
        );

        const url = `${conductorBaseUrl(config)}?t=${encodeURIComponent(plainToken)}`;
        await client.query(
          `insert into trip_events (trip_id, stop_id, event_type, actor_type, actor_id, idempotency_key, payload)
           values ($1::uuid, null, 'driver_link_issued', 'system', null, $2, $3::jsonb)`,
          [
            tripId,
            `${idempotency_key}:driver_link_issued`,
            JSON.stringify({ driver_id, url, expires_at: expiresAt.toISOString() }),
          ],
        );

        if (phone_e164) {
          const digits = String(phone_e164).replace(/\D/g, "");
          if (digits) {
            await client.query(
              `insert into outbox_notifications (trip_id, driver_id, channel, to_e164, payload, status, next_attempt_at)
               values ($1::uuid, $2::uuid, 'whatsapp', $3, $4::jsonb, 'pending', now())`,
              [
                tripId,
                driver_id,
                digits,
                JSON.stringify({
                  text: `Tu enlace de conductor BMC (válido hasta ${expiresAt.toISOString()}): ${url}`,
                  trip_id: tripId,
                  driver_id,
                  idempotency_key,
                }),
              ],
            );
          }
        }

        await client.query("COMMIT");
        res.json({
          ok: true,
          trip_id: tripId,
          driver_id,
          driver_url: url,
          expires_at: expiresAt.toISOString(),
        });
      } catch (e) {
        await client.query("ROLLBACK");
        if (e.code === "23505") {
          return res.json({ ok: true, idempotent: true });
        }
        log.error({ err: e }, "assign trip failed");
        throw e;
      } finally {
        client.release();
      }
    }),
  );

  router.post(
    "/trips/:trip_id/driver-link/regenerate",
    requireDb,
    auth,
    asyncHandler(async (req, res) => {
      const tripId = req.params.trip_id;
      const driver_id = req.body?.driver_id;
      const idempotency_key = req.body?.idempotency_key;
      if (!driver_id || !idempotency_key) {
        return res.status(400).json({ ok: false, error: "driver_id and idempotency_key required" });
      }

      const { rows: trips } = await pool.query(`select * from trips where trip_id = $1::uuid`, [tripId]);
      if (trips.length === 0) return res.status(404).json({ ok: false, error: "Trip not found" });
      const trip = trips[0];
      if (trip.status !== "assigned") {
        return res.status(409).json({ ok: false, error: "Trip must be assigned" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const dup = await client.query(
          `select event_id from trip_events where trip_id = $1::uuid and idempotency_key = $2`,
          [tripId, idempotency_key],
        );
        if (dup.rows.length > 0) {
          await client.query("COMMIT");
          return res.json({ ok: true, idempotent: true });
        }

        const plainToken = generateOpaqueToken();
        const tokenHash = sha256Hex(plainToken);
        const ttlMs = Math.max(1, Number(config.transportistaDriverTokenTtlHours) || 24) * 3600 * 1000;
        const expiresAt = new Date(Date.now() + ttlMs);

        await client.query(
          `update driver_sessions set revoked_at = now()
           where trip_id = $1::uuid and driver_id = $2::uuid and revoked_at is null`,
          [tripId, driver_id],
        );
        await client.query(
          `insert into driver_sessions (trip_id, driver_id, token_hash, expires_at)
           values ($1::uuid, $2::uuid, $3, $4::timestamptz)`,
          [tripId, driver_id, tokenHash, expiresAt.toISOString()],
        );

        const url = `${conductorBaseUrl(config)}?t=${encodeURIComponent(plainToken)}`;
        await client.query(
          `insert into trip_events (trip_id, stop_id, event_type, actor_type, actor_id, idempotency_key, payload)
           values ($1::uuid, null, 'driver_link_issued', 'system', null, $2, $3::jsonb)`,
          [
            tripId,
            idempotency_key,
            JSON.stringify({ driver_id, url, expires_at: expiresAt.toISOString(), rotated: true }),
          ],
        );

        const phone = trip.assigned_phone_e164;
        if (phone) {
          const digits = String(phone).replace(/\D/g, "");
          if (digits) {
            await client.query(
              `insert into outbox_notifications (trip_id, driver_id, channel, to_e164, payload, status, next_attempt_at)
               values ($1::uuid, $2::uuid, 'whatsapp', $3, $4::jsonb, 'pending', now())`,
              [
                tripId,
                driver_id,
                digits,
                JSON.stringify({
                  text: `Nuevo enlace de conductor BMC: ${url}`,
                  trip_id: tripId,
                  driver_id,
                  idempotency_key,
                }),
              ],
            );
          }
        }

        await client.query("COMMIT");
        res.json({ ok: true, driver_url: url, expires_at: expiresAt.toISOString() });
      } catch (e) {
        await client.query("ROLLBACK");
        if (e.code === "23505") return res.json({ ok: true, idempotent: true });
        throw e;
      } finally {
        client.release();
      }
    }),
  );

  router.get(
    "/trips/:trip_id/timeline",
    requireDb,
    auth,
    asyncHandler(async (req, res) => {
      const tripId = req.params.trip_id;
      const { rows } = await pool.query(
        `select event_id, trip_id, stop_id, event_type, actor_type, actor_id, idempotency_key,
                at_client_ms, at_server, geo_lat, geo_lng, payload
         from trip_events where trip_id = $1::uuid order by at_server asc`,
        [tripId],
      );
      res.json({ ok: true, events: rows });
    }),
  );

  router.get(
    "/trips/:trip_id/state",
    requireDb,
    auth,
    asyncHandler(async (req, res) => {
      const tripId = req.params.trip_id;
      const { rows: trips } = await pool.query(`select * from trips where trip_id = $1::uuid`, [tripId]);
      if (trips.length === 0) return res.status(404).json({ ok: false, error: "Trip not found" });
      const { rows: lastE } = await pool.query(
        `select * from trip_events where trip_id = $1::uuid order by at_server desc limit 1`,
        [tripId],
      );
      res.json({ ok: true, trip: trips[0], last_event: lastE[0] || null });
    }),
  );

  router.post(
    "/trips/:trip_id/close",
    requireDb,
    auth,
    asyncHandler(async (req, res) => {
      const tripId = req.params.trip_id;
      const idempotency_key = req.body?.idempotency_key;
      if (!idempotency_key) return res.status(400).json({ ok: false, error: "idempotency_key required" });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const dup = await client.query(
          `select 1 from trip_events where trip_id = $1::uuid and idempotency_key = $2`,
          [tripId, idempotency_key],
        );
        if (dup.rows.length > 0) {
          await client.query("COMMIT");
          return res.json({ ok: true, idempotent: true });
        }
        await client.query(
          `update trips set status = 'closed', closed_at = now(), updated_at = now() where trip_id = $1::uuid`,
          [tripId],
        );
        await client.query(
          `insert into trip_events (trip_id, stop_id, event_type, actor_type, actor_id, idempotency_key, payload)
           values ($1::uuid, null, 'trip_closed', 'dispatcher', $2::uuid, $3, $4::jsonb)`,
          [tripId, req.body?.actor_id || null, idempotency_key, JSON.stringify({ note: req.body?.note || null })],
        );
        await client.query("COMMIT");
        res.json({ ok: true, trip_id: tripId, status: "closed" });
      } catch (e) {
        await client.query("ROLLBACK");
        if (e.code === "23505") return res.json({ ok: true, idempotent: true });
        throw e;
      } finally {
        client.release();
      }
    }),
  );

  router.get(
    "/driver/trips",
    requireDb,
    requireDriver,
    asyncHandler(async (req, res) => {
      const s = req.transportistaSession;
      const { rows } = await pool.query(`select * from trips where trip_id = $1::uuid`, [s.trip_id]);
      res.json({ ok: true, trips: rows });
    }),
  );

  router.get(
    "/driver/trips/:trip_id",
    requireDb,
    requireDriver,
    asyncHandler(async (req, res) => {
      const s = req.transportistaSession;
      if (req.params.trip_id !== s.trip_id) {
        return res.status(403).json({ ok: false, error: "Trip not in session scope" });
      }
      const { rows } = await pool.query(`select * from trips where trip_id = $1::uuid`, [s.trip_id]);
      if (rows.length === 0) return res.status(404).json({ ok: false, error: "Not found" });
      const { rows: events } = await pool.query(
        `select event_type, at_server, payload, stop_id from trip_events where trip_id = $1::uuid order by at_server asc`,
        [s.trip_id],
      );
      res.json({ ok: true, trip: rows[0], timeline: events });
    }),
  );

  router.post(
    "/driver/events",
    requireDb,
    requireDriver,
    asyncHandler(async (req, res) => {
      const s = req.transportistaSession;
      const {
        idempotency_key,
        trip_id,
        stop_id = null,
        type,
        at_client_ms = null,
        geo = null,
        payload = {},
      } = req.body || {};

      if (!idempotency_key || !trip_id || !type) {
        return res.status(400).json({ ok: false, error: "idempotency_key, trip_id, type required" });
      }
      if (trip_id !== s.trip_id) {
        return res.status(403).json({ ok: false, error: "trip_id mismatch" });
      }
      if (!isAllowedDriverEventType(type)) {
        return res.status(400).json({ ok: false, error: `Unsupported event type: ${type}` });
      }

      if (type === "delivery_completed" && config.transportistaStrictPod && stop_id) {
        const okPod = await hasEvidenceForStop(pool, trip_id, stop_id);
        if (!okPod) {
          return res.status(409).json({ ok: false, error: "POD evidence required for this stop (strict mode)" });
        }
      }

      const lat = geo?.lat != null ? Number(geo.lat) : null;
      const lng = geo?.lng != null ? Number(geo.lng) : null;

      try {
        await pool.query(
          `insert into trip_events (trip_id, stop_id, event_type, actor_type, actor_id, idempotency_key, at_client_ms, geo_lat, geo_lng, payload)
           values ($1::uuid, $2::uuid, $3, 'driver', $4::uuid, $5, $6, $7, $8, $9::jsonb)`,
          [
            trip_id,
            stop_id,
            type,
            s.driver_id,
            idempotency_key,
            at_client_ms != null ? Number(at_client_ms) : null,
            Number.isFinite(lat) ? lat : null,
            Number.isFinite(lng) ? lng : null,
            JSON.stringify(payload),
          ],
        );
      } catch (e) {
        if (e.code === "23505") {
          return res.json({ ok: true, idempotent: true });
        }
        throw e;
      }
      res.json({ ok: true });
    }),
  );

  router.post(
    "/driver/evidence/upload-url",
    requireDb,
    requireDriver,
    asyncHandler(async (req, res) => {
      const s = req.transportistaSession;
      const { idempotency_key, trip_id, stop_id = null, kind, mime, size_bytes = 0 } = req.body || {};
      if (!idempotency_key || !trip_id || !kind || !mime) {
        return res.status(400).json({ ok: false, error: "idempotency_key, trip_id, kind, mime required" });
      }
      if (trip_id !== s.trip_id) return res.status(403).json({ ok: false, error: "trip_id mismatch" });

      const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
      const objectPath = `trips/${trip_id}/${kind}/${randomFileSuffix()}.${ext}`;

      if (config.transportistaGcsBucket) {
        const { uploadUrl, expiresAt } = await createGcsV4UploadUrl({
          bucket: config.transportistaGcsBucket,
          objectPath,
          mime,
        });
        return res.json({
          ok: true,
          upload_url: uploadUrl,
          path: objectPath,
          expires_at: expiresAt,
          bucket: config.transportistaGcsBucket,
        });
      }

      return res.status(503).json({
        ok: false,
        error: "TRANSPORTISTA_GCS_BUCKET not set — use POST /api/driver/evidence/upload-b64 for dev",
        dev_path_hint: objectPath,
      });
    }),
  );

  router.post(
    "/driver/evidence/commit",
    requireDb,
    requireDriver,
    asyncHandler(async (req, res) => {
      const s = req.transportistaSession;
      const { idempotency_key, trip_id, stop_id = null, kind, path: objectPath, sha256 = null, mime = null, size_bytes = null } =
        req.body || {};
      if (!idempotency_key || !trip_id || !kind || !objectPath) {
        return res.status(400).json({ ok: false, error: "idempotency_key, trip_id, kind, path required" });
      }
      if (trip_id !== s.trip_id) return res.status(403).json({ ok: false, error: "trip_id mismatch" });

      try {
        await pool.query(
          `insert into trip_events (trip_id, stop_id, event_type, actor_type, actor_id, idempotency_key, payload)
           values ($1::uuid, $2::uuid, 'evidence_committed', 'driver', $3::uuid, $4, $5::jsonb)`,
          [
            trip_id,
            stop_id,
            s.driver_id,
            idempotency_key,
            JSON.stringify({ kind, path: objectPath, sha256, mime, size_bytes }),
          ],
        );
      } catch (e) {
        if (e.code === "23505") return res.json({ ok: true, idempotent: true });
        throw e;
      }
      res.json({ ok: true });
    }),
  );

  router.post(
    "/driver/evidence/upload-b64",
    requireDb,
    requireDriver,
    asyncHandler(async (req, res) => {
      const s = req.transportistaSession;
      const {
        idempotency_key,
        trip_id,
        stop_id = null,
        kind,
        mime = "image/jpeg",
        data_base64,
      } = req.body || {};
      if (!idempotency_key || !trip_id || !kind || !data_base64) {
        return res.status(400).json({ ok: false, error: "idempotency_key, trip_id, kind, data_base64 required" });
      }
      if (trip_id !== s.trip_id) return res.status(403).json({ ok: false, error: "trip_id mismatch" });

      let buf;
      try {
        buf = Buffer.from(String(data_base64), "base64");
      } catch {
        return res.status(400).json({ ok: false, error: "invalid base64" });
      }
      if (buf.length > 6 * 1024 * 1024) {
        return res.status(413).json({ ok: false, error: "file too large (max 6MB dev)" });
      }

      const ext = mime.includes("png") ? "png" : "jpg";
      const rel = `${trip_id}/${kind}/${randomFileSuffix()}.${ext}`;
      const rootDir = path.join(process.cwd(), "data", "transportista-evidence");
      await writeLocalDevEvidence({ rootDir, relativePath: rel, buffer: buf });

      try {
        await pool.query(
          `insert into trip_events (trip_id, stop_id, event_type, actor_type, actor_id, idempotency_key, payload)
           values ($1::uuid, $2::uuid, 'evidence_committed', 'driver', $3::uuid, $4, $5::jsonb)`,
          [
            trip_id,
            stop_id,
            s.driver_id,
            idempotency_key,
            JSON.stringify({ kind, path: rel, mime, size_bytes: buf.length, storage: "local_dev" }),
          ],
        );
      } catch (e) {
        if (e.code === "23505") return res.json({ ok: true, idempotent: true });
        throw e;
      }
      res.json({ ok: true, path: rel, storage: "local_dev" });
    }),
  );

  return router;
}

function randomFileSuffix() {
  return `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
}
