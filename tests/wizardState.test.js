/**
 * Run: node tests/wizardState.test.js
 */
import assert from "node:assert/strict";
import {
  isPedidosComplete,
  isFlotaComplete,
  isLevantesComplete,
  isRutaComplete,
  isStepComplete,
  firstIncompleteStep,
  tryCompleteStep,
  stepMissingHints,
  stepSummary,
  shouldEnableWizard,
  applyDefaultPickupToStops,
  createWizardUi,
  adjacentStep,
} from "../src/utils/logistica/wizardState.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("wizardState");

{
  assert.equal(isPedidosComplete([]), false);
  assert.equal(isPedidosComplete([{ cliente: "A" }]), true);
  assert.equal(isPedidosComplete([{ orderId: "1" }]), true);
  assert.equal(isPedidosComplete([{ orderId: "" }]), false);
  ok("pedidos complete");
}

{
  assert.equal(isFlotaComplete({ transportista: "T", basePointId: "b1" }, 13), true);
  assert.equal(isFlotaComplete({ transportista: "T" }, 13), false);
  assert.equal(isFlotaComplete({ transportista: "T", basePointId: "b1" }, 0), false);
  ok("flota complete");
}

{
  const stops = [{ pickupPointId: "p1" }, { pickupPointId: "p1" }];
  assert.equal(isLevantesComplete(stops, { singlePickup: true, defaultPickupPointId: "p1" }), true);
  assert.equal(isLevantesComplete([{ a: 1 }], { singlePickup: true, defaultPickupPointId: "" }), false);
  assert.equal(
    isLevantesComplete([{ pickupPointId: "a" }, { pickupPointId: "" }], { singlePickup: false }),
    false,
  );
  ok("levantes complete single/multi");
}

{
  assert.equal(isRutaComplete({ orderedLegs: [{ label: "A" }, { label: "B" }] }), true);
  assert.equal(isRutaComplete({ orderedLegs: [{ label: "A" }] }), false);
  ok("ruta complete");
}

{
  const ctx = {
    stops: [{ cliente: "X" }],
    info: { transportista: "T", basePointId: "b" },
    truckL: 8,
    wizard: createWizardUi({ singlePickup: true, defaultPickupPointId: "p1" }),
    route: null,
  };
  assert.equal(firstIncompleteStep(ctx), "ruta");
  ok("firstIncompleteStep");
}

{
  const w = createWizardUi();
  const r = tryCompleteStep("pedidos", w, { stops: [] });
  assert.equal(r.ok, false);
  assert.ok(r.missing.length);
  const r2 = tryCompleteStep("pedidos", w, { stops: [{ orderId: "1" }] });
  assert.equal(r2.ok, true);
  assert.equal(r2.wizard.done.pedidos, true);
  assert.equal(r2.wizard.activeStep, "flota");
  ok("tryCompleteStep");
}

{
  assert.ok(stepMissingHints("flota", { info: {}, truckL: null }).length >= 2);
  assert.ok(stepSummary("pedidos", { stops: [{ cliente: "A" }, { cliente: "B" }] }).includes("2"));
  ok("missing hints + summary");
}

{
  assert.equal(shouldEnableWizard({ stops: [] }), true);
  assert.equal(shouldEnableWizard({ stops: [{ a: 1 }], uiWizard: { enabled: false } }), false);
  assert.equal(shouldEnableWizard({ stops: [{ a: 1 }], force: true }), true);
  ok("shouldEnableWizard");
}

{
  const next = applyDefaultPickupToStops([{ id: "1" }, { id: "2", pickupPointId: "x" }], "def");
  assert.equal(next[0].pickupPointId, "def");
  // Single-mode must overwrite stale per-stop pickups (wrong warehouse otherwise).
  assert.equal(next[1].pickupPointId, "def");
  ok("applyDefaultPickupToStops overwrites");
}

{
  assert.equal(adjacentStep("pedidos", "next"), "flota");
  assert.equal(adjacentStep("flota", "prev"), "pedidos");
  ok("adjacentStep");
}

{
  const ctx = {
    stops: [{ cliente: "A", pickupPointId: "p" }],
    info: { transportista: "T", basePointId: "b" },
    truckL: 13,
    wizard: createWizardUi({
      done: { pedidos: true, flota: true, levantes: true, ruta: false, carga: false },
      defaultPickupPointId: "p",
      routeStale: true,
    }),
    route: { orderedLegs: [{ label: "1" }, { label: "2" }] },
  };
  assert.equal(isStepComplete("ruta", ctx), false);
  ok("ruta incomplete when stale");
}

console.log(`wizardState: ${passed} passed`);
