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
  pickupIdForStop,
  partitionLevantes,
  consolidateLevantes,
  originLabelForStop,
  placeLabel,
} from "../src/utils/logistica/wizardState.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("wizardState");

{
  const w = createWizardUi();
  assert.equal(w.singlePickup, false);
  assert.equal(createWizardUi({ singlePickup: true }).singlePickup, true);
  ok("default origin is per-carga (singlePickup false)");
}

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
  assert.equal(
    isLevantesComplete([{ pickupPointId: "a" }, { pickupPointId: "" }], {
      singlePickup: false,
      unassignedPickupApproved: true,
    }),
    true,
  );
  ok("levantes complete single/multi");
}

{
  const stops = [
    { id: "1", cliente: "Alvaro", pickupPointId: "k" },
    { id: "2", cliente: "Abril", pickupPointId: "m" },
    { id: "3", cliente: "Burroso", pickupPointId: "" },
  ];
  const w = { singlePickup: false };
  const places = [
    { id: "k", label: "Kingspan (Bromyros)" },
    { id: "m", label: "Montfrío" },
  ];
  assert.equal(pickupIdForStop(stops[0], w), "k");
  const part = partitionLevantes(stops, w);
  assert.equal(part.assigned.length, 2);
  assert.equal(part.missing.length, 1);
  const cons = consolidateLevantes(stops, w, places);
  assert.equal(cons.groups.length, 2);
  assert.equal(cons.missing[0].cliente, "Burroso");
  const hints = stepMissingHints("levantes", { stops, wizard: w });
  assert.ok(hints.some((h) => /sin origen/i.test(h)));
  assert.equal(stepMissingHints("levantes", { stops, wizard: { ...w, unassignedPickupApproved: true } }).length, 0);
  const after = stops.map((s) => (s.id === "3" ? { ...s, pickupPointId: "k" } : s));
  const cons2 = consolidateLevantes(after, w, places);
  assert.equal(cons2.groups.length, 2);
  assert.equal(cons2.groups.find((g) => g.id === "k").stops.length, 2);
  assert.equal(cons2.missing.length, 0);
  ok("levantes consolidate + adrede approval");
}

{
  const places = [{ id: "k", label: "Kingspan (Bromyros)" }];
  const stop = { id: "1", cliente: "Alvaro", pickupPointId: "k" };
  assert.equal(placeLabel(places, "k"), "Kingspan (Bromyros)");
  assert.equal(originLabelForStop(stop, { singlePickup: false }, places), "Kingspan (Bromyros)");
  assert.equal(originLabelForStop({ id: "2" }, { singlePickup: false }, places), "");
  assert.equal(
    originLabelForStop({ id: "3" }, { singlePickup: true, defaultPickupPointId: "k" }, places),
    "Kingspan (Bromyros)",
  );
  ok("originLabelForStop + placeLabel");
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
  assert.equal(shouldEnableWizard({}), false);
  assert.equal(shouldEnableWizard({ stops: [] }), false);
  assert.equal(shouldEnableWizard({ stops: [{ a: 1 }], uiWizard: { enabled: false } }), false);
  assert.equal(shouldEnableWizard({ uiWizard: { enabled: true } }), true);
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
