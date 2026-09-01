// Tetris load keys: last delivery at the door. Complementary to orphan tetrisPack.test.js
// (ledge fill stays unwired — do not re-land that file).
// Run: node tests/tetrisLoadOrder.test.js

import assert from "node:assert/strict";
import { deliveryIdsFromRoute, loadKeysFromRoute } from "../src/utils/logistica/tetrisPack.js";

const route = {
  orderedLegs: [
    { type: "pickup", stopId: "planta" },
    { type: "delivery", stopId: "s1" },
    { type: "delivery", stopId: "s2" },
    { type: "delivery", stopId: "s2" },
    { type: "delivery", stopId: "" },
  ],
};

assert.deepEqual(
  deliveryIdsFromRoute(route, []),
  ["s1", "s2"],
  "skip pickup, empty id, and duplicate delivery",
);

assert.deepEqual(
  deliveryIdsFromRoute({ orderedLegs: [{ type: "pickup", stopId: "planta" }] }, [
    { id: "s1", orden: 2 },
    { id: "s2", orden: 1 },
  ]),
  ["s2", "s1"],
  "pickup-only route falls back to stop.orden",
);

assert.deepEqual(deliveryIdsFromRoute(null, []), []);
assert.deepEqual(deliveryIdsFromRoute({ orderedLegs: [] }, [{ id: "", orden: 1 }]), []);

const stops = [
  {
    id: "s1",
    orden: 1,
    paneles: [{ id: "p", longitud: 6, cantidad: 4, espesor: 50 }],
    accesorios: [{ descr: "perfil", cantidad: 10 }],
    accPackage: { len: 6 },
  },
  {
    id: "s2",
    orden: 2,
    paneles: [
      { id: "short", longitud: 4, cantidad: 2, espesor: 50 },
      { id: "long", longitud: 8, cantidad: 2, espesor: 50 },
    ],
  },
];

const keys = loadKeysFromRoute(stops, route);
assert.ok(keys[0].startsWith("s2:"), "last delivery loads first (door)");
assert.ok(keys.some((k) => k.startsWith("s1:panel:")));
assert.ok(keys.includes("s1:accessory"));
assert.ok(
  keys.indexOf(keys.find((k) => k.startsWith("s1:panel:"))) < keys.indexOf("s1:accessory"),
  "same-stop panels before accessory bulto",
);
assert.ok(
  keys.indexOf("s2:panel:long:0") < keys.indexOf("s2:panel:short:0"),
  "longer panel of the door stop loads first",
);

const byOrden = loadKeysFromRoute(stops, null);
assert.ok(byOrden[0].startsWith("s2:"), "no-route still uses last orden as door");

console.log("tetrisLoadOrder.test.js ok");
