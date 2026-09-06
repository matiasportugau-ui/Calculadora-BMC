/**
 * Carga factory step helper — 1:1 FSM mapping used by DriverLoadSequence.
 * Run: node tests/cargaFactoryStep.test.js
 */
import assert from "node:assert/strict";
import {
  FACTORY_STEPS,
  cargaFactoryView,
  factoryPhase,
} from "../src/utils/logistica/cargaFactoryStep.js";

console.log("cargaFactoryStep");

assert.deepEqual(
  FACTORY_STEPS.map((s) => s.type),
  ["factory_arrived", "load_started", "load_completed", "factory_departed"],
);

{
  const v = cargaFactoryView([]);
  assert.equal(factoryPhase([]), 0);
  assert.equal(v.complete, false);
  assert.equal(v.currentIndex, 1);
  assert.equal(v.counter, "1 de 4");
  assert.equal(v.cta, "Llegué a fábrica");
  assert.equal(v.eventType, "factory_arrived");
  assert.equal(v.steps[0].current, true);
  assert.equal(v.steps[0].status, "En progreso");
  console.log("  ✓ empty timeline → step 1 factory_arrived");
}

{
  const v = cargaFactoryView([{ event_type: "factory_arrived" }]);
  assert.equal(v.counter, "2 de 4");
  assert.equal(v.cta, "Inicié carga");
  assert.equal(v.eventType, "load_started");
  assert.equal(v.steps[0].done, true);
  assert.equal(v.steps[1].current, true);
  console.log("  ✓ after factory_arrived → 2 de 4 load_started");
}

{
  const v = cargaFactoryView([
    { event_type: "factory_arrived" },
    { event_type: "load_started" },
  ]);
  assert.equal(v.counter, "3 de 4");
  assert.equal(v.eventType, "load_completed");
  assert.equal(v.cta, "Carga lista");
  console.log("  ✓ after load_started → 3 de 4 load_completed");
}

{
  const v = cargaFactoryView([
    { event_type: "factory_arrived" },
    { event_type: "load_started" },
    { event_type: "load_completed" },
  ]);
  assert.equal(v.counter, "4 de 4");
  assert.equal(v.eventType, "factory_departed");
  assert.equal(v.cta, "Salí de fábrica");
  console.log("  ✓ after load_completed → 4 de 4 factory_departed");
}

{
  const v = cargaFactoryView([
    { event_type: "factory_arrived" },
    { event_type: "load_started" },
    { event_type: "load_completed" },
    { event_type: "factory_departed" },
  ]);
  assert.equal(v.complete, true);
  assert.equal(v.cta, null);
  assert.equal(v.eventType, null);
  assert.equal(v.counter, "4 de 4");
  assert.equal(factoryPhase(v.steps.map((s) => ({ event_type: s.type }))), 4);
  console.log("  ✓ all four events → complete, no CTA");
}

console.log("cargaFactoryStep OK");
