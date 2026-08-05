/**
 * Quote→ops bridge pure tests (U2)
 * Run: node tests/bridgePayload.test.js
 */
import assert from "node:assert/strict";
import {
  buildBridgePayload,
  parseBridgePayload,
  bridgePayloadToStops,
  mergeBridgeIntoStops,
  stopHasLogisticsContent,
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
  assert.equal(stopHasLogisticsContent({ paneles: [{ id: "p" }] }), true);
  assert.equal(stopHasLogisticsContent({ cliente: "Obra" }), true);
  assert.equal(stopHasLogisticsContent({ paneles: [], accesorios: [], cliente: "" }), false);
  ok("stopHasLogisticsContent");
}

{
  const draft = [
    {
      id: "s-existing",
      orden: 1,
      cliente: "Parada A",
      direccion: "MVD",
      paneles: [{ id: "p1", tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 4 }],
      accesorios: [],
    },
  ];
  const bridgeStops = [
    {
      id: "s-bridge",
      orden: 1,
      cliente: "Obra bridge",
      direccion: "Maldonado",
      paneles: [{ id: "p2", tipo: "ISODEC", espesor: 80, longitud: 5, cantidad: 8 }],
      accesorios: [],
    },
  ];
  const merged = mergeBridgeIntoStops(draft, bridgeStops, { colors: ["#111", "#222"] });
  assert.equal(merged.mode, "append");
  assert.equal(merged.stops.length, 2);
  assert.equal(merged.stops[0].id, "s-existing");
  assert.equal(merged.stops[0].cliente, "Parada A");
  assert.equal(merged.stops[1].id, "s-bridge");
  assert.equal(merged.stops[1].orden, 2);
  assert.equal(merged.stops[1].color, "#222");
  ok("mergeBridgeIntoStops appends when draft has content");
}

{
  const emptyDraft = [{ id: "blank", orden: 1, cliente: "", direccion: "", paneles: [], accesorios: [] }];
  const bridgeStops = [
    {
      id: "s-bridge",
      orden: 1,
      cliente: "Solo bridge",
      paneles: [{ id: "p2", tipo: "ISODEC", espesor: 80, longitud: 5, cantidad: 2 }],
      accesorios: [],
    },
  ];
  const replaced = mergeBridgeIntoStops(emptyDraft, bridgeStops);
  assert.equal(replaced.mode, "replace");
  assert.equal(replaced.stops.length, 1);
  assert.equal(replaced.stops[0].id, "s-bridge");
  ok("mergeBridgeIntoStops replaces empty draft");
}

{
  const kept = mergeBridgeIntoStops([{ id: "x", cliente: "Keep", paneles: [{ id: "p" }] }], []);
  assert.equal(kept.mode, "noop");
  assert.equal(kept.stops.length, 1);
  ok("mergeBridgeIntoStops noop on empty bridge");
}

console.log(`\n${passed} assertions ok`);
