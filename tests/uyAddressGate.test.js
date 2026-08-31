/**
 * Uruguay address / phone / entrega-modo gates used by Ruta faltas.
 * Run: node tests/uyAddressGate.test.js
 */
import assert from "node:assert/strict";
import {
  isUyPhoneOk,
  isPreciseAddress,
  isIncompleteStreet,
  normalizeEntregaModo,
  isPlantPickupStop,
  isDepotPickupStop,
  isOffTruckDelivery,
  lookupUyGazetteer,
} from "../src/utils/logistica/uyGazetteer.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("uyAddressGate");

{
  assert.equal(isUyPhoneOk("099 148 920"), true);
  assert.equal(isUyPhoneOk("94051542"), true);
  assert.equal(isUyPhoneOk("+598 99 123 456"), true);
  assert.equal(isUyPhoneOk("1234567"), false, "7 digits fail");
  assert.equal(isUyPhoneOk(""), false);
  assert.equal(isUyPhoneOk(null), false);
  ok("isUyPhoneOk ≥8 digits");
}

{
  assert.equal(isPreciseAddress("Juan Paullier 1625, Montevideo"), true);
  assert.equal(isPreciseAddress("Calle 123, Maldonado"), true);
  assert.equal(isPreciseAddress("Cuba y Honduras"), true);
  assert.equal(isPreciseAddress("Calle Cuba, entre Av España y Honduras"), true);
  assert.equal(isPreciseAddress("Ciudad de Maldonado"), false);
  assert.equal(isPreciseAddress("Maldonado"), false);
  assert.equal(isPreciseAddress("4H Maldonado"), false);
  assert.equal(isPreciseAddress("Chacras del Pinar"), false);
  assert.equal(isPreciseAddress("Ciudad de Maldonado (falta calle/nro)"), false);
  assert.equal(isPreciseAddress(""), false);
  assert.equal(isIncompleteStreet("Barrio 4H, Maldonado"), true);
  assert.equal(isIncompleteStreet("Juan Paullier 1625"), false);
  ok("isPreciseAddress street/esquina vs barrio/city");
}

{
  assert.equal(normalizeEntregaModo({}), "obra");
  assert.equal(normalizeEntregaModo({ entregaModo: "" }), "obra");
  assert.equal(normalizeEntregaModo({ entregaModo: "PLANTA" }), "planta");
  assert.equal(normalizeEntregaModo({ entregaModo: "Depósito" }), "depo");
  assert.equal(normalizeEntregaModo({ entregaModo: "depot" }), "depo");
  assert.equal(normalizeEntregaModo("deposito"), "depo");
  assert.equal(isPlantPickupStop({ entregaModo: "planta" }), true);
  assert.equal(isDepotPickupStop({ entregaModo: "depo" }), true);
  assert.equal(isOffTruckDelivery({ entregaModo: "planta" }), true);
  assert.equal(isOffTruckDelivery({ entregaModo: "depo" }), true);
  assert.equal(isOffTruckDelivery({ entregaModo: "obra" }), false);
  assert.equal(isOffTruckDelivery({}), false);
  ok("entregaModo aliases + off-truck");
}

{
  assert.equal(lookupUyGazetteer(""), null);
  assert.equal(lookupUyGazetteer("nowhere-xyz"), null);
  const paullier = lookupUyGazetteer("Juan Paullier 1625, Montevideo");
  assert.equal(paullier?.precision, "street");
  const city = lookupUyGazetteer("Ciudad de Madonado");
  assert.equal(city?.id, "ciudad-maldonado");
  assert.equal(city?.precision, "city", "typo city pin is not street");
  ok("gazetteer miss + typo stays city precision");
}

console.log(`uyAddressGate: ${passed} passed`);
