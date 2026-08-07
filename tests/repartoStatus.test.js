import assert from "node:assert/strict";
import {
  canTransitionReparto,
  applyRepartoTransition,
  canConfirmReparto,
  confirmRevisionGate,
  shouldAbortConfirmAfterPresave,
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
// Identity is ok for FSM helpers, but confirm must reject re-confirm (immutable snapshot)
assert.equal(applyRepartoTransition("coordinado", "coordinado").ok, true);
assert.equal(canConfirmReparto("en_coordinacion"), true);
assert.equal(canConfirmReparto("coordinado"), false);
assert.equal(canConfirmReparto("cerrado"), false);
assert.equal(canConfirmReparto("cancelado"), false);
assert.equal(canConfirmReparto("draft"), false);
ok("transitions");

// Bug AU — stale confirm must not freeze outdated payload
assert.equal(confirmRevisionGate(5, null).ok, true);
assert.equal(confirmRevisionGate(5, undefined).expected, null);
assert.equal(confirmRevisionGate(6, 6).ok, true);
assert.equal(confirmRevisionGate(6, 5).ok, false);
assert.equal(confirmRevisionGate(6, 5).error, "conflict");
assert.equal(confirmRevisionGate(6, 5).revision, 6);
assert.equal(confirmRevisionGate(6, "abc").error, "invalid_revision");
assert.equal(shouldAbortConfirmAfterPresave({ ok: true, revision: 6 }), false);
assert.equal(shouldAbortConfirmAfterPresave({ ok: false, error: "conflict" }), true);
assert.equal(shouldAbortConfirmAfterPresave(undefined), true);
ok("confirm revision gate + abort after failed presave (Bug AU)");

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
