/**
 * Trip chooser edges that scoreTripPlan-only tests do not reach.
 * Run: node tests/tripPlanChooserGates.test.js
 *
 * Pins: Maldonado is checked before Montevideo; Paullier in the client name
 * is west; plant skips phone and street blocks; depot skips only the street
 * block; city-only obra streets block;
 * a missing carrier does not block; mixed east/west stays a warning and the
 * winner is west-then-east / balanced; an empty stop list is status ok.
 */
import assert from "node:assert/strict";
import {
  chooseTripPlan,
  deliveryCluster,
  buildRouteCandidates,
} from "../src/utils/logistica/tripPlanChooser.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("tripPlanChooserGates");

assert.equal(deliveryCluster({ zona: "Maldónado" }), "east");
assert.equal(deliveryCluster({ zona: "PUNTA DEL ESTE" }), "east");
assert.equal(deliveryCluster({ direccion: "Chacras del Pinar" }), "east");
assert.equal(deliveryCluster({ zona: "maldonado montevideo" }), "east");
assert.equal(deliveryCluster({ cliente: "Taller Paullier", zona: "Canelones" }), "west");
assert.equal(deliveryCluster({ zona: "Canelones" }), "");
assert.equal(deliveryCluster(null), "");
ok("east wins over a later Montevideo token; Paullier in the name is west");

const places = [
  { id: "base-1", label: "Base Cerro", geo: { lat: -34.88, lng: -56.25 } },
  { id: "pickup-kingspan-bromyros", label: "Kingspan", geo: { lat: -34.7, lng: -56.2 } },
];
const info = { transportista: "Juan ABC1234", basePointId: "base-1" };
const wizard = { defaultPickupPointId: "pickup-kingspan-bromyros", singlePickup: true };

function stop(over = {}) {
  return {
    id: "s1",
    orden: 1,
    cliente: "Petinho",
    telefono: "099148920",
    direccion: "Juan Paullier 1625",
    zona: "Montevideo",
    geo: { lat: -34.9, lng: -56.16 },
    paneles: [{ tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 2 }],
    ...over,
  };
}

{
  const blocked = chooseTripPlan({
    info,
    wizard,
    places,
    stops: [stop({ telefono: "099 148 9" })],
    truckL: 12,
  });
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.cabe, false);
  assert.deepEqual(blocked.blocks.map((b) => b.id), ["tel-s1"]);
  assert.match(blocked.why, /^Falta Petinho: falta teléfono/);
  ok("7-digit phone blocks and the why names the client");
}

{
  const plan = chooseTripPlan({
    info,
    wizard,
    places,
    stops: [stop({ telefono: "099 148 92" })],
    truckL: 12,
  });
  assert.equal(plan.status, "ok");
  assert.equal(plan.cabe, true);
  assert.equal(plan.strategy, "doorPriority");
  assert.equal(plan.roadUnverified, true);
  assert.equal(plan.reliability, 85);
  assert.deepEqual(plan.stopOrder, ["s1"]);
  assert.equal(
    plan.why,
    "Una propuesta: ~43 km (aire), acceso rápido (última entrega en puerta).",
  );
  ok("8-digit phone with spaces quotes ~43 km by air");
}

{
  const plant = chooseTripPlan({
    info,
    wizard,
    places,
    stops: [stop({ entregaModo: "planta", telefono: "12", direccion: "Maldonado" })],
    truckL: 12,
  });
  assert.equal(plant.status, "ok");
  assert.deepEqual(plant.blocks, []);
  ok("plant pickup does not block on a short phone or a city-only address");
}

{
  const depot = chooseTripPlan({
    info,
    wizard,
    places,
    stops: [stop({ entregaModo: "deposito", direccion: "Maldonado" })],
    truckL: 12,
  });
  assert.equal(depot.status, "ok");
  assert.equal(depot.cabe, true);
  const depotNoPhone = chooseTripPlan({
    info,
    wizard,
    places,
    stops: [stop({ entregaModo: "deposito", direccion: "Maldonado", telefono: "" })],
    truckL: 12,
  });
  assert.equal(depotNoPhone.status, "blocked");
  assert.deepEqual(depotNoPhone.blocks.map((b) => b.id), ["tel-s1"]);
  ok("depot skips the street block and still blocks a missing phone");
}

{
  const city = chooseTripPlan({
    info,
    wizard,
    places,
    stops: [stop({ direccion: "Montevideo" })],
    truckL: 12,
  });
  assert.equal(city.status, "blocked");
  assert.deepEqual(city.blocks.map((b) => b.id), ["street-s1"]);
  ok("city-only obra address blocks");
}

{
  const noCarrier = chooseTripPlan({
    info: { basePointId: "base-1" },
    wizard,
    places,
    stops: [stop()],
    truckL: 12,
  });
  assert.equal(noCarrier.status, "ok");
  assert.equal(noCarrier.blocks.length, 0);
  ok("missing transportista stays a warning");
}

const east = stop({
  id: "e",
  orden: 1,
  zona: "Maldonado",
  cliente: "Este",
  direccion: "Calle Cuba 120",
  geo: { lat: -34.91, lng: -54.96 },
});
const west = stop({ id: "w", orden: 2, zona: "Montevideo", cliente: "Oeste" });

{
  const cands = buildRouteCandidates({ info, wizard, places, stops: [east, west] });
  assert.deepEqual(
    cands.map((c) => `${c.id}:${c.stopOrder.join(">")}`),
    ["current:e>w", "west-then-east:w>e"],
  );
  ok("east-first current dedupes the east-then-west candidate");
}

{
  const westFirst = stop({ id: "w", orden: 1 });
  const eastSecond = stop({
    id: "e",
    orden: 2,
    zona: "Maldonado",
    cliente: "Este",
    direccion: "Calle Cuba 120",
    geo: { lat: -34.91, lng: -54.96 },
  });
  const cands = buildRouteCandidates({
    info,
    wizard,
    places,
    stops: [westFirst, eastSecond],
  });
  assert.deepEqual(
    cands.map((c) => c.id),
    ["current", "east-then-west"],
  );
  ok("west-first current keeps the east-then-west variant");
}

{
  const mix = chooseTripPlan({
    info,
    wizard,
    places,
    stops: [east, west],
    truckL: 13,
  });
  assert.equal(mix.status, "ok");
  assert.deepEqual(mix.blocks, []);
  assert.equal(mix.strategy, "balanced");
  assert.deepEqual(mix.stopOrder, ["w", "e"]);
  assert.ok(mix.warnings.some((w) => /este \(Maldonado\) y oeste/.test(w)));
  ok("mixed coast is a warning and the winner is west then east");
}

{
  const only = buildRouteCandidates({ info, wizard, places, stops: [stop()] });
  assert.deepEqual(only.map((c) => c.id), ["current"]);
  ok("a single cluster does not invent east/west variants");
}

{
  const empty = chooseTripPlan({ info, wizard, places, stops: [], truckL: 12 });
  assert.equal(empty.status, "ok");
  assert.equal(empty.cabe, true);
  assert.deepEqual(empty.stopOrder, []);
  ok("an empty stop list is still status ok");
}

assert.throws(() => chooseTripPlan(null), TypeError);
ok("null input throws");

console.log(`tripPlanChooserGates: ${passed} passed`);
