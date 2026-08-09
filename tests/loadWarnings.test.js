/**
 * Run: node tests/loadWarnings.test.js
 */
import assert from "node:assert/strict";
import {
  createLoadWarning,
  appendLoadWarning,
  formatLoadWarningsForPlan,
  warningFromLengthCheck,
  LOAD_WARNING_CODES,
} from "../src/utils/logistica/loadWarnings.js";

let passed = 0;
function ok(n) {
  passed += 1;
  console.log(`  ✓ ${n}`);
}

console.log("loadWarnings");

const w = createLoadWarning({
  code: LOAD_WARNING_CODES.LENGTH_ON_SHORTER,
  packageKeys: ["k1"],
  acknowledged: true,
  meta: { upperLen: 7, supportLen: 6 },
});
assert.equal(w.acknowledged, true);
assert.ok(w.message.includes("7") || w.message.includes("Limitante"));
ok("createLoadWarning");

const list = appendLoadWarning([], warningFromLengthCheck({ upperLen: 7, supportLen: 6 }, ["a", "b"]));
assert.equal(list.length, 1);
assert.equal(list[0].code, "length_on_shorter");
const lines = formatLoadWarningsForPlan(list);
assert.ok(lines[0].includes("⚠"));
ok("append + format plan");

console.log(`\nloadWarnings: ${passed} passed`);
