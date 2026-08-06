/**
 * Envíos — safeExternalHref / safeTelHref
 * Run: node tests/safeHref.test.js
 */
import assert from "node:assert/strict";
import { safeExternalHref, safeTelHref } from "../src/utils/logistica/safeHref.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("safeHref");

{
  assert.equal(safeExternalHref("https://www.google.com/maps/search/?api=1&query=X"), "https://www.google.com/maps/search/?api=1&query=X");
  assert.equal(safeExternalHref("http://example.com/a"), "http://example.com/a");
  assert.equal(safeExternalHref("javascript:alert(1)"), "");
  assert.equal(safeExternalHref("Javascript:alert(1)"), "");
  assert.equal(safeExternalHref(" data:text/html,<script>alert(1)</script>"), "");
  assert.equal(safeExternalHref("vbscript:msgbox(1)"), "");
  assert.equal(safeExternalHref("//evil.example/path"), "");
  assert.equal(safeExternalHref("/relative/path"), "");
  assert.equal(safeExternalHref(""), "");
  assert.equal(safeExternalHref(null), "");
  ok("safeExternalHref allowlist");
}

{
  assert.equal(safeTelHref("+598 99 123 456"), "tel:+59899123456");
  assert.equal(safeTelHref("(099) 123-456"), "tel:(099)123-456");
  assert.equal(safeTelHref("javascript:alert(1)"), "");
  assert.equal(safeTelHref("tel:+59899123456"), "");
  assert.equal(safeTelHref("abc"), "");
  assert.equal(safeTelHref(""), "");
  ok("safeTelHref");
}

console.log(`safeHref: ${passed} passed`);
