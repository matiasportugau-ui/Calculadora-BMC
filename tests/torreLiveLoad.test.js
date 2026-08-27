// loadTorreLive + GET /api/torre auth — #1129 live board.
// Mock pool only; does not pin unbounded event SQL (open #1130).
// Run: node tests/torreLiveLoad.test.js

import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { loadTorreLive } from "../server/lib/torreLive.js";
import createTorreRouter from "../server/routes/torre.js";

console.log("torreLiveLoad");

{
  const out = await loadTorreLive(null);
  assert.equal(out.ok, false);
  assert.equal(out.error, "no_pool");
  console.log("  ✓ no pool → no_pool");
}

{
  let eventCalls = 0;
  const pool = {
    async query(sql) {
      if (/from\s+trip_events/i.test(sql)) {
        eventCalls += 1;
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
  const out = await loadTorreLive(pool, { now: Date.parse("2026-08-27T15:00:00Z") });
  assert.equal(out.ok, true);
  assert.equal(out.trips.length, 0);
  assert.equal(eventCalls, 0);
  assert.equal(out.generated_at, "2026-08-27T15:00:00.000Z");
  console.log("  ✓ empty trips skip events query");
}

{
  const now = Date.parse("2026-08-27T15:00:00Z");
  const pool = {
    async query(sql) {
      if (/from\s+trips/i.test(sql)) {
        return {
          rows: [
            {
              trip_id: "11111111-1111-4111-8111-111111111111",
              status: "assigned",
              assigned_phone_e164: "+59899123456",
              plan_snapshot: { reparto_no: "REP-9", transportista: "Juan", stops: [{}, {}] },
            },
          ],
        };
      }
      return {
        rows: [
          {
            trip_id: "11111111-1111-4111-8111-111111111111",
            event_type: "location_ping",
            geo_lat: -34.9,
            geo_lng: -56.16,
            at_server: "2026-08-27T14:59:30Z",
          },
          {
            trip_id: "11111111-1111-4111-8111-111111111111",
            event_type: "factory_departed",
            at_server: "2026-08-27T14:50:00Z",
          },
        ],
      };
    },
  };
  const out = await loadTorreLive(pool, { now });
  assert.equal(out.ok, true);
  assert.equal(out.trips.length, 1);
  assert.equal(out.trips[0].reparto_no, "REP-9");
  assert.equal(out.trips[0].phone_tail, "3456");
  assert.equal(out.trips[0].online, true);
  const blob = JSON.stringify(out);
  assert.ok(!blob.includes("99123456"), "full phone never leaves the loader");
  assert.ok(!blob.includes("token"), "no trip token in live payload");
  console.log("  ✓ groups events + phone tail only");
}

{
  const TOKEN = "torre-live-test-token";
  const app = express();
  app.use(express.json());
  app.use("/api", createTorreRouter({ apiAuthToken: TOKEN, databaseUrl: "" }));
  const server = await new Promise((resolve, reject) => {
    const s = http.createServer(app);
    s.on("error", reject);
    s.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${base}/api/torre/health`);
  const healthJson = await health.json();
  assert.equal(health.status, 200);
  assert.equal(healthJson.ok, true);
  assert.equal(healthJson.db, false);

  const anon = await fetch(`${base}/api/torre/live`);
  assert.equal(anon.status, 401);

  const authed = await fetch(`${base}/api/torre/live`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const authedJson = await authed.json();
  assert.equal(authed.status, 503);
  assert.equal(authedJson.ok, false);

  const noCfgApp = express();
  noCfgApp.use("/api", createTorreRouter({ apiAuthToken: "", databaseUrl: "" }));
  const noCfgServer = await new Promise((resolve, reject) => {
    const s = http.createServer(noCfgApp);
    s.on("error", reject);
    s.listen(0, () => resolve(s));
  });
  const noCfg = await fetch(`http://127.0.0.1:${noCfgServer.address().port}/api/torre/live`);
  assert.equal(noCfg.status, 503);

  server.close();
  noCfgServer.close();
  console.log("  ✓ /torre/live auth + missing token/db");
}

console.log("torreLiveLoad OK");
