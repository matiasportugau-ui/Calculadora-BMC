/**
 * Run: node tests/viewportBreakpoints.test.js
 */
import assert from "node:assert/strict";
import {
  VIEWPORT,
  isCompactMainLayoutWidth,
  isLogisticaCompactLayoutWidth,
  isLogisticaRegularLayoutWidth,
} from "../src/constants/viewportBreakpoints.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("viewportBreakpoints");

{
  assert.equal(VIEWPORT.LOGISTICA_COMPACT_MAX_PX, 767);
  assert.equal(VIEWPORT.LOGISTICA_REGULAR_MIN_PX, 768);
  assert.equal(VIEWPORT.LOGISTICA_WIDE_MIN_PX, 1024);
  assert.equal(VIEWPORT.MOBILE_LAYOUT_MAX_PX, 1023);
  ok("logistica constants distinct from calculator 1023");
}

{
  assert.equal(isLogisticaCompactLayoutWidth(390), true);
  assert.equal(isLogisticaCompactLayoutWidth(767), true);
  assert.equal(isLogisticaCompactLayoutWidth(768), false);
  assert.equal(isLogisticaRegularLayoutWidth(768), true);
  assert.equal(isLogisticaRegularLayoutWidth(1023), true);
  assert.equal(isLogisticaRegularLayoutWidth(1024), false);
  ok("logistica compact/regular bands");
}

{
  assert.equal(isCompactMainLayoutWidth(768), true);
  assert.equal(isCompactMainLayoutWidth(1023), true);
  assert.equal(isCompactMainLayoutWidth(1024), false);
  ok("calculator compact unchanged at 1023");
}

console.log(`viewportBreakpoints: ${passed} passed`);
