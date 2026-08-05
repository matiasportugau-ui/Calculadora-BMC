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
  resolveBridgeHandoff,
  bridgePanelsFingerprint,
  BRIDGE_SCHEMA_VERSION,
  saveBridgePayload,
  loadBridgePayload,
  clearBridgePayload,
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
  const mem = new Map();
  const store = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
  const payload = buildBridgePayload({ destino: "X", panels: [panels[0]] });
  saveBridgePayload(payload, store);
  const kept = loadBridgePayload({ store, clear: false });
  assert.equal(kept.destino, "X");
  assert.ok(store.getItem(BRIDGE_STORAGE_KEY));
  clearBridgePayload(store);
  assert.equal(store.getItem(BRIDGE_STORAGE_KEY), null);
  ok("load clear:false + clearBridgePayload after apply");
}

{
  assert.equal(stopHasLogisticsContent({ cliente: "A" }), true);
  assert.equal(stopHasLogisticsContent({ paneles: [{ cantidad: 1 }] }), true);
  assert.equal(stopHasLogisticsContent({ cliente: "", paneles: [] }), false);
  ok("stopHasLogisticsContent");
}

{
  const draft = [
    { id: "a", orden: 1, cliente: "Keep Me", paneles: [{ id: "p", cantidad: 2 }], color: "#111" },
    { id: "b", orden: 2, cliente: "Second", paneles: [], color: "#222" },
  ];
  const bridgeStops = [{ id: "br", cliente: "From Quote", direccion: "Maldonado", paneles: panels, color: "#999" }];
  const merged = mergeBridgeIntoStops(draft, bridgeStops, { colors: ["#111", "#222", "#333"] });
  assert.equal(merged.length, 3);
  assert.equal(merged[0].cliente, "Keep Me");
  assert.equal(merged[2].cliente, "From Quote");
  assert.equal(merged[2].orden, 3);
  assert.equal(merged[2].color, "#333");
  ok("mergeBridgeIntoStops appends when draft has content");
}

{
  const emptyDraft = [{ id: "placeholder", cliente: "", direccion: "", paneles: [] }];
  const bridgeStops = [{ id: "br", cliente: "Only", paneles: panels }];
  const replaced = mergeBridgeIntoStops(emptyDraft, bridgeStops);
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].cliente, "Only");
  ok("mergeBridgeIntoStops replaces empty draft");
}

{
  const kept = mergeBridgeIntoStops([{ id: "x", cliente: "Keep", paneles: [{ id: "p", cantidad: 1 }] }], []);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].cliente, "Keep");
  ok("mergeBridgeIntoStops noop on empty bridge");
}

{
  const fp = bridgePanelsFingerprint([
    { tipo: "B", espesor: 80, longitud: 5, cantidad: 2 },
    { tipo: "A", espesor: 100, longitud: 6, cantidad: 8 },
  ]);
  const fp2 = bridgePanelsFingerprint([
    { tipo: "A", espesor: 100, longitud: 6, cantidad: 8 },
    { tipo: "B", espesor: 80, longitud: 5, cantidad: 2 },
  ]);
  assert.equal(fp, fp2);
  ok("bridgePanelsFingerprint order-insensitive");
}

{
  // Stale lastQuote after destination edit must not win over live proyecto.
  const lastQuote = {
    destino: "Maldonado Centro",
    panels: [{ tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 8 }],
    quote: {
      ok: true,
      mode: "auto",
      ventaUsd: 280,
      summary: { zona: "maldonado_corredor", label: "1 fila Maldonado" },
    },
  };
  const handoff = resolveBridgeHandoff({
    lastQuote,
    proyecto: {
      cliente: "Obra Pocitos",
      direccion: "Montevideo Pocitos",
      departamento: "Montevideo",
    },
    livePanels: [{ tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 8 }],
    flete: 200,
    fleteCosto: "",
    summary: null,
  });
  assert.equal(handoff.destino, "Montevideo Pocitos Montevideo");
  assert.equal(handoff.proyectoRef.direccion, "Montevideo Pocitos");
  assert.equal(handoff.quote.mode, "manual");
  assert.equal(handoff.quote.ventaUsd, 200);
  assert.equal(handoff.quoteStale, true);
  const payload = buildBridgePayload(handoff);
  const { stops } = bridgePayloadToStops(payload, { uid: () => "s1" });
  assert.equal(stops[0].direccion, "Montevideo Pocitos Montevideo");
  ok("resolveBridgeHandoff prefers live destino after edit");
}

{
  // Matching live state may reuse the auto quote snapshot.
  const panels = [{ tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 8 }];
  const lastQuote = {
    destino: "Maldonado",
    panels,
    quote: { ok: true, mode: "auto", ventaUsd: 280, summary: { zona: "maldonado_corredor" } },
  };
  const handoff = resolveBridgeHandoff({
    lastQuote,
    proyecto: { direccion: "Maldonado", cliente: "X" },
    livePanels: panels,
    flete: 280,
  });
  assert.equal(handoff.quoteStale, false);
  assert.equal(handoff.quote.mode, "auto");
  assert.equal(handoff.quote.ventaUsd, 280);
  ok("resolveBridgeHandoff reuses quote when destino+panels match");
}

{
  // Stale cargo: live panels differ → do not ship lastQuote.panels.
  const lastQuote = {
    destino: "Maldonado",
    panels: [{ tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 8 }],
    quote: { ok: true, mode: "auto", ventaUsd: 280 },
  };
  const handoff = resolveBridgeHandoff({
    lastQuote,
    proyecto: { direccion: "Maldonado" },
    livePanels: [
      { tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 8 },
      { tipo: "ISOROOF", espesor: 50, longitud: 5, cantidad: 18 },
    ],
    flete: 525,
  });
  assert.equal(handoff.panels.length, 2);
  assert.equal(handoff.panels[1].cantidad, 18);
  assert.equal(handoff.quote.mode, "manual");
  assert.equal(handoff.quoteStale, true);
  ok("resolveBridgeHandoff prefers live panels when cargo drifts");
}

console.log(`\n${passed} assertions ok`);
