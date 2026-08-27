/**
 * T5–T7 shipped roster/assign/order-id path.
 * Run: node tests/choferRoster.test.js
 */
import assert from "node:assert/strict";
import { createTransportistaMemoryPool } from "../server/lib/transportistaMemoryPool.js";
import { ensureTransportistaSchema } from "../server/lib/transportistaSchema.js";
import {
  registerChofer,
  loginChofer,
  assignTripToChofer,
  listChoferInbox,
} from "../server/lib/choferRoster.js";
import { resolveDriverAuth, listTripsForDriverAuth } from "../server/lib/driverAuth.js";
import { lookupTrackByOrderId } from "../server/lib/orderIdLookup.js";
import { sanitizeSnapshot } from "../server/lib/customerTrack.js";

console.log("choferRoster+orderId");

const pool = createTransportistaMemoryPool();
await ensureTransportistaSchema(pool);

{
  const bad = await registerChofer(pool, { name: "X", password: "123" });
  assert.equal(bad.ok, false);
  const reg = await registerChofer(pool, {
    name: "Juan Pérez",
    email: "juan@bmc.uy",
    phone: "+598 99 123 456",
    password: "secreto1",
  });
  assert.equal(reg.ok, true);
  assert.ok(reg.chofer.chofer_id);
  assert.equal(reg.chofer.email, "juan@bmc.uy");
  assert.equal(reg.chofer.password_hash, undefined);
  const login = await loginChofer(pool, { email: "juan@bmc.uy", password: "secreto1" });
  assert.equal(login.ok, true);
  assert.ok(login.token.length >= 16);
  const no = await loginChofer(pool, { email: "juan@bmc.uy", password: "wrong" });
  assert.equal(no.ok, false);
  console.log("  ✓ HITL register + login email/phone password");

  const tripId = "11111111-1111-4111-8111-111111111111";
  await pool.query(
    `insert into trips (trip_id, status, plan_snapshot, closed_at)
     values ($1, $2, $3, $4)`,
    [tripId, "assigned", { reparto_no: "REP-1" }, null],
  );
  const asg = await assignTripToChofer(pool, { tripId, choferId: reg.chofer.chofer_id });
  assert.equal(asg.ok, true);
  const inbox = await listChoferInbox(pool, reg.chofer.chofer_id);
  assert.equal(inbox.ok, true);
  assert.equal(inbox.trips.length, 1);
  assert.equal(inbox.trips[0].trip_id, tripId);

  const authz = await resolveDriverAuth(pool, login.token);
  assert.equal(authz.ok, true);
  assert.equal(authz.kind, "chofer_session");
  const listed = await listTripsForDriverAuth(pool, authz);
  assert.equal(listed.ok, true);
  assert.equal(listed.trips.length, 1);
  assert.equal(listed.trips[0].trip_id, tripId);
  console.log("  ✓ assign confirmed trip → chofer inbox");
  console.log("  ✓ loginChofer bearer lists assigned trip on /api/driver/trips path");

  const missing = await assignTripToChofer(pool, {
    tripId: "99999999-9999-4999-8999-999999999999",
    choferId: reg.chofer.chofer_id,
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.error, "trip_not_found");
  console.log("  ✓ assign missing trip → trip_not_found");

  const { generateOpaqueToken, sha256Hex } = await import("../server/lib/driverToken.js");
  const { driverAuthOwnsTrip } = await import("../server/lib/driverAuth.js");
  const priorPlain = generateOpaqueToken();
  const priorDriver = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  await pool.query(
    `insert into driver_sessions (trip_id, driver_id, token_hash, expires_at)
     values ($1, $2, $3, $4)`,
    [tripId, priorDriver, sha256Hex(priorPlain), new Date(Date.now() + 86400_000).toISOString()],
  );
  const priorAuth = await resolveDriverAuth(pool, priorPlain);
  assert.equal(priorAuth.ok, true);
  assert.equal(await driverAuthOwnsTrip(pool, priorAuth, tripId), true);

  const reg2 = await registerChofer(pool, {
    name: "Otro",
    email: "otro@bmc.uy",
    phone: "099999999",
    password: "secreto2",
  });
  const reasg = await assignTripToChofer(pool, { tripId, choferId: reg2.chofer.chofer_id });
  assert.equal(reasg.ok, true);
  const priorAfter = await resolveDriverAuth(pool, priorPlain);
  assert.equal(priorAfter.ok, false, "prior magic-link must be revoked on reassignment");
  console.log("  ✓ reassignment revokes prior driver_sessions for the trip");
}

{
  const tripId = "22222222-2222-4222-8222-222222222222";
  await pool.query(
    `insert into trips (trip_id, status, plan_snapshot, closed_at)
     values ($1, $2, $3, $4)`,
    [tripId, "assigned", { reparto_no: "REP-2" }, null],
  );
  const expires = new Date(Date.now() + 86400_000).toISOString();
  const snap = sanitizeSnapshot({
    quote_ref: "BMC-2026-1048",
    customer_display_name: "Silva",
    driver_phone: "+59899111222",
    other_stop: "Secret other obra",
    destination_label: "Las Piedras",
  });
  await pool.query(
    `insert into customer_track_tokens
      (token_hash, trip_id, stop_id, quote_ref, public_snapshot, expires_at, revoked_at, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    ["hash1", tripId, null, "BMC-2026-1048", JSON.stringify(snap), expires, null, new Date().toISOString()],
  );
  const view = await lookupTrackByOrderId(pool, "BMC-2026-1048");
  assert.equal(view.ok, true);
  const blob = JSON.stringify(view);
  assert.equal(view.order.ref, "BMC-2026-1048");
  assert.ok(!blob.includes("59899111222"));
  assert.ok(!blob.includes("Secret other obra"));
  assert.ok(!blob.includes("token"));
  assert.equal(view.destination, "Las Piedras");
  console.log("  ✓ Order ID lookup uses sanitizer (no phone, no other stops)");
}

console.log("choferRoster+orderId OK");
