/**
 * Run: node tests/adjuntoLineParse.test.js
 * Fixtures from Ventas multi-client training (Alvaro, Petinho classic, free-text ENCARGO).
 */
import assert from "node:assert/strict";
import {
  parseLogisticaFromAdjuntoText,
  parsePanelLineHeuristic,
  extractTipoFromLine,
} from "../docs/bmc-dashboard-modernization/logistica-carga-prototype/lib/adjuntoLineParse.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("adjuntoLineParse");

{
  const line = "ISODEC EPS 100mm · 10 paneles 113.68 m² 41.15 4,677.93";
  assert.equal(extractTipoFromLine(line), "ISODEC");
  const p = parsePanelLineHeuristic(line);
  assert.ok(p, "expected panel line");
  assert.equal(p.tipo, "ISODEC");
  assert.equal(p.espesor, 100);
  assert.equal(p.cantidad, 10, "10 paneles is qty, not length");
  assert.equal(p.longitud, 6, "default length when PDF has no panel length");
  ok("Alvaro product line: qty 10, esp 100, default length");
}

{
  const alcance = "Alcance: ISODEC EPS · 100mm · Color Blanco · Techo · 2 Zonas";
  assert.equal(parsePanelLineHeuristic(alcance), null, "skip Alcance / N Zonas summary");
  ok("skip Alcance summary line");
}

{
  const text = `BMC BMC URUGUAY
METALOG SAS
PRESUPUESTO
Cliente: Alvaro Gonzalez Fecha: 30/06/2026
Alcance: ISODEC EPS · 100mm · Color Blanco · Techo · 2 Zonas
113.7 m² · 10 paneles · 3 apoyos · 57 fijaciones
DESCRIPCIÓN CANT. UNID. P.U. USD TOTAL USD
PANELES 4,677.93
ISODEC EPS 100mm · 10 paneles 113.68 m² 41.15 4,677.93
Subtotal sin IVA USD 4,677.93`;
  const r = parseLogisticaFromAdjuntoText(text);
  assert.ok(r.paneles.length >= 1, `expected ≥1 panel, got ${r.paneles.length}`);
  const main = r.paneles.find((p) => p.cantidad === 10 && p.espesor === 100);
  assert.ok(main, `expected ISODEC 100×10, got ${JSON.stringify(r.paneles)}`);
  assert.equal(main.tipo, "ISODEC");
  assert.equal(
    r.paneles.filter((p) => p.tipo === "ISODEC").length,
    1,
    `expected single ISODEC line, got ${JSON.stringify(r.paneles)}`,
  );
  ok("full Alvaro PDF text → single ISODEC 100mm × 10");
}

{
  const p = parsePanelLineHeuristic("8 x ISOPANEL EPS 50mm 6m");
  assert.ok(p);
  assert.equal(p.tipo, "ISOPANEL");
  assert.equal(p.espesor, 50);
  assert.equal(p.cantidad, 8);
  assert.equal(p.longitud, 6);
  ok("lead qty + explicit length still works");
}

{
  const noise = parseLogisticaFromAdjuntoText(
    "Cliente: Alvaro Gonzalez Tel: 094 650 240\nISODEC EPS 100mm · 10 paneles\nBROU Cta. Dólares: 110520638-00002 Consultas: 092 663 245\nCONTACTO CONTACTO: 099 297 429\nFLETE + IVA FLETE + IVA: 25\nSALDOS SALDOS: 1",
  );
  assert.equal(noise.paneles.length, 1);
  assert.equal(noise.accesorios.length, 0, `no sheet/phone noise: ${JSON.stringify(noise.accesorios)}`);
  ok("reject tel/bank/CONTACTO/FLETE/SALDOS as accessories");
}

{
  const good = parseLogisticaFromAdjuntoText("Babeta adosar 12 uds\nGotero frontal 6 uds");
  assert.ok(good.accesorios.length >= 2, JSON.stringify(good.accesorios));
  ok("real accessories with uds still parse");
}

{
  const free = parseLogisticaFromAdjuntoText(
    "2 Gotero Frontal Isodec Isopanel 200mm\n3 paneles de Isoroof 30 mm de STOCK\n10 Tortugas Gris Oscuro\n6 perfiles Ude50:",
  );
  assert.ok(
    free.paneles.some((p) => p.tipo === "ISOROOF" && p.cantidad === 3),
    `expected ISOROOF×3: ${JSON.stringify(free.paneles)}`,
  );
  assert.ok(
    free.accesorios.some((a) => /gotero/i.test(a.descr) && a.cantidad === 2),
    `expected 2 goteros: ${JSON.stringify(free.accesorios)}`,
  );
  assert.ok(
    free.accesorios.some((a) => /tortuga/i.test(a.descr) && a.cantidad === 10),
    `expected 10 tortugas: ${JSON.stringify(free.accesorios)}`,
  );
  ok("free-text ENCARGO: panels + accessories");
}

{
  const classic = `Producto                                            Largos (m) Cantidades         Costo m2 (USD)
Isopanel EPS 100 mm (Fachada)                             2,50        11                  37,00              1.159,95
Isopanel EPS 100 mm (Fachada)                             2,30         5                  37,00                 485,07
Isodec EPS 100 mm (Cubierta)                              4,00         6                  37,00                 994,56
Perf. Ch. Gotero Frontal 100mm                             3,03              2             5,30                  32,14
Isopanel 100 mm + Isodec 100 mm
Cotización                                            Isopanel e Isodec EPS 100mm`;
  const r = parseLogisticaFromAdjuntoText(classic);
  assert.equal(r.paneles.length, 3, `expected 3 panel lines, got ${JSON.stringify(r.paneles)}`);
  const sum = r.paneles.reduce((a, p) => a + p.cantidad, 0);
  assert.equal(sum, 22, `11+5+6=22, got ${sum} ${JSON.stringify(r.paneles)}`);
  assert.ok(
    r.accesorios.some((a) => /gotero/i.test(a.descr) && a.cantidad === 2),
    `goteros: ${JSON.stringify(r.accesorios)}`,
  );
  ok("classic table: Largo+Cantidad columns + gotero");
}

{
  const abril = "ISOROOF 3G 80mm · 8 paneles × 4.40 m (8 paneles × 4.40 m)";
  const p = parsePanelLineHeuristic(abril);
  assert.ok(p);
  assert.equal(p.cantidad, 8);
  assert.equal(p.espesor, 80);
  ok("Abril-style modern line with paneles");
}

{
  const uam = parseLogisticaFromAdjuntoText(
    `Perfil Ch. Blanca "U" 100mm x 35mm                        3,00         3                       4,20                    37,84
Perfil G2 Ch. Blanca 100mm (Ext.)                         3,00         1                       5,19                    15,58`,
  );
  assert.ok(uam.accesorios.length >= 2, JSON.stringify(uam.accesorios));
  assert.ok(uam.accesorios.some((a) => /perfil/i.test(a.descr) && a.cantidad === 3));
  ok("UAM-style perfiles as accessories");
}

{
  // pdftotext wrap of modern BMC resumen (Alvaro-style) must not invent bultos.
  const wrapped = parseLogisticaFromAdjuntoText(
    `Alcance: ISODEC EPS · 100mm · Color Blanco · Techo · 2 Zonas
113.7 m² · 10 paneles · 3 apoyos ·
57 fijaciones
ISODEC EPS 100mm · 10 paneles 113.68 m² 41.15 4,677.93`,
  );
  assert.equal(wrapped.paneles.length, 1, JSON.stringify(wrapped.paneles));
  assert.equal(wrapped.paneles[0].cantidad, 10);
  assert.equal(
    wrapped.accesorios.length,
    0,
    `phantom engineering summary: ${JSON.stringify(wrapped.accesorios)}`,
  );
  ok("reject wrapped apoyos/fijaciones summary as accessories");
}

{
  const split = parseLogisticaFromAdjuntoText(
    `113.7 m² · 10 paneles
3 apoyos · 57 fijaciones
ISODEC EPS 100mm · 10 paneles`,
  );
  assert.equal(split.accesorios.length, 0, JSON.stringify(split.accesorios));
  assert.ok(split.paneles.some((p) => p.cantidad === 10));
  ok("reject split apoyos·fijaciones summary line");
}

{
  // Real accessory product lines must still parse (kit / gotero with uds).
  const kit = parseLogisticaFromAdjuntoText("Kit de fijación 57 uds\nGotero frontal 6 uds");
  assert.ok(
    kit.accesorios.some((a) => /kit/i.test(a.descr) && a.cantidad === 57),
    JSON.stringify(kit.accesorios),
  );
  assert.ok(kit.accesorios.some((a) => /gotero/i.test(a.descr) && a.cantidad === 6));
  ok("kit de fijación + gotero with uds still parse");
}

console.log(`\n${passed} passed`);
