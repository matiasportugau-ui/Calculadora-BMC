/**
 * Run: node tests/safeExternalUrl.test.js
 */
import assert from "node:assert/strict";
import { safeHttpUrl, safeTelUrl } from "../src/utils/logistica/safeExternalUrl.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("safeExternalUrl");

assert.equal(safeHttpUrl("https://maps.google.com/?q=1"), "https://maps.google.com/?q=1");
assert.equal(safeHttpUrl("javascript:alert(1)"), null);
assert.equal(safeHttpUrl("data:text/html,x"), null);
assert.ok(safeTelUrl("+59899111222")?.startsWith("tel:"));
assert.equal(safeTelUrl("123"), null);
ok("blocks dangerous schemes");

console.log(`safeExternalUrl: ${passed} passed`);
