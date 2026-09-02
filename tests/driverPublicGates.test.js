/**
 * Driver / public track fail-closed: no pool, blank bearer, blank Order ID.
 * Complementary to choferRoster / logisticaE2e happy paths.
 * Run: node tests/driverPublicGates.test.js
 */
import assert from "node:assert/strict";
import { createTransportistaMemoryPool } from "../server/lib/transportistaMemoryPool.js";
import { ensureTransportistaSchema } from "../server/lib/transportistaSchema.js";
import { resolveDriverAuth, listTripsForDriverAuth } from "../server/lib/driverAuth.js";
import { lookupTrackByOrderId } from "../server/lib/orderIdLookup.js";

console.log("driverPublicGates");

{
  const noPool = await resolveDriverAuth(null, "tok");
  assert.equal(noPool.ok, false);
  assert.equal(noPool.error, "no_pool");
  console.log("  ✓ resolveDriverAuth no_pool");
}

const pool = createTransportistaMemoryPool();
await ensureTransportistaSchema(pool);

{
  const missing = await resolveDriverAuth(pool, "");
  assert.equal(missing.ok, false);
  assert.match(String(missing.error), /Missing Bearer/);
  const ws = await resolveDriverAuth(pool, "   ");
  assert.equal(ws.ok, false);
  assert.match(String(ws.error), /Missing Bearer/);
  const bad = await resolveDriverAuth(pool, "not-a-session");
  assert.equal(bad.ok, false);
  assert.match(String(bad.error), /Invalid or expired/);
  console.log("  ✓ empty / whitespace / unknown bearer rejected");
}

{
  const listed = await listTripsForDriverAuth(pool, { ok: false, error: "Unauthorized" });
  assert.equal(listed.ok, false);
  assert.deepEqual(listed.trips, []);
  console.log("  ✓ unauthorized listTripsForDriverAuth returns no trips");
}

{
  const noPool = await lookupTrackByOrderId(null, "BMC-1");
  assert.equal(noPool.ok, false);
  assert.equal(noPool.error, "no_pool");
  const empty = await lookupTrackByOrderId(pool, "");
  assert.equal(empty.ok, false);
  assert.equal(empty.error, "missing_order_id");
  const ws = await lookupTrackByOrderId(pool, "   ");
  assert.equal(ws.ok, false);
  assert.equal(ws.error, "missing_order_id");
  const miss = await lookupTrackByOrderId(pool, "BMC-NO-SUCH");
  assert.equal(miss.ok, false);
  assert.equal(miss.error, "not_found");
  console.log("  ✓ Order ID lookup fail-closed (no pool / blank / unknown)");
}

console.log("driverPublicGates.test.js ok");
