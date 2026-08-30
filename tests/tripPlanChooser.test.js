/**
 * Deterministic trip chooser: clusters, soft geo-mix, cargo reject.
 * Run: node tests/tripPlanChooser.test.js
 */
import assert from "node:assert/strict";
import {
  deliveryCluster,
  collectTripFacts,
  scoreTripPlan,
  chooseTripPlan,
} from "../src/utils/logistica/tripPlanChooser.js";

console.log("tripPlanChooser");

{
  assert.equal(deliveryCluster({ zona: "Maldonado" }), "east");
  assert.equal(deliveryCluster({ direccion: "Punta del Este, Gorlero 100" }), "east");
  assert.equal(deliveryCluster({ zona: "Montevideo" }), "west");
  assert.equal(deliveryCluster({ cliente: "Paullier" }), "west");
  assert.equal(deliveryCluster({ zona: "Canelones", direccion: "Ruta 8 km 20" }), "");
  console.log("  ✓ deliveryCluster east/west / unknown");
}

{
  const facts = collectTripFacts({
    info: { transportista: "Flota", basePointId: "depo" },
    stops: [
      {
        id: "e1",
        cliente: "Este",
        zona: "Maldonado",
        direccion: "Gorlero 100",
        telefono: "099111222",
      },
      {
        id: "w1",
        cliente: "Oeste",
        zona: "Montevideo",
        direccion: "18 de Julio 1234",
        telefono: "099333444",
      },
    ],
  });
  assert.equal(
    facts.faltas.some((f) => f.id === "geo-mix" && f.severity === "block"),
    true,
    "desk still flags east+west as a block",
  );
  assert.equal(
    facts.blocks.some((f) => f.id === "geo-mix"),
    false,
    "chooser must not hard-block geo-mix (SOFT_BLOCKS)",
  );
  assert.equal(facts.warns.some((f) => f.id === "geo-mix"), true);
  console.log("  ✓ geo-mix is warn for chooser, block for desk");
}

{
  const rejected = [
    scoreTripPlan({ cargo: { cabe: false } }),
    scoreTripPlan({ cargo: { cabe: true, stackConstraintsOk: false } }),
    scoreTripPlan({ cargo: { cabe: true, stackConstraintsOk: true, warns: ["panel sobre perfil"] } }),
  ];
  for (const row of rejected) {
    assert.equal(row.reject, true);
    assert.equal(row.score, 0);
  }

  const ok = scoreTripPlan({
    cargo: { cabe: true, stackConstraintsOk: true, warns: [], stopUnloadOrder: [] },
    route: { missingGeoCount: 0, suggestionSource: "osrm", totalKm: 40 },
    bestKm: 40,
    deliveryIds: ["a", "b"],
  });
  assert.equal(ok.reject, false);
  assert.equal(ok.roadUnverified, false);
  assert.ok(ok.score >= 90);

  const air = scoreTripPlan({
    cargo: { cabe: true, stackConstraintsOk: true, warns: [] },
    route: { missingGeoCount: 0, suggestionSource: "haversine", totalKm: 40 },
    bestKm: 40,
    deliveryIds: [],
  });
  assert.equal(air.roadUnverified, true);
  assert.ok(air.score < ok.score);
  console.log("  ✓ scoreTripPlan rejects unsafe cargo; OSRM beats aire");
}

{
  const blocked = chooseTripPlan({
    info: { transportista: "Flota", basePointId: "depo" },
    stops: [
      {
        id: "s1",
        cliente: "Obra",
        zona: "Montevideo",
        direccion: "18 de Julio 1234",
      },
    ],
  });
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.cabe, false);
  assert.ok(blocked.blocks.some((b) => String(b.id).startsWith("tel-")));
  assert.match(blocked.why, /Falta|teléfono/i);
  console.log("  ✓ chooseTripPlan blocks missing delivery phone");
}

console.log("tripPlanChooser OK");
