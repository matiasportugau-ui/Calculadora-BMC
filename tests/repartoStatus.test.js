import assert from "node:assert/strict";
import {
  canTransitionReparto,
  applyRepartoTransition,
  statusOnFirstStop,
  repartoStatusLabel,
  buildRepartoPayload,
  stopSummariesForReparto,
} from "../src/utils/logistica/repartoStatus.js";

let n = 0;
function ok(m) {
  n += 1;
  console.log(`  ✓ ${m}`);
}

console.log("repartoStatus");

assert.equal(canTransitionReparto("en_coordinacion", "coordinado"), true);
assert.equal(canTransitionReparto("coordinado", "en_coordinacion"), false);
assert.equal(applyRepartoTransition("en_coordinacion", "coordinado").ok, true);
assert.equal(applyRepartoTransition("cerrado", "coordinado").ok, false);
ok("transitions");

assert.equal(statusOnFirstStop("draft"), "en_coordinacion");
assert.equal(repartoStatusLabel("en_coordinacion"), "En Coordinación");
ok("labels");

const p = buildRepartoPayload({
  stops: [{ id: "s1", cliente: "A", orderId: "1" }],
  truckL: 12,
});
assert.equal(p.schema, "bmc-reparto-payload-v1");
assert.equal(p.stops.length, 1);
assert.equal(stopSummariesForReparto(p.stops)[0].cliente, "A");
ok("payload");

console.log(`\nrepartoStatus: ${n} passed`);
