import assert from "node:assert/strict";
import {
  panelinChatPresentationForViewport,
  panelinMainSplitAutoSaveId,
} from "../src/utils/panelinChatLayoutStorage.js";
import {
  panelLayoutArrayToMap,
  toResizablePanelSize,
} from "../src/utils/resizablePanelsCompat.js";

assert.equal(
  panelinMainSplitAutoSaveId(false, true),
  "bmc-panelin-main-split-with-chat",
);
assert.equal(
  panelinMainSplitAutoSaveId(true, false),
  "bmc-panelin-main-split-compact",
);
assert.equal(
  panelinChatPresentationForViewport("floating", true),
  "sidebar",
);
assert.equal(
  panelinChatPresentationForViewport("floating", false),
  "floating",
);

assert.equal(toResizablePanelSize(35), "35%");
assert.equal(toResizablePanelSize("280px"), "280px");
assert.deepEqual(
  panelLayoutArrayToMap(["panelin-left", "panelin-results", "panelin-chat"], [24, 52, 24]),
  {
    "panelin-left": 24,
    "panelin-results": 52,
    "panelin-chat": 24,
  },
);
assert.equal(
  panelLayoutArrayToMap(["panelin-left", "panelin-results"], [24, 52, 24]),
  undefined,
);

console.log("panelinChatLayoutStorage.test.js: ok");