/**
 * Envíos G-U3 — STOP_STATUS FSM
 * Run: node tests/stopStatusFsm.test.js
 */
import assert from "node:assert/strict";
import {
  STOP_STATUS,
  toFsmState,
  canTransition,
  assertTransition,
  statusSelectOptions,
  applyStatusTransition,
} from "../src/utils/logistica/stopStatusFsm.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("stopStatusFsm");

{
  assert.ok(STOP_STATUS.includes("Pendiente"));
  assert.ok(STOP_STATUS.includes("Entregada"));
  assert.equal(toFsmState("Cargada"), "Dispatched");
  assert.equal(toFsmState("En reparto"), "InTransit");
  ok("map STOP_STATUS → FSM");
}

{
  assert.equal(canTransition("Pendiente", "Lista para carga"), true);
  assert.equal(canTransition("Pendiente", "Cargada"), true);
  assert.equal(canTransition("Cargada", "En reparto"), true);
  assert.equal(canTransition("En reparto", "Entregada"), true);
  ok("happy path forward chain");
}

{
  assert.equal(canTransition("Entregada", "Pendiente"), false);
  assert.equal(canTransition("Entregada", "En reparto"), false);
  assert.equal(canTransition("Cargada", "Pendiente"), false); // skip back >1
  ok("illegal jumps blocked");
}

{
  assert.equal(canTransition("En reparto", "Cargada"), true); // one step back
  assert.equal(canTransition("Lista para carga", "Pendiente"), true);
  ok("single-step back allowed");
}

{
  assert.equal(canTransition("Cargada", "Observada"), true);
  assert.equal(canTransition("Observada", "En reparto"), true);
  assert.equal(canTransition("Observada", "Entregada"), false);
  ok("Observada side-state");
}

{
  assert.equal(canTransition("Entregada", "Observada", { adminOverride: true }), true);
  assert.equal(canTransition("Pendiente", "Cargada", { listaParaCarga: false }), false);
  assert.equal(canTransition("Pendiente", "Lista para carga", { formValid: false }), false);
  ok("guards + admin override");
}

{
  const r = assertTransition("Entregada", "Pendiente");
  assert.equal(r.ok, false);
  assert.ok(String(r.error).includes("transicion_invalida"));
  ok("assertTransition error shape");
}

{
  const opts = statusSelectOptions("Entregada");
  const pendiente = opts.find((o) => o.value === "Pendiente");
  assert.equal(pendiente.disabled, true);
  const same = opts.find((o) => o.value === "Entregada");
  assert.equal(same.disabled, false);
  ok("statusSelectOptions disables illegal");
}

{
  const applied = applyStatusTransition("Pendiente", "Entregada");
  // multi-step forward is allowed by default
  assert.equal(applied.changed, true);
  assert.equal(applied.status, "Entregada");
  const blocked = applyStatusTransition("Entregada", "Pendiente");
  assert.equal(blocked.changed, false);
  assert.equal(blocked.status, "Entregada");
  ok("applyStatusTransition");
}

console.log(`\n${passed} assertions ok`);
