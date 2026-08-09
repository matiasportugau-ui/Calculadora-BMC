/**
 * Run: node tests/routeSuggest.test.js
 */
import assert from "node:assert/strict";
import {
  suggestRoute,
  orderedUniquePickupIds,
  haversineKm,
  reorderRouteLegs,
} from "../src/utils/logistica/routeSuggest.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("routeSuggest");

{
  assert.ok(haversineKm({ lat: -34.9, lng: -56.1 }, { lat: -34.91, lng: -56.11 }) > 0);
  assert.equal(haversineKm(null, { lat: 1, lng: 1 }), null);
  ok("haversineKm");
}

{
  const ids = orderedUniquePickupIds(
    [{ pickupPointId: "a" }, { pickupPointId: "b" }, { pickupPointId: "a" }],
    "",
  );
  assert.deepEqual(ids, ["a", "b"]);
  ok("unique pickups first-seen");
}

{
  const places = [
    { id: "base-1", label: "Base Cerro", geo: { lat: -34.88, lng: -56.25 }, kind: "base" },
    { id: "pickup-kingspan-bromyros", label: "Kingspan", geo: { lat: -34.7, lng: -56.2 } },
  ];
  const stops = [
    { id: "s1", cliente: "Petinho", orden: 1, pickupPointId: "pickup-kingspan-bromyros", geo: { lat: -34.9, lng: -56.1 } },
  ];
  const r = suggestRoute({
    basePointId: "base-1",
    places,
    stops,
    defaultPickupPointId: "pickup-kingspan-bromyros",
  });
  assert.ok(r.orderedLegs.length >= 3);
  assert.equal(r.orderedLegs[0].type, "base");
  assert.equal(r.orderedLegs[1].type, "pickup");
  assert.equal(r.orderedLegs[2].type, "delivery");
  ok("suggestRoute 1 pickup with geo");
}

{
  const places = [
    { id: "base-1", label: "Base" },
    { id: "p1", label: "P1" },
    { id: "p2", label: "P2" },
  ];
  const stops = [
    { id: "s1", cliente: "A", orden: 1, pickupPointId: "p1" },
    { id: "s2", cliente: "B", orden: 2, pickupPointId: "p2" },
  ];
  const r = suggestRoute({ basePointId: "base-1", places, stops });
  const types = r.orderedLegs.map((l) => l.type);
  assert.deepEqual(types, ["base", "pickup", "pickup", "delivery", "delivery"]);
  assert.ok(r.missingGeoCount >= 1);
  ok("suggestRoute 2 pickups missing geo");
}

{
  const legs = [{ label: "a" }, { label: "b" }, { label: "c" }];
  assert.deepEqual(
    reorderRouteLegs(legs, 2, 0).map((l) => l.label),
    ["c", "a", "b"],
  );
  ok("reorderRouteLegs");
}

console.log(`routeSuggest: ${passed} passed`);
