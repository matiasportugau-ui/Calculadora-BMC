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
import { resolveDriverAuth, listTripsForDriverAuth, driverAuthOwnsTrip } from "../server/lib/driverAuth.js";
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
  assert.ok(String(asg.driver_url).includes("/conductor?t="));
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
  assert.equal(await driverAuthOwnsTrip(pool, authz, tripId), true, "chofer owns assigned trip");
  assert.equal(
    await driverAuthOwnsTrip(pool, authz, "33333333-3333-4333-8333-333333333333"),
    false,
    "chofer does not own a stranger trip",
  );
  assert.equal(await driverAuthOwnsTrip(pool, { ok: false }, tripId), false);
  console.log("  ✓ assign confirmed trip → chofer inbox");
  console.log("  ✓ loginChofer bearer lists assigned trip on /api/driver/trips path");
  console.log("  ✓ driverAuthOwnsTrip is assigned-only");
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

  const noPool = await lookupTrackByOrderId(null, "BMC-2026-1048");
  assert.equal(noPool.ok, false);
  assert.equal(noPool.error, "no_pool");
  const missing = await lookupTrackByOrderId(pool, "   ");
  assert.equal(missing.ok, false);
  assert.equal(missing.error, "missing_order_id");
  const unknown = await lookupTrackByOrderId(pool, "BMC-NO-SUCH");
  assert.equal(unknown.ok, false);
  assert.equal(unknown.error, "not_found");
  console.log("  ✓ Order ID lookup fail-closed on missing pool / blank / unknown");
}

console.log("choferRoster+orderId OK");
