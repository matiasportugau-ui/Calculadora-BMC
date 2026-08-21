/**
 * Run: node tests/uyGazetteer.test.js
 */
import assert from "node:assert/strict";
import {
  lookupUyGazetteer,
  isIncompleteStreet,
  isPlantPickupStop,
  isDepotPickupStop,
  isOffTruckDelivery,
  normalizeEntregaModo,
} from "../src/utils/logistica/uyGazetteer.js";
import { buildRutaFaltas } from "../src/utils/logistica/rutaFaltas.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("uyGazetteer + rutaFaltas");

{
  const g = lookupUyGazetteer("Juan Paullier 1625, Montevideo");
  assert.equal(g.id, "juan-paullier-1625");
  assert.equal(g.precision, "street");
  ok("Paullier street pin");
}

{
  const g = lookupUyGazetteer("Ciudad de Madonado");
  assert.equal(g.id, "ciudad-maldonado");
  assert.equal(g.precision, "city");
  ok("Maldonado typo still city pin");
}

{
  assert.equal(lookupUyGazetteer("Depósito BMC").id, "deposito-bmc-maldonado");
  assert.equal(lookupUyGazetteer("BMC URUGUAY").label, "BMC URUGUAY");
  assert.equal(lookupUyGazetteer("BMC URUGUAY").lat, -34.9053458);
  assert.equal(lookupUyGazetteer("BMC URUGUAY").lng, -54.928693);
  assert.equal(lookupUyGazetteer("Chacras del Pinar").id, "chacras-del-pinar");
  assert.equal(lookupUyGazetteer("Calle Cuba, casa Delirio").id, "calle-cuba-maldonado");
  assert.equal(lookupUyGazetteer("4H, Maldonado").id, "barrio-4h-maldonado");
  ok("21/08 delivery pins");
}

{
  assert.equal(isIncompleteStreet("Ciudad de Maldonado (falta calle/nro)"), true);
  assert.equal(isIncompleteStreet("Juan Paullier 1625, Montevideo"), false);
  ok("incomplete street");
}

{
  assert.equal(isPlantPickupStop({ entregaModo: "planta" }), true);
  assert.equal(isPlantPickupStop({ entregaModo: "obra" }), false);
  assert.equal(normalizeEntregaModo({}), "obra");
  assert.equal(normalizeEntregaModo({ entregaModo: "" }), "obra");
  assert.equal(normalizeEntregaModo({ entregaModo: "depo" }), "depo");
  assert.equal(normalizeEntregaModo({ entregaModo: "Depósito" }), "depo");
  assert.equal(isDepotPickupStop({ entregaModo: "depo" }), true);
  assert.equal(isDepotPickupStop({ entregaModo: "obra" }), false);
  assert.equal(isOffTruckDelivery({ entregaModo: "planta" }), true);
  assert.equal(isOffTruckDelivery({ entregaModo: "depo" }), true);
  assert.equal(isOffTruckDelivery({}), false);
  ok("plant pickup flag");
}

{
  const faltas = buildRutaFaltas({
    info: {},
    wizard: { singlePickup: false },
    route: { orderedLegs: [{ geo: { lat: 1, lng: 1 } }] },
    stops: [
      { id: "1", cliente: "Alvaro Gonzalez", direccion: "Ciudad de Maldonado" },
      { id: "2", cliente: "ALEDMA S.A", direccion: "Juan Paullier 1625, Montevideo" },
    ],
  });
  const ids = faltas.map((f) => f.id);
  assert.ok(ids.includes("street-1"));
  assert.ok(ids.includes("sin-origen"));
  assert.ok(ids.includes("geo-mix"));
  assert.ok(!ids.includes("modo-2"));
  ok("faltas for tomorrow trip");
}

{
  const faltas = buildRutaFaltas({
    info: { transportista: "X", basePointId: "b" },
    wizard: { singlePickup: true, defaultPickupPointId: "pickup-kingspan-bromyros" },
    route: { orderedLegs: [{ geo: { lat: -34.8, lng: -56 } }, { geo: { lat: -34.9, lng: -54.9 } }] },
    stops: [
      { id: "1", cliente: "Alvaro Gonzalez", direccion: "Calle 123, Maldonado", pickupPointId: "pickup-kingspan-bromyros" },
      { id: "2", cliente: "ALEDMA S.A", direccion: "Juan Paullier 1625", entregaModo: "planta", pickupPointId: "pickup-kingspan-bromyros" },
    ],
  });
  assert.equal(faltas.length, 0);
  ok("no mix falta when west stop is plant pickup");
}

{
  const faltas = buildRutaFaltas({
    info: { transportista: "X", basePointId: "b" },
    wizard: { singlePickup: false },
    route: { orderedLegs: [{ geo: { lat: 1, lng: 1 } }] },
    stops: [{ id: "1", cliente: "Solo", direccion: "Calle 1, Maldonado", pickupPointId: "" }],
  });
  const sin = faltas.find((f) => f.id === "sin-origen");
  assert.equal(sin?.action, "goto_levantes");
  assert.equal(sin?.step, "levantes");
  ok("sin origen jumps to levantes");
}

{
  const faltas = buildRutaFaltas({
    info: { transportista: "X", basePointId: "b" },
    wizard: { singlePickup: true, defaultPickupPointId: "pickup-kingspan-bromyros" },
    route: { orderedLegs: [{ geo: { lat: -34.8, lng: -56 } }, { geo: { lat: -34.9, lng: -54.9 } }] },
    stops: [
      { id: "1", cliente: "Alvaro Gonzalez", direccion: "Calle 123, Maldonado", pickupPointId: "pickup-kingspan-bromyros" },
      { id: "2", cliente: "ALEDMA S.A", direccion: "Juan Paullier 1625", entregaModo: "depo", pickupPointId: "pickup-kingspan-bromyros" },
    ],
  });
  const ids = faltas.map((f) => f.id);
  assert.ok(!ids.includes("geo-mix"));
  assert.ok(!ids.includes("street-2"));
  ok("depo skip street + west mix");
}

console.log(`uyGazetteer: ${passed} passed`);
