/**
 * Free-Drag long-press arm/disarm guards — Bug AO (PR #906 race).
 */
import assert from "node:assert/strict";
import {
  canFireLongPressDrag,
  shouldCancelLongPress,
} from "../src/utils/logistica/freeDragLongPress.js";

// Release before fire: armed cleared → must not begin drag
assert.equal(
  canFireLongPressDrag({ armedPointerId: null, eventPointerId: 1 }),
  false,
  "disarmed press must not fire long-press drag",
);

// Happy path: same pointer still armed
assert.equal(
  canFireLongPressDrag({ armedPointerId: 7, eventPointerId: 7 }),
  true,
  "armed matching pointer may fire",
);

// Different pointer (multi-touch) must not steal drag
assert.equal(
  canFireLongPressDrag({ armedPointerId: 1, eventPointerId: 2 }),
  false,
  "mismatched pointerId must not fire",
);

// Already dragging — ignore late timer
assert.equal(
  canFireLongPressDrag({
    armedPointerId: 1,
    eventPointerId: 1,
    alreadyDragging: true,
  }),
  false,
  "alreadyDragging blocks second beginDrag",
);

// Move cancel threshold
assert.equal(shouldCancelLongPress(100, 100, 105, 100), false);
assert.equal(shouldCancelLongPress(100, 100, 113, 100), true);
assert.equal(shouldCancelLongPress(null, 100, 200, 200), false);

console.log("freeDragLongPress.test.js: ok");
