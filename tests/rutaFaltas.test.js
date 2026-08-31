/**
 * Ruta desk faltas queue — block vs warn, phone, geo-mix, fleet.
 * Run: node tests/rutaFaltas.test.js
 */
import assert from "node:assert/strict";
import { buildRutaFaltas } from "../src/utils/logistica/rutaFaltas.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("rutaFaltas");

function ids(faltas) {
  return faltas.map((f) => f.id);
}

function byId(faltas, id) {
  return faltas.find((f) => f.id === id);
}

{
  const faltas = buildRutaFaltas();
  const got = ids(faltas);
  assert.ok(got.includes("transportista"));
  assert.equal(byId(faltas, "transportista")?.severity, "warn");
  assert.ok(got.includes("base"));
  assert.equal(byId(faltas, "base")?.severity, "warn");
  assert.ok(got.includes("no-route"));
  assert.equal(byId(faltas, "no-route")?.severity, "warn");
  ok("empty ctx warns fleet + missing itinerary");
}

{
  const faltas = buildRutaFaltas({
    info: { transportista: "T", basePointId: "b1" },
    wizard: { singlePickup: true, defaultPickupPointId: "p1" },
    route: { orderedLegs: [{ geo: { lat: -34.9, lng: -54.9 } }] },
    stops: [
      {
        id: "d1",
        cliente: "Obra Este",
        direccion: "Calle 12, Maldonado",
        telefono: "",
        pickupPointId: "p1",
      },
    ],
  });
  const tel = byId(faltas, "tel-d1");
  assert.equal(tel?.severity, "block", "obra delivery without phone is a hard block");
  assert.equal(tel?.action, "ask_phone");
  ok("obra missing phone is block");
}

{
  const faltas = buildRutaFaltas({
    info: { transportista: "T", basePointId: "b1" },
    wizard: { singlePickup: true, defaultPickupPointId: "p1" },
    route: { orderedLegs: [{ geo: { lat: -34.8, lng: -56 } }] },
    stops: [
      {
        id: "p1s",
        cliente: "Retira planta",
        direccion: "Kingspan",
        telefono: "123",
        entregaModo: "planta",
        pickupPointId: "p1",
      },
    ],
  });
  const tel = byId(faltas, "tel-p1s");
  assert.equal(tel?.severity, "warn", "plant pickup phone is warn, not block");
  assert.ok(!ids(faltas).includes("street-p1s"), "plant pickup skips street gate");
  ok("plant pickup phone warn + skip street");
}

{
  const faltas = buildRutaFaltas({
    info: { transportista: "T", basePointId: "b1" },
    wizard: { singlePickup: false },
    route: { orderedLegs: [{ geo: { lat: -34.9, lng: -54.9 } }] },
    stops: [
      {
        id: "x",
        cliente: "Sin origen",
        direccion: "Calle 1, Maldonado",
        telefono: "099111111",
        pickupPointId: "",
      },
    ],
  });
  assert.equal(byId(faltas, "sin-origen")?.severity, "warn");
  assert.equal(byId(faltas, "sin-origen")?.action, "goto_levantes");

  const approved = buildRutaFaltas({
    info: { transportista: "T", basePointId: "b1" },
    wizard: { singlePickup: false, unassignedPickupApproved: true },
    route: { orderedLegs: [{ geo: { lat: -34.9, lng: -54.9 } }] },
    stops: [
      {
        id: "x",
        cliente: "Sin origen",
        direccion: "Calle 1, Maldonado",
        telefono: "099111111",
        pickupPointId: "",
      },
    ],
  });
  assert.ok(!ids(approved).includes("sin-origen"), "HITL approval clears missing-origin warn");
  ok("sin-origen warn unless unassignedPickupApproved");
}

{
  const faltas = buildRutaFaltas({
    info: { transportista: "T", basePointId: "b1" },
    wizard: { singlePickup: true, defaultPickupPointId: "p1" },
    route: {
      orderedLegs: [
        { geo: { lat: -34.91, lng: -54.96 } },
        { geo: { lat: -34.91, lng: -56.17 } },
      ],
    },
    stops: [
      {
        id: "e",
        cliente: "Este",
        direccion: "Calle 20, Maldonado",
        telefono: "099111111",
        pickupPointId: "p1",
      },
      {
        id: "w",
        cliente: "Oeste",
        direccion: "Juan Paullier 1625, Montevideo",
        telefono: "099222222",
        pickupPointId: "p1",
      },
    ],
  });
  const mix = byId(faltas, "geo-mix");
  assert.equal(mix?.severity, "block", "desk geo-mix is a hard block (chooser may only warn)");
  assert.equal(mix?.action, "goto_levantes");
  ok("east+west live deliveries block");
}

{
  const faltas = buildRutaFaltas({
    info: { transportista: "T", basePointId: "b1" },
    wizard: { singlePickup: true, defaultPickupPointId: "p1" },
    route: {
      orderedLegs: [
        { geo: { lat: -34.91, lng: -54.96 } },
        { geo: { lat: -34.91, lng: -56.17 } },
      ],
    },
    stops: [
      {
        id: "e",
        cliente: "Este",
        direccion: "Calle 20, Maldonado",
        telefono: "099111111",
        pickupPointId: "p1",
      },
      {
        id: "w",
        cliente: "Montevideo SA",
        direccion: "Calle 8, Punta del Este",
        telefono: "099222222",
        pickupPointId: "p1",
      },
    ],
  });
  assert.ok(
    !ids(faltas).includes("geo-mix"),
    "cliente name with Montevideo does not set west cluster (zona+direccion only)",
  );
  ok("geo-mix ignores cliente name");
}

{
  const faltas = buildRutaFaltas({
    info: { transportista: "T", basePointId: "b1" },
    wizard: { singlePickup: true, defaultPickupPointId: "p1" },
    route: {
      orderedLegs: [
        { geo: { lat: -34.91, lng: -54.96 } },
        { geo: { lat: -34.91, lng: -56.17 } },
      ],
    },
    stops: [
      {
        id: "e",
        cliente: "Este",
        direccion: "Calle 20, Maldonado",
        telefono: "099111111",
        pickupPointId: "p1",
      },
      {
        id: "w",
        cliente: "Retira MVD",
        direccion: "Juan Paullier 1625, Montevideo",
        telefono: "099222222",
        entregaModo: "planta",
        pickupPointId: "p1",
      },
    ],
  });
  assert.ok(!ids(faltas).includes("geo-mix"), "off-truck west stop is not a live east/west mix");
  ok("plant west does not geo-mix");
}

{
  const faltas = buildRutaFaltas({
    info: { transportista: "T", basePointId: "b1" },
    wizard: { singlePickup: true, defaultPickupPointId: "p1", routeStale: true },
    route: { orderedLegs: [{}, { geo: { lat: 1, lng: 1 } }] },
    stops: [
      {
        id: "ok",
        cliente: "A",
        direccion: "Calle 1, Maldonado",
        telefono: "099111111",
        pickupPointId: "p1",
      },
    ],
  });
  const got = ids(faltas);
  assert.ok(got.includes("stale"));
  assert.equal(byId(faltas, "stale")?.action, "recalc");
  assert.ok(got.includes("geo"));
  assert.match(byId(faltas, "geo")?.label || "", /1 punto/);
  ok("stale route + missing pin warn");
}

{
  const faltas = buildRutaFaltas({
    info: { transportista: "T", basePointId: "b1" },
    wizard: { singlePickup: true, defaultPickupPointId: "p1" },
    route: { orderedLegs: [{ geo: { lat: 1, lng: 1 } }] },
    stops: [
      {
        id: "dep",
        cliente: "Depo",
        direccion: "Ciudad de Maldonado",
        telefono: "099111111",
        entregaModo: "depo",
        pickupPointId: "p1",
      },
    ],
  });
  assert.ok(!ids(faltas).includes("street-dep"), "depo skips street completeness");
  ok("depo skip street");
}

console.log(`rutaFaltas: ${passed} passed`);
