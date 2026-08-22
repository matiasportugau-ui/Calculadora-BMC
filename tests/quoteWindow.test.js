/**
 * Run: node tests/quoteWindow.test.js
 */
import assert from "node:assert/strict";
import { quoteStartForTrip, billableRoute } from "../src/utils/logistica/quoteWindow.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("quoteWindow");

{
  assert.equal(quoteStartForTrip({}), "base");
  assert.equal(quoteStartForTrip({ tercerizado: true }), "factory");
  assert.equal(quoteStartForTrip({ tercerizado: true, quoteStart: "base" }), "base");
  assert.equal(quoteStartForTrip({ quoteStart: "factory" }), "factory");
  ok("quoteStartForTrip");
}

{
  const route = {
    orderedLegs: [
      { type: "base", label: "Depósito BMC", legKmFromPrev: null },
      { type: "pickup", label: "Kingspan", legKmFromPrev: 100.5 },
      { type: "delivery", label: "Darío", legKmFromPrev: 82.4 },
      { type: "pickup", label: "Montfrío", legKmFromPrev: 10 },
    ],
    totalKm: 192.9,
  };
  const billed = billableRoute(route, { info: { tercerizado: true } });
  assert.equal(billed.quoteStart, "factory");
  assert.equal(billed.orderedLegs[0].label, "Kingspan");
  assert.equal(billed.orderedLegs[0].legKmFromPrev, 0);
  assert.equal(billed.excludedLegs.length, 1);
  assert.equal(Math.round(billed.totalKm), 92);
  ok("tercerizado drops depot→factory km");
}

{
  const route = {
    orderedLegs: [
      { type: "base", label: "Depósito BMC", legKmFromPrev: null },
      { type: "pickup", label: "Kingspan", legKmFromPrev: 100 },
    ],
    totalKm: 100,
  };
  const own = billableRoute(route, { info: {} });
  assert.equal(own.quoteStart, "base");
  assert.equal(own.orderedLegs.length, 2);
  assert.equal(own.totalKm, 100);
  ok("own fleet keeps depot start");
}

console.log(`quoteWindow: ${passed} passed`);
