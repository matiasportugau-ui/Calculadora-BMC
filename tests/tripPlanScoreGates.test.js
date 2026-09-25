/**
 * Trip-plan chooser scoring. Dispatch still builds a plan when east and west
 * share a trip (geo-mix is a soft block here). A truck that does not fit, or a
 * stop with no phone, must not come back as a drivable plan.
 *
 * Run: node tests/tripPlanScoreGates.test.js
 */
import assert from "node:assert/strict";
import {
  chooseTripPlan,
  collectTripFacts,
  deliveryCluster,
  scoreTripPlan,
} from "../src/utils/logistica/tripPlanChooser.js";
import { PANEL_ON_PROFILE_RULE_ES } from "../src/utils/logistica/stackConstraints.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("tripPlanScoreGates");

{
  assert.equal(deliveryCluster({ zona: "Maldonado" }), "east");
  assert.equal(deliveryCluster({ direccion: "Punta del Éste" }), "east");
  assert.equal(deliveryCluster({ cliente: "PUNTA BALLENA" }), "east");
  assert.equal(deliveryCluster({ zona: "Chacras del Pinar" }), "east");
  assert.equal(deliveryCluster({ zona: "Montevideo" }), "west");
  assert.equal(deliveryCluster({ direccion: "Paullier 1" }), "west");
  assert.equal(deliveryCluster({ zona: "Canelones" }), "");
  assert.equal(deliveryCluster(null), "");
  assert.equal(deliveryCluster({ zona: "Maldonado / Montevideo" }), "east");
  ok("cluster strips accents and checks east before west");
}

function fit(over = {}) {
  return {
    cabe: true,
    stackConstraintsOk: true,
    warns: [],
    stopUnloadOrder: [],
    ...over,
  };
}

{
  assert.deepEqual(scoreTripPlan({ cargo: { cabe: false }, route: { suggestionSource: "osrm" } }), {
    score: 0,
    reject: true,
    roadUnverified: false,
    unloadAligned: false,
  });
  assert.equal(scoreTripPlan({ cargo: {}, route: {} }).reject, true);
  assert.equal(
    scoreTripPlan({
      cargo: fit({ stackConstraintsOk: false }),
      route: { suggestionSource: "osrm", totalKm: 10 },
      bestKm: 10,
    }).reject,
    true,
  );
  ok("no cabe, missing cabe, or broken stack rejects even on OSRM");
}

{
  const rule = scoreTripPlan({
    cargo: fit({ warns: [PANEL_ON_PROFILE_RULE_ES] }),
    route: { suggestionSource: "osrm", totalKm: 10 },
    bestKm: 10,
  });
  assert.equal(rule.reject, true);
  assert.equal(rule.score, 0);
  const perfil = scoreTripPlan({
    cargo: fit({ warns: ["Panel apoyado sobre perfil U"] }),
    route: { suggestionSource: "osrm" },
  });
  assert.equal(perfil.reject, true);
  const acc = scoreTripPlan({
    cargo: fit({ warns: ["panel sobre accesorio"] }),
    route: { suggestionSource: "osrm" },
  });
  assert.equal(acc.reject, true);
  const loose = scoreTripPlan({
    cargo: fit({ warns: ["panel suelto"] }),
    route: { suggestionSource: "osrm", totalKm: 10 },
    bestKm: 10,
  });
  assert.equal(loose.reject, false);
  assert.equal(loose.score, 100);
  ok("panel-on-profile warn rejects; a panel mention alone does not");
}

{
  const aligned = scoreTripPlan({
    cargo: fit({
      stopUnloadOrder: [{ stop: { id: "b" } }, { stop: { id: "a" } }],
    }),
    route: {
      suggestionSource: "osrm",
      totalKm: 10,
      orderedLegs: [
        { type: "delivery", stopId: "a" },
        { type: "delivery", stopId: "b" },
      ],
    },
    bestKm: 10,
  });
  assert.equal(aligned.unloadAligned, true);
  assert.equal(aligned.score, 100);
  assert.equal(aligned.roadUnverified, false);

  const sameOrder = scoreTripPlan({
    cargo: fit({
      stopUnloadOrder: [{ stop: { id: "a" } }, { stop: { id: "b" } }],
    }),
    route: {
      suggestionSource: "osrm",
      totalKm: 10,
      orderedLegs: [
        { type: "delivery", stopId: "a" },
        { type: "delivery", stopId: "b" },
      ],
    },
    bestKm: 10,
  });
  assert.equal(sameOrder.unloadAligned, false);
  assert.equal(sameOrder.score, 80);

  const emptyUnload = scoreTripPlan({
    cargo: fit(),
    route: {
      suggestionSource: "osrm",
      totalKm: 10,
      orderedLegs: [{ type: "delivery", stopId: "a" }],
    },
    bestKm: 10,
  });
  assert.equal(emptyUnload.unloadAligned, false);
  assert.equal(emptyUnload.score, 100);
  ok("unload must be the reverse of deliveries; empty unload is not a penalty");
}

{
  const floored = scoreTripPlan({
    cargo: fit(),
    route: { suggestionSource: "haversine", missingGeoCount: 6, totalKm: 10 },
    bestKm: 10,
  });
  assert.equal(floored.score, 20);
  assert.equal(floored.reject, false);
  assert.equal(floored.roadUnverified, true);

  const coerced = scoreTripPlan({
    cargo: fit(),
    route: { suggestionSource: "osrm", missingGeoCount: "2", totalKm: 10 },
    bestKm: 10,
  });
  assert.equal(coerced.score, 70);

  const air = scoreTripPlan({
    cargo: fit(),
    route: { totalKm: 10 },
    bestKm: 10,
  });
  assert.equal(air.roadUnverified, true);
  assert.equal(air.score, 90);
  ok("missing geo floors at 20; string counts coerce; omitted source is air");
}

{
  const km = scoreTripPlan({
    cargo: fit(),
    route: { suggestionSource: "osrm", totalKm: 13.5 },
    bestKm: 10,
  });
  assert.equal(km.score, 99.3);

  const negative = scoreTripPlan({
    cargo: fit(),
    route: { suggestionSource: "osrm", totalKm: -5 },
    bestKm: 10,
  });
  assert.equal(negative.score, 100);

  const nullBest = scoreTripPlan({
    cargo: fit(),
    route: { suggestionSource: "osrm", totalKm: 10 },
    bestKm: null,
  });
  assert.equal(nullBest.score, 98);

  const omittedBest = scoreTripPlan({
    cargo: fit(),
    route: { suggestionSource: "osrm", totalKm: 10 },
  });
  assert.equal(omittedBest.score, 100);

  const overhang = scoreTripPlan({
    cargo: fit({ warns: ["sobresale 20cm"] }),
    route: { suggestionSource: "osrm", totalKm: 10 },
    bestKm: 10,
  });
  assert.equal(overhang.score, 92);

  const faltas = scoreTripPlan({
    cargo: fit(),
    route: { suggestionSource: "osrm", totalKm: 10 },
    bestKm: 10,
    warnFaltaCount: 3,
  });
  assert.equal(faltas.score, 85);
  ok("km delta, null best, overhang, and falta warns change the score");
}

function stop(over = {}) {
  return {
    id: "s1",
    orden: 1,
    cliente: "Ana",
    telefono: "099111111",
    direccion: "Calle 12 340, Maldonado",
    zona: "Maldonado",
    pickupPointId: "pickup-kingspan-bromyros",
    paneles: [{ id: "p1", tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 4 }],
    geo: { lat: -34.9, lng: -54.95 },
    ...over,
  };
}

const info = { transportista: "Juan", basePointId: "base-1" };
const places = [
  { id: "base-1", label: "Base", geo: { lat: -34.88, lng: -56.25 } },
  { id: "pickup-kingspan-bromyros", label: "Kingspan", geo: { lat: -34.7, lng: -56.2 } },
];
const wizard = { singlePickup: true, defaultPickupPointId: "pickup-kingspan-bromyros" };

{
  const stops = [stop()];
  const before = JSON.stringify(stops);
  const plan = chooseTripPlan({ info, places, truckL: 12, wizard, stops });
  assert.equal(JSON.stringify(stops), before);
  assert.equal(plan.status, "ok");
  assert.equal(plan.strategy, "doorPriority");
  assert.equal(plan.cabe, true);
  assert.equal(plan.roadUnverified, true);
  assert.equal(plan.reliability, 85);
  assert.match(plan.why, /aire/);
  assert.match(plan.why, /acceso rápido/);
  ok("one fitting stop stays doorPriority by air and does not mutate input");
}

{
  const east = stop({ id: "e", orden: 2, cliente: "Este" });
  const west = stop({
    id: "w",
    orden: 1,
    cliente: "Oeste",
    zona: "Montevideo",
    direccion: "Juan Paullier 1625, Montevideo",
    geo: { lat: -34.9, lng: -56.16 },
  });
  const facts = collectTripFacts({ info, wizard, stops: [east, west] });
  assert.equal(facts.blocks.some((b) => b.id === "geo-mix"), false);
  assert.equal(facts.warns.some((w) => w.id === "geo-mix"), true);
  const plan = chooseTripPlan({ info, places, truckL: 12, wizard, stops: [east, west] });
  assert.equal(plan.status, "ok");
  assert.equal(plan.cabe, true);
  assert.deepEqual([...plan.stopOrder].sort(), ["e", "w"]);
  assert.equal(plan.blocks.length, 0);
  ok("east+west geo-mix stays a warning and still returns a plan");
}

{
  const blocked = chooseTripPlan({
    info,
    places,
    truckL: 8,
    wizard,
    stops: [stop({ telefono: "" })],
  });
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.cabe, false);
  assert.equal(blocked.blocks[0].id, "tel-s1");
  assert.equal(blocked.blocks[0].severity, "block");
  assert.match(blocked.why, /^Falta Ana: falta teléfono/);
  ok("missing phone blocks the plan");
}

{
  const blocked = chooseTripPlan({
    info,
    places,
    truckL: 8,
    wizard,
    stops: [
      stop({
        paneles: [{ id: "p1", tipo: "ISODEC", espesor: 100, longitud: 40, cantidad: 80 }],
      }),
    ],
  });
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.cabe, false);
  assert.equal(blocked.blocks[0].id, "cargo-no-cabe");
  assert.match(blocked.why, /no entra/);
  ok("cargo that does not fit is not a drivable plan");
}

console.log(`tripPlanScoreGates: ${passed} passed`);
