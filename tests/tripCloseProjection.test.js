import assert from "node:assert/strict";
import {
  allDeliveryStopsCompleted,
  deliveryStopIdsForClose,
} from "../server/lib/tripCloseProjection.js";

console.log("tripCloseProjection");

{
  const needed = deliveryStopIdsForClose({
    stops: [
      { id: "pick-1", kind: "levante", cliente: "Kingspan" },
      { id: "del-1", cliente: "Silva", orderId: "BMC-1" },
      { id: "del-2", cliente: "Obra", orderId: "BMC-2" },
    ],
  });
  assert.deepEqual(needed, ["del-1", "del-2"]);
  assert.equal(allDeliveryStopsCompleted(needed, ["del-1"]), false);
  assert.equal(allDeliveryStopsCompleted(needed, ["del-1", "del-2"]), true);
  // Completing the pickup must not satisfy close — deliveries still open
  assert.equal(allDeliveryStopsCompleted(needed, ["pick-1", "del-1"]), false);
  console.log("  ✓ pickup/levante excluded; all deliveries required");
}

{
  const needed = deliveryStopIdsForClose({
    stops: [
      { id: "p1", kind: "pickup", label: "Planta" },
      { id: "d1", cliente: "Cliente" },
    ],
  });
  assert.deepEqual(needed, ["d1"]);
  assert.equal(allDeliveryStopsCompleted(needed, ["d1"]), true);
  console.log("  ✓ kind=pickup excluded");
}

{
  assert.deepEqual(deliveryStopIdsForClose(null), []);
  assert.deepEqual(deliveryStopIdsForClose({}), []);
  assert.equal(allDeliveryStopsCompleted([], ["x"]), false);
  assert.equal(allDeliveryStopsCompleted(["a"], [null, "a"]), true);
  console.log("  ✓ empty / null stop_id edge cases");
}

console.log("tripCloseProjection OK");
