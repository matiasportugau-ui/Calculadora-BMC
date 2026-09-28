/**
 * Factory carga phase short-circuit. The ordered happy path lives in
 * cargaFactoryStep.test.js and still passes if a lone later event
 * stops marking every earlier step done.
 * Run: node tests/cargaFactoryPhaseGates.test.js
 */
import assert from "node:assert/strict";
import {
  FACTORY_STEPS,
  cargaFactoryView,
  factoryPhase,
} from "../src/utils/logistica/cargaFactoryStep.js";

console.log("cargaFactoryPhaseGates");

assert.equal(Object.isFrozen(FACTORY_STEPS), true);
assert.equal(factoryPhase(null), 0);
assert.equal(factoryPhase(undefined), 0);

{
  const view = cargaFactoryView(null);
  assert.equal(view.phase, 0);
  assert.equal(view.complete, false);
  assert.equal(view.counter, "1 de 4");
  assert.equal(view.cta, "Llegué a fábrica");
  assert.equal(view.eventType, "factory_arrived");
  assert.equal(view.currentIndex, 1);
  assert.equal(view.steps[0].current, true);
  assert.equal(view.steps[0].done, false);
  console.log("  ✓ null timeline is step 1, not a throw");
}

{
  const timeline = [{ event_type: "factory_departed" }];
  const view = cargaFactoryView(timeline);
  assert.equal(timeline.length, 1);
  assert.equal(view.phase, 4);
  assert.equal(view.complete, true);
  assert.equal(view.cta, null);
  assert.equal(view.eventType, null);
  assert.equal(view.counter, "4 de 4");
  assert.equal(view.currentIndex, 4);
  assert.equal(view.steps.every((s) => s.done && !s.current && s.status === "Completado"), true);
  console.log("  ✓ factory_departed alone completes all four steps");
}

{
  const view = cargaFactoryView([
    { event_type: "factory_arrived" },
    { event_type: "factory_departed" },
  ]);
  assert.equal(view.phase, 4);
  assert.equal(view.complete, true);
  assert.equal(view.cta, null);
  console.log("  ✓ a later arrived event does not reopen a departed trip");
}

{
  const view = cargaFactoryView([{ event_type: "load_completed" }]);
  assert.equal(view.phase, 3);
  assert.equal(view.complete, false);
  assert.equal(view.counter, "4 de 4");
  assert.equal(view.eventType, "factory_departed");
  assert.equal(view.cta, "Salí de fábrica");
  assert.equal(view.steps[0].done, true);
  assert.equal(view.steps[0].status, "Completado");
  assert.equal(view.steps[1].done, true);
  assert.equal(view.steps[2].done, true);
  assert.equal(view.steps[3].done, false);
  assert.equal(view.steps[3].current, true);
  assert.equal(view.steps[3].status, "En progreso");
  console.log("  ✓ load_completed alone marks 1–3 done and asks for departure");
}

{
  const view = cargaFactoryView([{ event_type: "load_started" }]);
  assert.equal(factoryPhase([{ event_type: "load_started" }, { event_type: "load_started" }]), 2);
  assert.equal(view.phase, 2);
  assert.equal(view.counter, "3 de 4");
  assert.equal(view.eventType, "load_completed");
  assert.equal(view.steps[0].done, true);
  assert.equal(view.steps[0].current, false);
  assert.equal(view.steps[1].done, true);
  assert.equal(view.steps[2].current, true);
  assert.equal(view.steps[2].status, "En progreso");
  console.log("  ✓ load_started alone is phase 2; a duplicate does not advance");
}

{
  const view = cargaFactoryView([{ event_type: "gps_ping" }, {}]);
  assert.equal(view.phase, 0);
  assert.equal(view.counter, "1 de 4");
  assert.equal(view.eventType, "factory_arrived");
  assert.equal(view.steps.filter((s) => s.done).length, 0);
  console.log("  ✓ unknown events leave the sequence at step 1");
}

{
  const view = cargaFactoryView([]);
  view.steps[0].label = "mutated";
  assert.equal(FACTORY_STEPS[0].label, "Llegué a fábrica");
  console.log("  ✓ view steps are copies of the frozen catalogue");
}

console.log("cargaFactoryPhaseGates OK");
