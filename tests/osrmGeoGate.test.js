// OSRM coordinate gates + attach fallback. Complementary to orphan osrmPolyline.test.js
// (do not wire the orphan — this file pins invalid geo / NaN km the orphan skips).
// Run: node tests/osrmGeoGate.test.js

import assert from "node:assert/strict";
import {
  osrmCoordinatesFromLegs,
  attachOsrmToRoute,
} from "../src/utils/logistica/osrmPolyline.js";

assert.deepEqual(osrmCoordinatesFromLegs(null), []);
assert.deepEqual(osrmCoordinatesFromLegs(undefined), []);

assert.deepEqual(
  osrmCoordinatesFromLegs([
    { geo: { lat: -34.9, lng: -56.16 } },
    { geo: { lat: 91, lng: -56 } },
    { geo: { lat: -34.9, lng: 181 } },
    { geo: { lat: "x", lng: -56 } },
    { geo: { lat: -34.91, lng: -54.95 } },
    { geo: { lat: -90, lng: -180 } },
  ]),
  [
    [-56.16, -34.9],
    [-54.95, -34.91],
    [-180, -90],
  ],
  "skip out-of-range / NaN; keep poles and valid Uruguay pins",
);

const base = Object.freeze({
  orderedLegs: Object.freeze([{ refId: "a" }]),
  suggestionSource: "haversine",
  totalKm: 12.5,
});

const nanKm = attachOsrmToRoute(base, {
  provider: "osrm",
  geometry: "_p~iF~ps|U",
  totalKm: Number.NaN,
  totalDurationS: "nope",
});
assert.equal(nanKm.suggestionSource, "osrm");
assert.equal(nanKm.totalKm, 12.5, "NaN OSRM km must not wipe billed haversine km");
assert.equal(nanKm.durationS, null);
assert.equal(base.totalKm, 12.5, "input route is not mutated");
assert.equal(base.suggestionSource, "haversine");

const noGeom = attachOsrmToRoute(base, { provider: "osrm", geometry: "" });
assert.equal(noGeom.suggestionSource, "haversine");
assert.equal(noGeom.geometry, null);

const fallback = attachOsrmToRoute(base, { provider: "haversine_fallback" });
assert.equal(fallback.suggestionSource, "haversine");
assert.equal(fallback.geometry, null);

const empty = attachOsrmToRoute(null, null);
assert.deepEqual(empty.orderedLegs, []);
assert.equal(empty.suggestionSource, "haversine");
assert.equal(empty.geometry, null);

console.log("osrmGeoGate.test.js ok");
