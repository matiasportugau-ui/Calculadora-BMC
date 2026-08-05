/**
 * Quote→ops bridge pure tests (U2)
 * Run: node tests/bridgePayload.test.js
 */
import assert from "node:assert/strict";
import {
  buildBridgePayload,
  parseBridgePayload,
  bridgePayloadToStops,
  mergeBridgeStopsIntoDraft,
  BRIDGE_SCHEMA_VERSION,
  saveBridgePayload,
  loadBridgePayload,
  BRIDGE_STORAGE_KEY,
} from "../src/utils/logistica/bridgePayload.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("bridgePayload");

const panels = [
  { tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 8 },
  { tipo: "ISOPANEL", espesor: 80, longitud: 5, cantidad: 4 },
];

{
  const payload = buildBridgePayload({
    destino: "Maldonado",
    panels,
    quote: {
      ok: true,
      mode: "auto",
      ventaUsd: 280,
      summary: { zona: "maldonado_corredor", label: "test label" },
    },
    proyectoRef: { cliente: "Obra X", direccion: "Maldonado" },
  });
  assert.equal(payload.schemaVersion, BRIDGE_SCHEMA_VERSION);
  assert.equal(payload.destino, "Maldonado");
  assert.equal(payload.panels.length, 2);
  assert.equal(payload.panels[0].cantidad, 8);
  assert.equal(payload.quote.ventaUsd, 280);
  ok("buildBridgePayload");
}

{
  const payload = buildBridgePayload({ destino: "MVD", panels });
  const parsed = parseBridgePayload(JSON.stringify(payload));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.payload.destino, "MVD");
  assert.equal(parsed.payload.panels.length, 2);
  ok("parseBridgePayload round-trip");
}

{
  const bad = parseBridgePayload({ schemaVersion: 99, panels: [] });
  assert.equal(bad.ok, false);
  ok("reject unsupported schema");
}

{
  const payload = buildBridgePayload({
    destino: "Piriápolis",
    panels,
    quote: { ok: true, ventaUsd: 280, summary: { zona: "maldonado_corredor", label: "1 fila" } },
    proyectoRef: { cliente: "Cliente Z" },
  });
  const { stops, infoPatch } = bridgePayloadToStops(payload, { uid: (() => {
    let i = 0;
    return () => `id-${++i}`;
  })() });
  assert.equal(stops.length, 1);
  assert.equal(stops[0].direccion, "Piriápolis");
  assert.equal(stops[0].cliente, "Cliente Z");
  assert.equal(stops[0].paneles.length, 2);
  assert.equal(stops[0].paneles[0].longitud, 6);
  assert.equal(stops[0].paneles[0].cantidad, 8);
  assert.ok(String(infoPatch.notas || "").includes("cotización") || String(infoPatch.notas || "").includes("Import"));
  ok("bridgePayloadToStops matches panels + destino");
}

{
  // Memory store stand-in for sessionStorage
  const mem = new Map();
  const store = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
  const payload = buildBridgePayload({ destino: "Costa", panels: [panels[0]] });
  assert.equal(saveBridgePayload(payload, store), true);
  assert.ok(store.getItem(BRIDGE_STORAGE_KEY));
  const loaded = loadBridgePayload({ store, clear: true });
  assert.equal(loaded.destino, "Costa");
  assert.equal(store.getItem(BRIDGE_STORAGE_KEY), null);
  ok("sessionStorage-like save/load/clear");
}

{
  // Regression: bridge import must append, never wipe an existing multi-stop draft
  const existing = [
    { id: "old-1", orden: 1, cliente: "Parada A", paneles: [{ tipo: "ISODEC", cantidad: 4 }] },
    { id: "old-2", orden: 2, cliente: "Parada B", paneles: [{ tipo: "ISOPARED", cantidad: 2 }] },
  ];
  const payload = buildBridgePayload({
    destino: "Piriápolis",
    panels: [panels[0]],
    proyectoRef: { cliente: "Obra nueva" },
  });
  const { stops: bridgeStops } = bridgePayloadToStops(payload, {
    uid: (() => {
      let i = 0;
      return () => `br-${++i}`;
    })(),
  });
  const merged = mergeBridgeStopsIntoDraft(existing, bridgeStops, {
    colors: ["#111", "#222", "#333"],
  });
  assert.equal(merged.length, 3, "keeps prior stops + bridge");
  assert.equal(merged[0].cliente, "Parada A");
  assert.equal(merged[1].cliente, "Parada B");
  assert.equal(merged[2].cliente, "Obra nueva");
  assert.equal(merged[2].orden, 3);
  assert.equal(merged[2].color, "#333");
  ok("mergeBridgeStopsIntoDraft appends without wipe");
}

console.log(`\n${passed} assertions ok`);
