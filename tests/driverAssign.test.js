/**
 * Run: node tests/driverAssign.test.js
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  uyWhatsAppDigits,
  driverAssignWhatsAppUrl,
  openDriverAssign,
  resolveDriverUrlForAssign,
} from "../src/utils/logistica/driverAssign.js";
import {
  buildLogisticaAgentUrl,
  isLogisticaAgentWindow,
} from "../src/utils/logistica/openLogisticaAgentWindow.js";

console.log("driverAssign");

assert.equal(uyWhatsAppDigits("099 123 456"), "59899123456");
assert.equal(uyWhatsAppDigits("+59899123456"), "59899123456");
assert.equal(uyWhatsAppDigits(""), "");

const wa = driverAssignWhatsAppUrl({
  phone: "099111222",
  driverUrl: "http://localhost:5174/conductor?t=abc",
  tripLabel: "ENV-1",
});
assert.ok(wa.startsWith("https://wa.me/59899111222?text="));
assert.ok(decodeURIComponent(wa).includes("/conductor?t=abc"));
assert.ok(decodeURIComponent(wa).includes("ENV-1"));

const opened = [];
const r = openDriverAssign({
  phone: "099111222",
  driverUrl: "https://calculadora-bmc.vercel.app/conductor?t=tok",
  tripLabel: "R1",
  open: (u) => opened.push(u),
  copy: () => {},
});
assert.equal(opened.length, 2);
assert.equal(opened[0], r.driverUrl);
assert.ok(opened[1].startsWith("https://wa.me/"));

{
  // Stale React state must not win over a freshly fetched retry URL.
  const fresh = "https://calculadora-bmc.vercel.app/conductor?t=fresh";
  assert.equal(
    resolveDriverUrlForAssign({ cachedUrl: "", fetchedUrl: fresh }),
    fresh,
  );
  assert.equal(
    resolveDriverUrlForAssign({ cachedUrl: "", fetchedUrl: null }),
    "",
  );
  assert.equal(
    resolveDriverUrlForAssign({
      cachedUrl: "https://x/conductor?t=old",
      fetchedUrl: fresh,
    }),
    fresh,
  );
  // No tokenless fallback invented here — empty stays empty.
  assert.equal(resolveDriverUrlForAssign({}), "");
  console.log("  ✓ resolveDriverUrlForAssign prefers fetched URL, no tokenless invent");
}

{
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const logistica = readFileSync(join(root, "src/components/BmcLogisticaApp.jsx"), "utf8");
  assert.ok(logistica.includes("resolveDriverUrlForAssign"));
  assert.ok(logistica.includes("await retryDriverLink()"));
  assert.ok(!logistica.includes("conductorPublicUrl(window.location.origin, \"\")"));
  assert.ok(logistica.includes("isLogisticaAgentWindow()"));
  assert.ok(logistica.includes("data-testid=\"logistica-agent-window\""));
  assert.ok(logistica.includes("<LogisticaTruckerAgent\n          fill"));
  assert.ok(logistica.includes("faceOnly"));
  console.log("  ✓ BmcLogisticaApp wires retry return + agentWindow full chat");
}

{
  const map = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../src/components/logistica/wizard/RouteLeafletMap.jsx"),
    "utf8",
  );
  assert.ok(map.includes("createElement(\"span\")"));
  assert.ok(map.includes("tip.textContent"));
  assert.ok(!map.includes("m.bindTooltip(`${i + 1}. ${leg.label"));
  console.log("  ✓ RouteLeafletMap tooltips use textContent (no HTML interpolate)");
}

{
  const url = buildLogisticaAgentUrl({ origin: "https://example.test", draft: "ENV-9" });
  assert.ok(url.includes("agentWindow=1"));
  assert.ok(url.includes("draft=ENV-9"));
  assert.equal(isLogisticaAgentWindow(), false);
  console.log("  ✓ agent window URL builder");
}

console.log("driverAssign: passed");
