/**
 * Tercerizado billable window: km starts at the first factory pickup.
 * Run: node tests/quoteWindow.test.js
 */
import assert from "node:assert/strict";
import { billableRoute, quoteStartForTrip } from "../src/utils/logistica/quoteWindow.js";

assert.equal(quoteStartForTrip(), "base");
assert.equal(quoteStartForTrip(null), "base");
assert.equal(quoteStartForTrip({ tercerizado: true }), "factory");
assert.equal(quoteStartForTrip({ tercerizado: "true" }), "base");
assert.equal(quoteStartForTrip({ quoteStart: "base", tercerizado: true }), "base");
assert.equal(quoteStartForTrip({ quoteStart: "factory", tercerizado: false }), "factory");
assert.equal(quoteStartForTrip({ quoteStart: "plant", tercerizado: true }), "factory");
assert.equal(quoteStartForTrip({ quoteStart: "plant" }), "base");

const positioning = { type: "position", legKmFromPrev: 40, label: "base" };
const pickup = { type: "pickup", legKmFromPrev: 12, label: "planta" };
const delivery = { type: "delivery", legKmFromPrev: 25, label: "obra" };
const route = {
  orderedLegs: [positioning, pickup, delivery],
  totalKm: 77,
  suggestionSource: "osrm",
};

const billed = billableRoute(route, { info: { tercerizado: true } });
assert.equal(billed.quoteStart, "factory");
assert.equal(billed.excludedLegs.length, 1);
assert.equal(billed.excludedLegs[0].label, "base");
assert.equal(billed.orderedLegs.length, 2);
assert.equal(billed.orderedLegs[0].legKmFromPrev, 0);
assert.equal(billed.orderedLegs[0].quoteAnchor, true);
assert.equal(billed.orderedLegs[1].legKmFromPrev, 25);
assert.equal(billed.orderedLegs[1].quoteAnchor, undefined);
assert.equal(billed.totalKm, 25);
assert.equal(billed.suggestionSource, "osrm");
assert.equal(pickup.legKmFromPrev, 12);
assert.equal(route.totalKm, 77);

const kept = billableRoute(route, { quoteStart: "base", info: { tercerizado: true } });
assert.equal(kept.quoteStart, "base");
assert.deepEqual(kept.excludedLegs, []);
assert.equal(kept.orderedLegs.length, 3);
assert.equal(kept.totalKm, 77);
assert.equal(kept.orderedLegs[0].legKmFromPrev, 40);

const noPickup = billableRoute(
  { orderedLegs: [positioning], totalKm: 40, suggestionSource: "manual" },
  { quoteStart: "factory" },
);
assert.equal(noPickup.excludedLegs.length, 0);
assert.equal(noPickup.totalKm, 40);
assert.equal(noPickup.orderedLegs[0].quoteAnchor, undefined);

const summed = billableRoute(
  {
    orderedLegs: [
      { type: "position", legKmFromPrev: 10 },
      { type: "delivery", legKmFromPrev: -5 },
      { type: "delivery", legKmFromPrev: Number.NaN },
      { type: "delivery", legKmFromPrev: 0 },
      { type: "delivery", legKmFromPrev: 3 },
    ],
  },
  { quoteStart: "base" },
);
assert.equal(summed.totalKm, 13);

const anchorOnly = billableRoute(
  { orderedLegs: [{ type: "pickup", legKmFromPrev: 12 }] },
  { quoteStart: "factory" },
);
assert.equal(anchorOnly.excludedLegs.length, 0);
assert.equal(anchorOnly.orderedLegs[0].legKmFromPrev, 0);
assert.equal(anchorOnly.totalKm, null);

const secondPickup = billableRoute(
  {
    orderedLegs: [
      { type: "position", legKmFromPrev: 15 },
      { type: "pickup", legKmFromPrev: 8 },
      { type: "pickup", legKmFromPrev: 4 },
    ],
  },
  { quoteStart: "factory" },
);
assert.equal(secondPickup.excludedLegs.length, 1);
assert.equal(secondPickup.orderedLegs[0].legKmFromPrev, 0);
assert.equal(secondPickup.orderedLegs[1].legKmFromPrev, 4);
assert.equal(secondPickup.totalKm, 4);

const empty = billableRoute(null);
assert.equal(empty.quoteStart, "base");
assert.deepEqual(empty.orderedLegs, []);
assert.deepEqual(empty.excludedLegs, []);
assert.equal(empty.totalKm, null);

console.log("quoteWindow.test.js: ok");
