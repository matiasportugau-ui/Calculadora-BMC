/**
 * Rioplatense trip-plan preview copy (no WA).
 * Run: node tests/tripPlanFormat.test.js
 */
import assert from "node:assert/strict";
import { formatTripPlanPreview } from "../src/utils/logistica/tripPlanFormat.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("tripPlanFormat");

{
  const text = formatTripPlanPreview(null);
  assert.match(text, /No armo ruta todavía/);
  assert.match(text, /Faltan datos de una parada/);
  ok("null preview is blocked copy");
}

{
  const text = formatTripPlanPreview({
    status: "blocked",
    blocks: [{ id: "geo-mix", label: "Este y oeste en el mismo viaje" }],
  });
  assert.match(text, /No armo ruta todavía/);
  assert.match(text, /Este y oeste en el mismo viaje/);
  assert.ok(!text.includes("¿Aplico este plan?"));
  ok("blocked uses first block label");
}

{
  const text = formatTripPlanPreview({
    why: "Primero levante Kingspan.",
    strategy: "doorPriority",
    cabe: true,
    roadUnverified: false,
    unloadStopIds: ["s1", "s2"],
    route: {
      totalKm: 87.4,
      orderedLegs: [
        { type: "pickup", label: "Kingspan" },
        { type: "delivery", addressText: "Calle 12, Maldonado" },
        { type: "depot", label: "BMC URUGUAY" },
      ],
    },
  });
  assert.match(text, /Primero levante Kingspan/);
  assert.match(text, /1\. Levante: Kingspan/);
  assert.match(text, /2\. Entrega: Calle 12, Maldonado/);
  assert.match(text, /3\. Depo: BMC URUGUAY/);
  assert.match(text, /~87 km/);
  assert.match(text, /calles/);
  assert.match(text, /Carga: Acceso rápido · entra/);
  assert.match(text, /Descarga: 2 parada/);
  assert.match(text, /¿Aplico este plan\?/);
  ok("ok preview: legs, km, strategy, unload");
}

{
  const text = formatTripPlanPreview({
    strategy: "compact",
    cabe: false,
    roadUnverified: true,
    route: { orderedLegs: [{ type: "base", refId: "base-1" }] },
  });
  assert.match(text, /1\. Base: base-1/);
  assert.match(text, /sin km/);
  assert.match(text, /aire \(calles no verificadas\)/);
  assert.match(text, /Carga: Compacto/);
  assert.ok(!text.includes("· entra"));
  assert.ok(!text.includes("Descarga:"));
  ok("unverified km + compact without cabe");
}

console.log(`tripPlanFormat: ${passed} passed`);
