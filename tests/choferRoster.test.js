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
  console.log("  ✓ assign confirmed trip → chofer inbox");
  console.log("  ✓ loginChofer bearer lists assigned trip on /api/driver/trips path");

  // Closed trip refreshed more recently than an older open assignment must not
  // win trips[0] — Driver UI only opens the first row.
  const openId = "33333333-3333-4333-8333-333333333333";
  const closedId = "44444444-4444-4444-8444-444444444444";
  const choferId = reg.chofer.chofer_id;
  // Prior REP-1 assignment is also closed (newer stamp) so only openId remains active.
  await pool.query(
    `insert into trips (trip_id, status, plan_snapshot, closed_at, updated_at, assigned_driver_id)
     values ($1, $2, $3, $4, $5, $6)`,
    [openId, "assigned", { reparto_no: "REP-OPEN" }, null, "2026-09-09T10:00:00.000Z", choferId],
  );
  await pool.query(
    `insert into trips (trip_id, status, plan_snapshot, closed_at, updated_at, assigned_driver_id)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      closedId,
      "closed",
      { reparto_no: "REP-CLOSED" },
      "2026-09-09T12:00:00.000Z",
      "2026-09-09T12:00:00.000Z",
      choferId,
    ],
  );
  // Simulate completing the first assigned trip after openId was already on the books.
  const prior = (await pool.query(`select * from trips where trip_id = $1`, [tripId])).rows[0];
  prior.status = "closed";
  prior.closed_at = "2026-09-09T13:00:00.000Z";
  prior.updated_at = "2026-09-09T13:00:00.000Z";
  const ranked = await listTripsForDriverAuth(pool, authz);
  assert.equal(ranked.ok, true);
  assert.equal(ranked.trips[0].trip_id, openId);
  assert.equal(ranked.trips[0].status, "assigned");
  assert.ok(ranked.trips.every((t, i) => i === 0 || t.status === "closed" || t.trip_id !== openId));
  const closedFirstIdx = ranked.trips.findIndex((t) => t.trip_id === closedId);
  const priorClosedIdx = ranked.trips.findIndex((t) => t.trip_id === tripId);
  assert.ok(closedFirstIdx > 0);
  assert.ok(priorClosedIdx > 0);
  const inboxRanked = await listChoferInbox(pool, choferId);
  assert.equal(inboxRanked.trips[0].trip_id, openId);
  console.log("  ✓ open assigned trip ranks above more recently updated closed trip");
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
