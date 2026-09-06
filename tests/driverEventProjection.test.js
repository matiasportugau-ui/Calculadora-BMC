/**
 * Driver event → reparto/trip projection must run on idempotent replay
 * and delivery_completed projection failures must surface (outbox retry).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  afterDriverEventRecorded,
  projectRepartoFromDriverEvent,
  projectionMustSucceed,
} from "../server/lib/driverEventProjection.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("driverEventProjection");

assert.equal(projectionMustSucceed("delivery_completed"), true);
assert.equal(projectionMustSucceed("factory_arrived"), false);
assert.equal(projectionMustSucceed("location_ping"), false);
console.log("  ✓ delivery_completed projection is mandatory");

{
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params });
      if (/select plan_snapshot/i.test(sql)) {
        return {
          rows: [
            {
              plan_snapshot: {
                reparto_id: "rep-1",
                stops: [{ id: "stop-a" }],
              },
            },
          ],
        };
      }
      if (/event_type = 'delivery_completed'/i.test(sql)) {
        return { rows: [{ stop_id: "stop-a" }] };
      }
      return { rows: [], rowCount: 1 };
    },
  };
  await projectRepartoFromDriverEvent(pool, "trip-1", "delivery_completed");
  const closes = calls.filter((c) => /status = 'closed'/i.test(c.sql) || /status = 'cerrado'/i.test(c.sql));
  assert.equal(closes.length, 2, "reparto cerrado + trip closed");
  console.log("  ✓ all deliveries → cerrado + closed");
}

{
  let projected = 0;
  const pool = {
    async query(sql) {
      if (/select plan_snapshot/i.test(sql)) {
        projected += 1;
        return { rows: [{ plan_snapshot: { reparto_id: "rep-1", stops: [] } }] };
      }
      return { rows: [], rowCount: 1 };
    },
  };
  const a = await afterDriverEventRecorded(pool, "trip-1", "delivery_completed");
  assert.equal(a.projected, true);
  assert.equal(projected, 1);
  // Idempotent replay path: call again (simulates 23505 then project)
  const b = await afterDriverEventRecorded(pool, "trip-1", "delivery_completed");
  assert.equal(b.projected, true);
  assert.equal(projected, 2);
  console.log("  ✓ afterDriverEventRecorded runs projection on replay");
}

{
  const pool = {
    async query() {
      const err = new Error("connection reset");
      err.code = "ECONNRESET";
      throw err;
    },
  };
  await assert.rejects(
    () => afterDriverEventRecorded(pool, "trip-1", "delivery_completed"),
    /connection reset/,
  );
  const soft = await afterDriverEventRecorded(pool, "trip-1", "factory_arrived");
  assert.equal(soft.projected, false);
  assert.ok(soft.error);
  console.log("  ✓ delivery_completed surfaces projection errors; factory is soft");
}

{
  const skip = await afterDriverEventRecorded({ query: async () => ({ rows: [] }) }, "t", "location_ping");
  assert.equal(skip.projected, false);
  console.log("  ✓ location_ping skips projection");
}

{
  const routes = readFileSync(join(root, "server/routes/transportista.js"), "utf8");
  assert.ok(routes.includes("afterDriverEventRecorded"));
  const eventsStart = routes.indexOf('"/driver/events"');
  assert.ok(eventsStart > 0);
  const eventsEnd = routes.indexOf('"/driver/evidence/upload-url"', eventsStart);
  assert.ok(eventsEnd > eventsStart);
  const eventsBlock = routes.slice(eventsStart, eventsEnd);
  assert.ok(eventsBlock.includes("idempotent = true"));
  assert.ok(eventsBlock.includes("afterDriverEventRecorded"));
  assert.ok(
    !/if\s*\(\s*e\.code\s*===\s*"23505"\s*\)\s*\{\s*return\s+res\.json/.test(eventsBlock),
    "events 23505 must not return before projection",
  );
  assert.ok(
    !/if\s*\(\s*e\.code\s*===\s*"23505"\s*\)\s*return\s+res\.json/.test(eventsBlock),
    "events 23505 must not early-return",
  );
  console.log("  ✓ POST /driver/events projects after 23505 (no early return)");
}

console.log("driverEventProjection OK");
