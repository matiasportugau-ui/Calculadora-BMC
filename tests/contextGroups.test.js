/**
 * Workspace kinds + slim payload shape.
 * Run: node tests/contextGroups.test.js
 */
import { TAB_KINDS } from "../src/hooks/useContextGroups.js";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}

const kinds = TAB_KINDS.map((k) => k.kind);
assert(kinds.includes("email") && kinds.includes("admin") && kinds.includes("calc"), "preset kinds");
assert(kinds.includes("screen") && kinds.includes("term") && kinds.includes("note"), "screen + term + note");
assert(TAB_KINDS.length === 6, "six add-tab options");

console.log(`\ncontextGroups: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
