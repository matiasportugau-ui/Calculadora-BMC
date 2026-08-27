/**
 * Structural checks of shipped SPA wiring for BMC Driver Loop.
 * Run: node tests/driverLoopRoutes.test.js
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(root, "src/App.jsx"), "utf8");
const redirect = readFileSync(join(root, "src/components/driver/ConductorLegacyRedirect.jsx"), "utf8");
const panel = readFileSync(join(root, "src/components/logistica/DriverLoopPanel.jsx"), "utf8");
const logistica = readFileSync(join(root, "src/components/BmcLogisticaApp.jsx"), "utf8");

console.log("driverLoopRoutes");

function routeBlock(src, pathLiteral) {
  const needle = `path="${pathLiteral}"`;
  const i = src.indexOf(needle);
  assert.ok(i >= 0, `missing route ${pathLiteral}`);
  const next = src.indexOf("path=\"", i + needle.length);
  return src.slice(i, next === -1 ? i + 800 : next);
}

{
  const conductor = routeBlock(app, "/conductor/*");
  assert.ok(conductor.includes("DriverApp"));
  assert.ok(!conductor.includes("<Shell>"), "/conductor/* must not wrap DriverApp in Shell");
  console.log("  ✓ /conductor/* is a PWA island (no Shell)");
}

{
  assert.ok(app.includes('path="/torre"'));
  assert.ok(app.includes("/logistica?vista=torre"));
  console.log("  ✓ /torre aliases logistica torre vista");
}

{
  const seg = routeBlock(app, "/seguimiento/:token");
  assert.ok(seg.includes("CustomerTrackPage"));
  assert.ok(!seg.includes("<Shell>"), "/seguimiento/:token must not wrap in Shell");
  console.log("  ✓ /seguimiento/:token public (no Shell)");
}

{
  const legacy = routeBlock(app, "/calculadora/conductor");
  assert.ok(legacy.includes("ConductorLegacyRedirect"));
  assert.ok(redirect.includes("useSearchParams"));
  assert.ok(redirect.includes('sp.get("t")'));
  assert.match(redirect, /\/conductor\?t=\$\{encodeURIComponent\(t\)\}/);
  console.log("  ✓ /calculadora/conductor preserves t= onto /conductor");
}

{
  assert.ok(panel.includes("Copiar enlace chofer"));
  assert.ok(panel.includes("result.driver_url"));
  assert.ok(panel.includes("customer_links"));
  assert.ok(logistica.includes("DriverLoopPanel"));
  assert.ok(logistica.includes("setDriverLoopResult"));
  console.log("  ✓ confirm surfaces copyable driver URL + customer links");
}

{
  const screens = [
    "DriverLogin.jsx",
    "DriverHome.jsx",
    "DriverLoadSequence.jsx",
    "DriverTripDone.jsx",
    "DriverProfile.jsx",
  ];
  for (const f of screens) {
    readFileSync(join(root, "src/components/driver", f));
  }
  console.log("  ✓ five chofer screens exist");
}

console.log("driverLoopRoutes OK");
