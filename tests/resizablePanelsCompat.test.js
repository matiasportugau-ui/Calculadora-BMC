import assert from "node:assert/strict";
import {
  layoutArrayToObject,
  layoutObjectToArray,
  panelPercentSize,
} from "../src/components/ResizablePanelsCompat.jsx";

assert.equal(panelPercentSize(35), "35%");
assert.equal(panelPercentSize("280px"), "280px");
assert.equal(panelPercentSize(undefined), undefined);

assert.deepEqual(
  layoutArrayToObject(["panel-0", "panel-1", "panel-2"], [24, 52, 24]),
  { "panel-0": 24, "panel-1": 52, "panel-2": 24 },
);

assert.deepEqual(
  layoutArrayToObject(["panel-0", "panel-1"], [28, Number.NaN]),
  { "panel-0": 28 },
);

assert.deepEqual(
  layoutObjectToArray(["panel-0", "panel-1"], { "panel-0": 35, "panel-1": 65 }),
  [35, 65],
);

assert.deepEqual(
  layoutObjectToArray(["panel-0", "panel-1"], { "panel-1": 65 }),
  [65],
);

console.log("resizablePanelsCompat.test.js: ok");
