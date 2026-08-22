/**
 * Leaflet tooltip XSS guard — plain text only.
 * Run: node tests/routeMapTooltip.test.js
 */
import assert from "node:assert/strict";
import {
  createLeafletTextTooltip,
  routePinTooltipText,
} from "../src/utils/logistica/routeMapTooltip.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("routeMapTooltip");

{
  assert.equal(
    routePinTooltipText({ label: "Alvaro Gonzalez" }, 0),
    "1. Alvaro Gonzalez",
  );
  assert.equal(
    routePinTooltipText({ label: "B", geo: { source: "manual" } }, 2),
    "3. B · pin aprox. (movido)",
  );
  ok("routePinTooltipText formats index + label");
}

{
  const xss = '<img src=x onerror=alert(1)>';
  const text = routePinTooltipText({ label: xss }, 0);
  assert.equal(text, `1. ${xss}`);
  ok("routePinTooltipText keeps raw label (escaping is via textContent)");
}

{
  let createdTag = "";
  let assigned = "";
  let innerHtmlSet = false;
  const fakeDoc = {
    createElement(tag) {
      createdTag = tag;
      return {
        set textContent(v) {
          assigned = String(v);
        },
        get textContent() {
          return assigned;
        },
        set innerHTML(_v) {
          innerHtmlSet = true;
        },
      };
    },
  };
  const payload = '<img src=x onerror=alert(document.domain)>';
  const el = createLeafletTextTooltip(`1. ${payload}`, fakeDoc);
  assert.equal(createdTag, "span");
  assert.equal(el.textContent, `1. ${payload}`);
  assert.equal(innerHtmlSet, false);
  ok("createLeafletTextTooltip uses textContent only (no innerHTML)");
}

console.log(`routeMapTooltip ${passed} ok`);
