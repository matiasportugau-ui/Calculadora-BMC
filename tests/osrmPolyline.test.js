/**
 * Run: node tests/osrmPolyline.test.js
 */
import assert from "node:assert/strict";
import {
  decodePolyline,
  osrmCoordinatesFromLegs,
  attachOsrmToRoute,
} from "../src/utils/logistica/osrmPolyline.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("osrmPolyline");

{
  // Google encoded polyline example (precision 5)
  const pts = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  assert.equal(pts.length, 3);
  assert.ok(Math.abs(pts[0][0] - 38.5) < 1e-4);
  assert.ok(Math.abs(pts[0][1] - -120.2) < 1e-4);
  assert.ok(Math.abs(pts[1][0] - 40.7) < 1e-4);
  assert.ok(Math.abs(pts[2][0] - 43.252) < 1e-3);
  ok("decodePolyline google fixture");
}

{
  assert.deepEqual(decodePolyline(""), []);
  assert.deepEqual(decodePolyline(null), []);
  ok("decodePolyline empty");
}

{
  const coords = osrmCoordinatesFromLegs([
    { geo: { lat: -34.9, lng: -56.16 } },
    { geo: null },
    { geo: { lat: -34.91, lng: -54.95 } },
    { label: "no geo" },
  ]);
  assert.deepEqual(coords, [
    [-56.16, -34.9],
    [-54.95, -34.91],
  ]);
  ok("osrmCoordinatesFromLegs skips missing geo");
}

{
  const base = { orderedLegs: [{ refId: "a" }], suggestionSource: "haversine", totalKm: 10 };
  const osrm = attachOsrmToRoute(base, {
    provider: "osrm",
    geometry: "_p~iF~ps|U",
    totalKm: 188.4,
    totalDurationS: 9000,
  });
  assert.equal(osrm.suggestionSource, "osrm");
  assert.equal(osrm.geometry, "_p~iF~ps|U");
  assert.equal(osrm.totalKm, 188.4);
  const air = attachOsrmToRoute(base, { provider: "haversine_fallback" });
  assert.equal(air.suggestionSource, "haversine");
  assert.equal(air.geometry, null);
  ok("attachOsrmToRoute osrm vs fallback");
}

console.log(`osrmPolyline: ${passed} passed`);
