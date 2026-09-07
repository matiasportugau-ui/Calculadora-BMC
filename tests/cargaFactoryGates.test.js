/**
 * Carga factory FSM edges left open by #1209 sequential happy-path tests.
 * Skip-ahead, unknown events, null timeline — CTA/eventType the PWA posts.
 * Run: node tests/cargaFactoryGates.test.js
 */
import assert from "node:assert/strict";
import {
  FACTORY_STEPS,
  cargaFactoryView,
  eventTypes,
  factoryPhase,
} from "../src/utils/logistica/cargaFactoryStep.js";

console.log("cargaFactoryGates");

{
  assert.equal(factoryPhase(undefined), 0);
  assert.equal(factoryPhase(null), 0);
  const v = cargaFactoryView(undefined);
  assert.equal(v.complete, false);
  assert.equal(v.eventType, "factory_arrived");
  assert.equal(v.cta, "Llegué a fábrica");
  assert.equal(v.currentIndex, 1);
  console.log("  ✓ null/undefined timeline → step 1, no throw");
}

{
  const types = eventTypes(null);
  assert.equal(types.size, 0);
  const withJunk = eventTypes([{ event_type: "location_ping" }, {}]);
  assert.equal(withJunk.has("location_ping"), true);
  assert.equal(withJunk.has(undefined), true);
  console.log("  ✓ eventTypes: null timeline empty; unknown types kept in set");
}

{
  const v = cargaFactoryView([{ event_type: "factory_departed" }]);
  assert.equal(factoryPhase([{ event_type: "factory_departed" }]), 4);
  assert.equal(v.complete, true);
  assert.equal(v.cta, null);
  assert.equal(v.eventType, null);
  assert.equal(v.currentIndex, 4);
  assert.equal(v.counter, "4 de 4");
  assert.equal(v.steps.every((s) => s.done), true);
  assert.equal(v.steps.every((s) => s.current === false), true);
  console.log("  ✓ departed-only skip-ahead → complete, no further CTA");
}

{
  const v = cargaFactoryView([{ event_type: "load_completed" }]);
  assert.equal(v.complete, false);
  assert.equal(v.eventType, "factory_departed");
  assert.equal(v.cta, "Salí de fábrica");
  assert.equal(v.counter, "4 de 4");
  assert.equal(v.steps[0].done, true);
  assert.equal(v.steps[1].done, true);
  assert.equal(v.steps[2].done, true);
  assert.equal(v.steps[3].current, true);
  console.log("  ✓ load_completed without arrived → phase 3, next is departed");
}

{
  const v = cargaFactoryView([
    { event_type: "location_ping" },
    { event_type: "presence" },
    { event_type: "delivery_completed" },
    { event_type: "not_a_factory_event" },
  ]);
  assert.equal(v.complete, false);
  assert.equal(v.eventType, "factory_arrived");
  assert.equal(v.cta, "Llegué a fábrica");
  assert.equal(v.steps[0].current, true);
  console.log("  ✓ GPS/presence/delivery events do not advance factory CTA");
}

{
  const v = cargaFactoryView([
    { event_type: "load_started" },
    { event_type: "factory_arrived" },
  ]);
  assert.equal(factoryPhase([{ event_type: "load_started" }]), 2);
  assert.equal(v.eventType, "load_completed");
  assert.equal(v.cta, "Carga lista");
  assert.equal(v.steps[1].done, true);
  assert.equal(v.steps[2].current, true);
  console.log("  ✓ highest factory event wins regardless of timeline order");
}

{
  assert.equal(FACTORY_STEPS.length, 4);
  const v = cargaFactoryView([]);
  assert.equal(v.steps.length, 4);
  assert.equal(v.steps[0].n, 1);
  assert.equal(v.steps[3].n, 4);
  assert.equal(v.steps[3].type, "factory_departed");
  console.log("  ✓ FACTORY_STEPS stay 1..4 factory_arrived→departed");
}

console.log("cargaFactoryGates OK");
