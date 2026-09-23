/**
 * Permission gate for driver GPS, evidence, and trip reads.
 * Run: node tests/driverAuthOwnsTrip.test.js
 *
 * Magic-link sessions own only the trip stamped on the session.
 * Chofer sessions own only trips assigned to chofer_id (not driver_id).
 */
import assert from "node:assert/strict";
import { createTransportistaMemoryPool } from "../server/lib/transportistaMemoryPool.js";
import { ensureTransportistaSchema } from "../server/lib/transportistaSchema.js";
import { driverAuthOwnsTrip } from "../server/lib/driverAuth.js";

const throwing = {
  async query() {
    throw new Error("driver_session must not query trips");
  },
};

const magic = {
  ok: true,
  kind: "driver_session",
  trip_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab",
  driver_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  chofer_id: null,
};

assert.equal(await driverAuthOwnsTrip(throwing, magic, magic.trip_id), true);
assert.equal(
  await driverAuthOwnsTrip(throwing, magic, "22222222-2222-4222-8222-222222222222"),
  false,
);
assert.equal(await driverAuthOwnsTrip(throwing, magic, String(magic.trip_id)), true);
assert.equal(await driverAuthOwnsTrip(throwing, magic, magic.trip_id.toUpperCase()), false);
assert.equal(await driverAuthOwnsTrip(throwing, { ok: false, error: "Invalid or expired session" }, magic.trip_id), false);
assert.equal(await driverAuthOwnsTrip(throwing, null, magic.trip_id), false);
assert.equal(await driverAuthOwnsTrip(throwing, magic, ""), false);
assert.equal(await driverAuthOwnsTrip(throwing, magic, null), false);

const pool = createTransportistaMemoryPool();
await ensureTransportistaSchema(pool);

const choferA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const choferB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const tripA = "11111111-1111-4111-8111-111111111111";
const tripB = "22222222-2222-4222-8222-222222222222";
const tripOpen = "33333333-3333-4333-8333-333333333333";

await pool.query(
  `insert into trips (trip_id, status, plan_snapshot, assigned_driver_id) values ($1,$2,$3,$4)`,
  [tripA, "assigned", {}, choferA],
);
await pool.query(
  `insert into trips (trip_id, status, plan_snapshot, assigned_driver_id) values ($1,$2,$3,$4)`,
  [tripB, "assigned", {}, choferB],
);
await pool.query(
  `insert into trips (trip_id, status, plan_snapshot) values ($1,$2,$3)`,
  [tripOpen, "draft", {}],
);

const chofer = {
  ok: true,
  kind: "chofer_session",
  trip_id: null,
  driver_id: choferA,
  chofer_id: choferA,
};

assert.equal(await driverAuthOwnsTrip(pool, chofer, tripA), true);
assert.equal(await driverAuthOwnsTrip(pool, chofer, tripB), false);
assert.equal(await driverAuthOwnsTrip(pool, chofer, tripOpen), false);

const driverIdOnly = { ...chofer, chofer_id: null };
assert.equal(await driverAuthOwnsTrip(pool, driverIdOnly, tripA), false);

console.log("driverAuthOwnsTrip.test.js: ok");
