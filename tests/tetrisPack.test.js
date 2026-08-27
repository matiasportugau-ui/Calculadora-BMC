/**
 * Run: node tests/tetrisPack.test.js
 */
import assert from "node:assert/strict";
import {
  deliveryIdsFromRoute,
  loadKeysFromRoute,
  stackLedges,
  fillLedgePockets,
  tetrisPlaceCargo,
} from "../src/utils/logistica/tetrisPack.js";

console.log("tetrisPack");

{
  const route = {
    orderedLegs: [
      { type: "pickup", stopId: "" },
      { type: "delivery", stopId: "s1" },
      { type: "delivery", stopId: "s2" },
    ],
  };
  assert.deepEqual(deliveryIdsFromRoute(route, []), ["s1", "s2"]);
  const keys = loadKeysFromRoute(
    [
      { id: "s1", orden: 1, paneles: [{ id: "p", longitud: 6, cantidad: 4, espesor: 50 }] },
      { id: "s2", orden: 2, paneles: [{ id: "q", longitud: 8, cantidad: 4, espesor: 50 }] },
    ],
    route,
  );
  assert.ok(keys[0].startsWith("s2:"), "last delivery loads first (door)");
  console.log("  ✓ route load order last-delivery-first");
}

{
  const placed = [
    { stableKey: "base", stackId: "R1-S1", row: 0, len: 8, h: 0.4, zBase: 0, xStart: 0, xEnd: 8, kind: "panel" },
    { stableKey: "top", stackId: "R1-S1", row: 0, len: 6, h: 0.3, zBase: 0.4, xStart: 2, xEnd: 8, kind: "panel" },
    { stableKey: "small", stackId: "R1-S2", row: 0, len: 1.5, h: 0.2, zBase: 0, xStart: -1.5, xEnd: 0, kind: "accessory" },
  ];
  const ledges = stackLedges(placed, 2.5);
  assert.ok(ledges[0].leftoverLen > 1.4);
  const filled = fillLedgePockets({ placed, maxH: 2.5, bedM: 8 });
  const small = filled.placed.find((p) => p.stableKey === "small");
  assert.equal(small.stackId, "R1-S1");
  assert.ok(small.zBase >= 0.39);
  assert.equal(small.tetrisLedge, true);
  console.log("  ✓ ledge fill leftover volume");
}

{
  const stops = [
    {
      id: "s1",
      orden: 1,
      cliente: "A",
      paneles: [{ id: "a", tipo: "ISODEC", espesor: 50, longitud: 6, cantidad: 8 }],
    },
    {
      id: "s2",
      orden: 2,
      cliente: "B",
      paneles: [{ id: "b", tipo: "ISODEC", espesor: 50, longitud: 4, cantidad: 4 }],
    },
  ];
  const r = tetrisPlaceCargo(stops, 8, {
    orderedLegs: [
      { type: "delivery", stopId: "s1" },
      { type: "delivery", stopId: "s2" },
    ],
  });
  assert.ok(r.placed.length >= 2);
  assert.equal(r.strategy, "tetris");
  const first = r.placed[0];
  assert.ok(first.sId === "s2" || r.loadKeys[0].startsWith("s2:"));
  console.log("  ✓ tetrisPlaceCargo");
}

console.log("tetrisPack: ok");
