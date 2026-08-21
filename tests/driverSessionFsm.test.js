/**
 * Chofer PWA carga FSM — factoryPhase / eventTypes + allowlist used by POST /api/driver/events.
 * Run: node tests/driverSessionFsm.test.js
 */
import assert from "node:assert/strict";
import { eventTypes, factoryPhase } from "../src/components/driver/useDriverSession.js";
import { isAllowedDriverEventType } from "../server/lib/transportistaFsm.js";

console.log("driverSessionFsm");

{
  assert.equal(factoryPhase([]), 0);
  assert.equal(factoryPhase(undefined), 0);
  assert.equal(factoryPhase(null), 0);
  assert.equal(factoryPhase([{ event_type: "trip_assigned" }]), 0);
  console.log("  ✓ empty / unknown timeline is phase 0");
}

{
  assert.equal(factoryPhase([{ event_type: "factory_arrived" }]), 1);
  assert.equal(factoryPhase([{ event_type: "load_started" }]), 2);
  assert.equal(factoryPhase([{ event_type: "load_completed" }]), 3);
  assert.equal(factoryPhase([{ event_type: "factory_departed" }]), 4);
  console.log("  ✓ each factory event maps to its phase");
}

{
  const full = [
    { event_type: "factory_arrived" },
    { event_type: "load_started" },
    { event_type: "load_completed" },
    { event_type: "factory_departed" },
  ];
  assert.equal(factoryPhase(full), 4);
  assert.equal(factoryPhase(full.slice(0, 3)), 3);
  assert.equal(factoryPhase([{ event_type: "factory_departed" }, { event_type: "factory_arrived" }]), 4);
  console.log("  ✓ highest factory event wins (departed skips intermediates)");
}

{
  const t = eventTypes([
    { event_type: "factory_departed" },
    { event_type: "delivery_completed" },
    {},
  ]);
  assert.equal(t.has("factory_departed"), true);
  assert.equal(t.has("delivery_completed"), true);
  assert.equal(t.has(undefined), true);
  assert.equal(eventTypes(undefined).size, 0);
  console.log("  ✓ eventTypes set + empty/missing");
}

{
  const pwaTypes = [
    "factory_arrived",
    "load_started",
    "load_completed",
    "factory_departed",
    "stop_arrived",
    "delivery_completed",
    "incident_reported",
  ];
  for (const type of pwaTypes) {
    assert.equal(isAllowedDriverEventType(type), true, type);
  }
  assert.equal(isAllowedDriverEventType(""), false);
  assert.equal(isAllowedDriverEventType("not_an_event"), false);
  assert.equal(isAllowedDriverEventType("trip_assigned"), false);
  console.log("  ✓ PWA factory/delivery types stay on the driver ingest allowlist");
}

console.log("driverSessionFsm OK");
