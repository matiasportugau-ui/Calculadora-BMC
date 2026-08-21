/**
 * Run: node tests/driverSessionDone.test.js
 */
import assert from "node:assert/strict";
import {
  allDeliveriesCompleted,
  deliveryStopsOf,
} from "../src/components/driver/useDriverSession.js";

console.log("driverSessionDone");

{
  const stops = [
    { id: "p1", kind: "levante", cliente: "Planta" },
    { id: "a", cliente: "A" },
    { id: "b", cliente: "B" },
  ];
  assert.equal(deliveryStopsOf(stops).length, 2);
  assert.equal(allDeliveriesCompleted([], stops), false);
  assert.equal(
    allDeliveriesCompleted([{ event_type: "delivery_completed", stop_id: "a" }], stops),
    false,
  );
  assert.equal(
    allDeliveriesCompleted(
      [
        { event_type: "delivery_completed", stop_id: "a" },
        { event_type: "delivery_completed", stop_id: "b" },
      ],
      stops,
    ),
    true,
  );
  // Trip-wide event without stop_id must not mark multi-stop done
  assert.equal(
    allDeliveriesCompleted([{ event_type: "delivery_completed" }], stops),
    false,
  );
  console.log("  ✓ allDeliveriesCompleted requires every delivery stop");
}

console.log("driverSessionDone OK");
