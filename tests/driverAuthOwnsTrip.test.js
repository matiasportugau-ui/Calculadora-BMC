/**
 * Trip-scoped ownership for driver PWA / chofer HITL.
 * Run: node tests/driverAuthOwnsTrip.test.js
 */
import assert from "node:assert/strict";
import { createTransportistaMemoryPool } from "../server/lib/transportistaMemoryPool.js";
import { ensureTransportistaSchema } from "../server/lib/transportistaSchema.js";
import { driverAuthOwnsTrip } from "../server/lib/driverAuth.js";

const tripA = "11111111-1111-4111-8111-111111111111";
const tripB = "22222222-2222-4222-8222-222222222222";
const choferA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const choferB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const pool = createTransportistaMemoryPool();
await ensureTransportistaSchema(pool);

await pool.query(
  `insert into trips (trip_id, status, plan_snapshot, closed_at, assigned_driver_id)
   values ($1, $2, $3, $4, $5)`,
  [tripA, "assigned", { reparto_no: "REP-A" }, null, choferA],
);
await pool.query(
  `insert into trips (trip_id, status, plan_snapshot, closed_at, assigned_driver_id)
   values ($1, $2, $3, $4, $5)`,
  [tripB, "assigned", { reparto_no: "REP-B" }, null, choferB],
);

{
  assert.equal(await driverAuthOwnsTrip(pool, { ok: false, error: "nope" }, tripA), false);
  assert.equal(await driverAuthOwnsTrip(pool, { ok: true, kind: "driver_session", trip_id: tripA }, ""), false);
  assert.equal(await driverAuthOwnsTrip(pool, { ok: true, kind: "driver_session", trip_id: tripA }, null), false);
  console.log("  ✓ fail-closed when auth is not ok or tripId is missing");
}

{
  const magicA = { ok: true, kind: "driver_session", trip_id: tripA, chofer_id: null };
  assert.equal(await driverAuthOwnsTrip(pool, magicA, tripA), true);
  assert.equal(await driverAuthOwnsTrip(pool, magicA, tripB), false, "magic-link A cannot own trip B");
  console.log("  ✓ driver_session is trip-id equality only");
}

{
  const chofer = { ok: true, kind: "chofer_session", trip_id: null, chofer_id: choferA };
  assert.equal(await driverAuthOwnsTrip(pool, chofer, tripA), true);
  assert.equal(await driverAuthOwnsTrip(pool, chofer, tripB), false, "chofer A cannot own chofer B trip");
  const other = { ok: true, kind: "chofer_session", trip_id: null, chofer_id: choferB };
  assert.equal(await driverAuthOwnsTrip(pool, other, tripB), true);
  assert.equal(await driverAuthOwnsTrip(pool, other, tripA), false);
  console.log("  ✓ chofer_session requires assigned_driver_id match");
}

{
  await pool.query(
    `insert into trips (trip_id, status, plan_snapshot, closed_at, assigned_driver_id)
     values ($1, $2, $3, $4, $5)`,
    ["33333333-3333-4333-8333-333333333333", "assigned", {}, null, choferA],
  );
  const chofer = { ok: true, kind: "chofer_session", trip_id: null, chofer_id: choferA };
  assert.equal(await driverAuthOwnsTrip(pool, chofer, "33333333-3333-4333-8333-333333333333"), true);
  console.log("  ✓ chofer owns each assigned trip independently");
}

console.log("driverAuthOwnsTrip.test.js: ok");
