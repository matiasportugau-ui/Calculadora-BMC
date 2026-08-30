/**
 * Billable window for tercerizado trips: quote starts at factory arrival.
 * Run: node tests/quoteWindow.test.js
 */
import assert from "node:assert/strict";
import { quoteStartForTrip, billableRoute } from "../src/utils/logistica/quoteWindow.js";

console.log("quoteWindow");

{
  assert.equal(quoteStartForTrip({}), "base");
  assert.equal(quoteStartForTrip({ tercerizado: false }), "base");
  assert.equal(quoteStartForTrip({ tercerizado: true }), "factory");
  assert.equal(quoteStartForTrip({ quoteStart: "factory" }), "factory");
  assert.equal(
    quoteStartForTrip({ quoteStart: "base", tercerizado: true }),
    "base",
    "explicit quoteStart wins over tercerizado",
  );
  assert.equal(quoteStartForTrip({ quoteStart: "other", tercerizado: true }), "factory");
  console.log("  ✓ quoteStartForTrip factory vs base");
}

const legs = [
  { type: "positioning", stopId: "depo", legKmFromPrev: 40 },
  { type: "pickup", stopId: "plant", legKmFromPrev: 12 },
  { type: "delivery", stopId: "obra", legKmFromPrev: 30 },
];

{
  const billed = billableRoute({ orderedLegs: legs, totalKm: 82 }, { info: { tercerizado: true } });
  assert.equal(billed.quoteStart, "factory");
  assert.equal(billed.excludedLegs.length, 1);
  assert.equal(billed.excludedLegs[0].type, "positioning");
  assert.equal(billed.orderedLegs.length, 2);
  assert.equal(billed.orderedLegs[0].type, "pickup");
  assert.equal(billed.orderedLegs[0].legKmFromPrev, 0, "factory arrival is the quote anchor");
  assert.equal(billed.orderedLegs[0].quoteAnchor, true);
  assert.equal(billed.orderedLegs[1].legKmFromPrev, 30);
  assert.equal(billed.totalKm, 30, "positioning 40 + inbound 12 must not be billed");
  console.log("  ✓ factory start drops depot positioning km");
}

{
  const billed = billableRoute({ orderedLegs: legs, totalKm: 82 }, { info: {} });
  assert.equal(billed.quoteStart, "base");
  assert.equal(billed.excludedLegs.length, 0);
  assert.equal(billed.orderedLegs.length, 3);
  assert.equal(billed.totalKm, 82);
  console.log("  ✓ BMC-own trip keeps full route km");
}

{
  const noPickup = [
    { type: "positioning", legKmFromPrev: 8 },
    { type: "delivery", stopId: "obra", legKmFromPrev: 22 },
  ];
  const billed = billableRoute({ orderedLegs: noPickup }, { quoteStart: "factory" });
  assert.equal(billed.quoteStart, "factory");
  assert.equal(billed.excludedLegs.length, 0);
  assert.equal(billed.orderedLegs.length, 2);
  assert.equal(billed.totalKm, 30);
  console.log("  ✓ factory start without pickup keeps legs");
}

{
  const dirty = [
    { type: "pickup", legKmFromPrev: 0 },
    { type: "delivery", legKmFromPrev: -4 },
    { type: "delivery", legKmFromPrev: "x" },
    { type: "delivery", legKmFromPrev: 18 },
  ];
  const billed = billableRoute({ orderedLegs: dirty }, { quoteStart: "base" });
  assert.equal(billed.totalKm, 18, "zero / negative / NaN km are not billed");
  console.log("  ✓ invalid leg km excluded from total");
}

console.log("quoteWindow OK");
