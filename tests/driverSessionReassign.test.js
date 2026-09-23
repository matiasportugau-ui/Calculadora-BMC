/**
 * Regression: reassignment must revoke the previous driver's magic-link and
 * deny list/mutate via the stale Bearer (trip_id-only ownership was insufficient).
 * Run: node tests/driverSessionReassign.test.js
 */
import assert from "node:assert/strict";
import { createTransportistaMemoryPool } from "../server/lib/transportistaMemoryPool.js";
import { ensureTransportistaSchema } from "../server/lib/transportistaSchema.js";
import { registerChofer, assignTripToChofer } from "../server/lib/choferRoster.js";
import {
  resolveDriverAuth,
  listTripsForDriverAuth,
  driverAuthOwnsTrip,
} from "../server/lib/driverAuth.js";

console.log("driverSessionReassign");

function tokenFromDriverUrl(url) {
  const u = new URL(String(url || ""), "https://example.invalid");
  const t = u.searchParams.get("t");
  assert.ok(t && t.length >= 8, "driver_url must include ?t=");
  return t;
}

const pool = createTransportistaMemoryPool();
await ensureTransportistaSchema(pool);

const driverA = await registerChofer(pool, {
  name: "Chofer A",
  email: "a@bmc.uy",
  phone: "+59899111111",
  password: "secreto1",
});
const driverB = await registerChofer(pool, {
  name: "Chofer B",
  email: "b@bmc.uy",
  phone: "+59899222222",
  password: "secreto1",
});
assert.equal(driverA.ok, true);
assert.equal(driverB.ok, true);

const tripId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
await pool.query(
  `insert into trips (trip_id, status, plan_snapshot, closed_at)
   values ($1, $2, $3, $4)`,
  [tripId, "draft", { reparto_no: "REP-REASSIGN" }, null],
);

const first = await assignTripToChofer(pool, {
  tripId,
  choferId: driverA.chofer.chofer_id,
});
assert.equal(first.ok, true);
const tokenA = tokenFromDriverUrl(first.driver_url);
const authA1 = await resolveDriverAuth(pool, tokenA);
assert.equal(authA1.ok, true);
assert.equal(authA1.kind, "driver_session");
assert.equal(await driverAuthOwnsTrip(pool, authA1, tripId), true);
const listedA1 = await listTripsForDriverAuth(pool, authA1);
assert.equal(listedA1.trips.length, 1);

const second = await assignTripToChofer(pool, {
  tripId,
  choferId: driverB.chofer.chofer_id,
});
assert.equal(second.ok, true);
const tokenB = tokenFromDriverUrl(second.driver_url);
assert.notEqual(tokenA, tokenB);

const authA2 = await resolveDriverAuth(pool, tokenA);
assert.equal(authA2.ok, false, "prior magic-link must be revoked on reassign");

const authB = await resolveDriverAuth(pool, tokenB);
assert.equal(authB.ok, true);
assert.equal(await driverAuthOwnsTrip(pool, authB, tripId), true);
const listedB = await listTripsForDriverAuth(pool, authB);
assert.equal(listedB.trips.length, 1);

// Defense in depth: even if a stale session row were left unrevoked, ownership
// still requires assigned_driver_id === session.driver_id.
const expires = new Date(Date.now() + 86400_000).toISOString();
await pool.query(
  `insert into driver_sessions (trip_id, driver_id, token_hash, expires_at)
   values ($1::uuid, $2::uuid, $3, $4)`,
  [tripId, driverA.chofer.chofer_id, "stale-hash-for-ownership", expires],
);
const staleAuth = {
  ok: true,
  kind: "driver_session",
  trip_id: tripId,
  driver_id: driverA.chofer.chofer_id,
  chofer_id: null,
};
assert.equal(await driverAuthOwnsTrip(pool, staleAuth, tripId), false);
const listedStale = await listTripsForDriverAuth(pool, staleAuth);
assert.equal(listedStale.trips.length, 0);

console.log("driverSessionReassign: OK");
