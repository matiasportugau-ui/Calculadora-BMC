/**
 * Pickup vs obra classification — kind/tipo/role only (not cliente name).
 * Misclassifying planta as obra (or the reverse) flips phone-block vs warn.
 * Run: node tests/driverPickupKind.test.js
 */
import assert from "node:assert/strict";
import { isPickupStop } from "../server/lib/driverId.js";

console.log("driverPickupKind");

for (const stop of [
  { kind: "levante" },
  { kind: "pickup" },
  { kind: "planta" },
  { kind: "fabrica" },
  { kind: "fábrica" },
  { kind: "deposito" },
  { kind: "depósito" },
  { tipo: "levante" },
  { role: "pickup" },
  { kind: "Levante planta" },
]) {
  assert.equal(isPickupStop(stop), true, JSON.stringify(stop));
}

for (const stop of [
  null,
  undefined,
  {},
  { kind: "" },
  { kind: "entrega" },
  { kind: "obra" },
  { kind: "delivery" },
  { cliente: "Planta SA" },
  { cliente: "Depósito BMC", direccion: "Maldonado" },
  { orderId: "BMC-1" },
]) {
  assert.equal(isPickupStop(stop), false, JSON.stringify(stop));
}

console.log("driverPickupKind: ok");
