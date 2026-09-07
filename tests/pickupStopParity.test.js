/**
 * Server isPickupStop (join / customer-track delivery filter) must stay
 * aligned with the Driver feed projector. Divergence sends chofer to the
 * factory as dest or mints a customer link for a levante stop.
 * Run: node tests/pickupStopParity.test.js
 */
import assert from "node:assert/strict";
import { isPickupStop } from "../server/lib/driverId.js";
import { projectDriverTripFeed } from "../src/utils/logistica/driverTripFeed.js";

console.log("pickupStopParity");

/** Last-stop classification oracle: dest stays the leading obra iff last is pickup. */
function feedTreatsAsPickup(stop) {
  const feed = projectDriverTripFeed({
    trip: { trip_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    stops: [{ direccion: "Obra Destino Unique" }, stop],
  });
  return feed.dest === "Obra Destino Unique";
}

const pickupCases = [
  { kind: "pickup" },
  { kind: "levante" },
  { kind: "planta" },
  { kind: "fabrica" },
  { kind: "fábrica" },
  { kind: "deposito" },
  { kind: "depósito" },
  { tipo: "PICKUP" },
  { role: "Levante" },
  { kind: "stop", tipo: "planta-kingspan" },
  { kind: "  deposito  " },
];

const deliveryCases = [
  {},
  { kind: "entrega" },
  { kind: "obra" },
  { kind: "delivery" },
  { tipo: "destino" },
  { role: "dropoff" },
  { kind: "pickuppoint" },
  { cliente: "Planta SA", direccion: "Fábrica del cliente 100" },
  { label: "Levante Pepe" },
  null,
  undefined,
  "levante",
];

for (const stop of pickupCases) {
  assert.equal(isPickupStop(stop), true, `server pickup ${JSON.stringify(stop)}`);
  assert.equal(feedTreatsAsPickup(stop), true, `feed pickup ${JSON.stringify(stop)}`);
}
console.log("  ✓ kind/tipo/role aliases (pickup/levante/planta/fábrica/depósito) match");

for (const stop of deliveryCases) {
  assert.equal(isPickupStop(stop), false, `server delivery ${JSON.stringify(stop)}`);
  assert.equal(feedTreatsAsPickup(stop), false, `feed delivery ${JSON.stringify(stop)}`);
}
console.log("  ✓ entrega/obra/cliente Planta SA are not pickups (kind/tipo/role only)");

{
  // Hyphen is a word boundary, so pickup-custom / planta-kingspan stay pickups.
  assert.equal(isPickupStop({ kind: "pickup-custom" }), true);
  assert.equal(feedTreatsAsPickup({ kind: "pickup-custom", direccion: "X" }), true);
  assert.equal(isPickupStop({ kind: "pickuppoint" }), false);
  assert.equal(feedTreatsAsPickup({ kind: "pickuppoint", direccion: "X" }), false);
  console.log("  ✓ hyphen keeps pickup-*; glued pickuppoint does not");
}

{
  const feed = projectDriverTripFeed({
    trip: { trip_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    stops: [
      { kind: "levante", direccion: "Pedro Cosio" },
      { cliente: "Planta SA", direccion: "Fábrica del cliente 100" },
    ],
  });
  assert.equal(feed.origin, "Pedro Cosio");
  assert.equal(feed.dest, "Fábrica del cliente 100");
  console.log("  ✓ cliente named Planta SA still counts as dest");
}

console.log("pickupStopParity OK");
