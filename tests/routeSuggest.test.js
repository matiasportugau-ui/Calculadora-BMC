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
  assert.deepEqual(types, ["base", "pickup", "delivery", "pickup", "delivery"]);
  assert.ok(r.missingGeoCount >= 1);
  ok("suggestRoute 2 pickups grouped by plant");
}

{
  const legs = [{ label: "a" }, { label: "b" }, { label: "c" }];
  assert.deepEqual(
    reorderRouteLegs(legs, 2, 0).map((l) => l.label),
    ["c", "a", "b"],
  );
  ok("reorderRouteLegs");
}

{
  const places = [
    { id: "pickup-kingspan-bromyros", label: "Kingspan", addressText: "Camino San Juan S/N" },
  ];
  const stops = [
    {
      id: "s-alvaro",
      cliente: "Alvaro Gonzalez",
      orden: 1,
      direccion: "Ciudad de Maldonado (falta calle/nro)",
      pickupPointId: "pickup-kingspan-bromyros",
    },
    {
      id: "s-aledma",
      cliente: "ALEDMA S.A",
      orden: 2,
      direccion: "Juan Paullier 1625, Montevideo",
      pickupPointId: "pickup-kingspan-bromyros",
      entregaModo: "planta",
    },
  ];
  const r = suggestRoute({
    places,
    stops,
    defaultPickupPointId: "pickup-kingspan-bromyros",
  });
  const types = r.orderedLegs.map((l) => l.type);
  assert.ok(types.includes("pickup"));
  assert.ok(types.includes("delivery"));
  assert.equal(r.orderedLegs.filter((l) => l.type === "delivery").length, 1);
  assert.equal(r.orderedLegs.find((l) => l.type === "delivery").label, "Alvaro Gonzalez");
  assert.ok(r.orderedLegs.every((l) => l.geo), "gazetteer fills pins");
  ok("gazetteer pins + ALEDMA planta skips delivery");
}

{
  const places = [
    { id: "pickup-kingspan-bromyros", label: "Kingspan", addressText: "Camino San Juan S/N" },
  ];
  const stops = [
    {
      id: "s-alvaro",
      cliente: "Alvaro Gonzalez",
      orden: 1,
      direccion: "Ciudad de Maldonado",
      pickupPointId: "pickup-kingspan-bromyros",
    },
    {
      id: "s-aledma",
      cliente: "ALEDMA S.A",
      orden: 2,
      direccion: "Juan Paullier 1625, Montevideo",
      pickupPointId: "pickup-kingspan-bromyros",
      entregaModo: "depo",
    },
  ];
  const r = suggestRoute({
    places,
    stops,
    defaultPickupPointId: "pickup-kingspan-bromyros",
  });
  const deliveries = r.orderedLegs.filter((l) => l.type === "delivery");
  const depot = r.orderedLegs.filter((l) => l.type === "depot");
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].label, "Alvaro Gonzalez");
  assert.equal(depot.length, 1);
  assert.equal(depot[0].label, "BMC URUGUAY");
  assert.equal(depot[0].mapUrl, "https://maps.app.goo.gl/H4JrCnTgmke7ZRReA");
  assert.equal(depot[0].geo.lat, -34.9053458);
  assert.equal(depot[0].geo.lng, -54.928693);
  assert.deepEqual(depot[0].stopIds, ["s-aledma"]);
  ok("depo skip obra delivery + drop at BMC depot");
}

{
  const places = [
    { id: "pickup-kingspan-bromyros", label: "Kingspan", geo: { lat: -34.815, lng: -56.024 } },
    { id: "pickup-montfrio", label: "Montfrío", geo: { lat: -34.85, lng: -56.1 } },
  ];
  const stops = [
    { id: "s-alvaro", cliente: "Alvaro", orden: 1, pickupPointId: "pickup-kingspan-bromyros", geo: { lat: -34.9, lng: -54.94 } },
    { id: "s-abril", cliente: "Abril", orden: 2, pickupPointId: "pickup-montfrio", geo: { lat: -34.88, lng: -55.04 } },
  ];
  const r = suggestRoute({ places, stops });
  const labels = r.orderedLegs.map((l) => `${l.type}:${l.label}`);
  assert.deepEqual(labels, [
    "pickup:Kingspan",
    "delivery:Alvaro",
    "pickup:Montfrío",
    "delivery:Abril",
  ]);
  ok("multi-plant vueltas");
}

console.log(`routeSuggest: ${passed} passed`);
