import assert from "node:assert/strict";
import {
  panelinChatPresentationForViewport,
  panelinMainSplitAutoSaveId,
} from "../src/utils/panelinChatLayoutStorage.js";

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

console.log("panelinChatLayoutStorage.test.js: ok");