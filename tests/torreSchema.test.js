/**
 * Drive shipped ensureTransportistaSchema + loadTorreLive.
 * Run: node tests/torreSchema.test.js
 */
import assert from "node:assert/strict";
import { createTransportistaMemoryPool } from "../server/lib/transportistaMemoryPool.js";
import { ensureTransportistaSchema, TRANSPORTISTA_TABLES } from "../server/lib/transportistaSchema.js";
import { loadTorreLive } from "../server/lib/torreLive.js";

console.log("torreSchema");

{
  const pool = createTransportistaMemoryPool();
  let threw = false;
  try {
    await pool.query("select trip_id from trips");
  } catch (e) {
    threw = /relation "trips" does not exist/.test(String(e.message));
  }
  assert.equal(threw, true);
  const ensured = await ensureTransportistaSchema(pool);
  assert.equal(ensured.ok, true);
  for (const t of TRANSPORTISTA_TABLES) {
    assert.ok(pool.tables.has(t), `missing table ${t}`);
  }
  const sel = await pool.query("select trip_id from trips");
  assert.ok(Array.isArray(sel.rows));
  const live = await loadTorreLive(pool, { now: Date.parse("2026-08-27T15:00:00Z") });
  assert.equal(live.ok, true);
  assert.ok(Array.isArray(live.trips));
  assert.equal(live.trips.length, 0);
  assert.ok(!/relation "trips" does not exist/i.test(JSON.stringify(live)));
  console.log("  ✓ ensure then empty live is ok trips:[]");
}

{
  const pool = createTransportistaMemoryPool();
  const live = await loadTorreLive(pool);
  assert.equal(live.ok, true);
  assert.deepEqual(live.trips, []);
  console.log("  ✓ loadTorreLive self-heals schema before SELECT");
}

console.log("torreSchema OK");
