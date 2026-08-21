import { generateOpaqueToken, sha256Hex } from "./driverToken.js";
import { conductorPublicUrl } from "../../src/utils/conductorUrl.js";
import { driverIdFromPhone, ensureStopUuid, isPickupStop } from "./driverId.js";
import { mintTrackToken, trackingPublicUrl, sanitizeSnapshot, ensureCustomerTrackTable } from "./customerTrack.js";

export function digitsPhone(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  return d.length >= 8 ? d : "";
}

export function shouldInsertDriverOutbox(notifyDriver, phone) {
  return Boolean(notifyDriver && digitsPhone(phone));
}

/** Pure slice of join — used by tests and joinRepartoToTrip. */
export function prepareJoinContext(reparto, payload = {}) {
  const stopsIn = Array.isArray(payload?.stops) ? payload.stops : [];
  const stops = stopsIn.map((s, i) => ({ ...s, id: ensureStopUuid(s, i) }));
  const info = payload?.info && typeof payload.info === "object" ? payload.info : {};
  const phone = digitsPhone(info.chofer_phone || info.telefono_chofer || reparto.assigned_phone_e164);
  const driverId = driverIdFromPhone(phone || `reparto:${reparto.id}`);
  const plan = {
    schema: "bmc-trip-from-reparto-v1",
    reparto_id: reparto.id,
    reparto_no: reparto.reparto_no,
    stops,
    info,
    truckL: payload?.truckL ?? reparto.truck_l ?? null,
    transportista: info.transportista || reparto.transportista || null,
    patente: info.patente || reparto.patente || null,
  };
  const deliveryStops = stops.filter((s) => !isPickupStop(s) && (s.orderId || s.cliente || s.cotizacionId));
  return { stops, info, phone, driverId, plan, deliveryStops };
}

/**
 * After a REP is coordinado, mint a transportista trip + driver session.
 * Does not roll back the REP if this fails — caller should surface driver_loop.
 */
export async function joinRepartoToTrip({
  pool,
  config,
  reparto,
  payload,
  notifyDriver = false,
  actor = "logistica-ui",
}) {
  if (!pool) {
    return { ok: false, error: "no_pool" };
  }
  const { info, phone, driverId, plan, deliveryStops } = prepareJoinContext(reparto, payload);
  const frontend = config.frontendBaseUrl || "https://calculadora-bmc.vercel.app";
  const ttlH = Math.max(1, Number(config.transportistaDriverTokenTtlHours) || 24);

  const client = await pool.connect();
  let tripId;
  let driverUrl;
  let expiresAt;
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `select trip_id, plan_snapshot from trips
        where plan_snapshot->>'reparto_id' = $1
        limit 1`,
      [String(reparto.id)],
    );
    if (existing.rows[0]) {
      tripId = existing.rows[0].trip_id;
    } else {
      const ins = await client.query(
        `insert into trips (plan_snapshot, status)
         values ($1::jsonb, 'draft')
         returning trip_id`,
        [JSON.stringify(plan)],
      );
      tripId = ins.rows[0].trip_id;
    }

    await client.query(
      `update trips
          set status = 'assigned',
              assigned_driver_id = $2::uuid,
              assigned_phone_e164 = $3,
              confirmed_at = coalesce(confirmed_at, now()),
              plan_snapshot = $4::jsonb,
              updated_at = now()
        where trip_id = $1::uuid`,
      [tripId, driverId, phone || null, JSON.stringify(plan)],
    );

    const idem = `join:${reparto.id}:${tripId}`;
    await client.query(
      `insert into trip_events (trip_id, stop_id, event_type, actor_type, actor_id, idempotency_key, payload)
       values ($1::uuid, null, 'trip_assigned', 'dispatcher', null, $2, $3::jsonb)
       on conflict (trip_id, idempotency_key) do nothing`,
      [tripId, idem, JSON.stringify({ actor, reparto_no: reparto.reparto_no })],
    );

    await client.query(
      `update driver_sessions set revoked_at = now()
        where trip_id = $1::uuid and driver_id = $2::uuid and revoked_at is null`,
      [tripId, driverId],
    );
    const plain = generateOpaqueToken();
    const tokenHash = sha256Hex(plain);
    expiresAt = new Date(Date.now() + ttlH * 3600 * 1000);
    await client.query(
      `insert into driver_sessions (trip_id, driver_id, token_hash, expires_at)
       values ($1::uuid, $2::uuid, $3, $4::timestamptz)`,
      [tripId, driverId, tokenHash, expiresAt.toISOString()],
    );
    driverUrl = conductorPublicUrl(frontend, plain);

    if (shouldInsertDriverOutbox(notifyDriver, phone)) {
      await client.query(
        `insert into outbox_notifications (trip_id, driver_id, channel, to_e164, payload, status, next_attempt_at)
         values ($1::uuid, $2::uuid, 'whatsapp', $3, $4::jsonb, 'pending', now())`,
        [
          tripId,
          driverId,
          phone,
          JSON.stringify({
            text: `Tu enlace de conductor BMC (válido hasta ${expiresAt.toISOString()}): ${driverUrl}`,
            trip_id: tripId,
            idempotency_key: `${idem}:wa`,
          }),
        ],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    return { ok: false, error: err instanceof Error ? err.message : String(err), code: err?.code };
  }
  client.release();

  const customer_links = [];
  try {
    await ensureCustomerTrackTable(pool);
    const ttlDays = 21;
    const expires = new Date(Date.now() + ttlDays * 86400_000);
    for (const stop of deliveryStops) {
      const snap = sanitizeSnapshot({
        quote_ref: stop.orderId || stop.cotizacionId || "",
        customer_display_name: stop.cliente || "",
        product_summary: stop.producto || stop.product_summary || "",
        pickup_label: info.pickup_label || "Carga BMC",
        pickup_scheduled_at: info.fecha || "",
        destination_label: stop.direccion || stop.cliente || "",
      });
      if (!snap.quote_ref && !snap.customer_display_name) continue;
      const { token, tokenHash } = mintTrackToken();
      await pool.query(
        `insert into customer_track_tokens
           (token_hash, trip_id, stop_id, quote_ref, public_snapshot, expires_at)
         values ($1, $2::uuid, $3::uuid, $4, $5::jsonb, $6)`,
        [tokenHash, tripId, stop.id, snap.quote_ref || null, JSON.stringify(snap), expires.toISOString()],
      );
      customer_links.push({
        stop_id: stop.id,
        cliente: stop.cliente || "",
        url: trackingPublicUrl(frontend, token),
        expires_at: expires.toISOString(),
      });
    }
  } catch {
    /* tokens optional if migration missing */
  }

  return {
    ok: true,
    trip_id: tripId,
    driver_id: driverId,
    driver_url: driverUrl,
    expires_at: expiresAt?.toISOString?.() || null,
    customer_links,
  };
}

export function isJoinSchemaMissing(err) {
  const msg = String(err?.error || err?.message || err || "");
  return err?.code === "42P01" || /trips|driver_sessions/i.test(msg);
}
