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
  // Bug CG: must keep cut lengths — nearest integer LENS would turn 2.50/2.30 → 3.
  const byQty = Object.fromEntries(r.paneles.map((p) => [p.cantidad, p.longitud]));
  assert.equal(byQty[11], 2.5, `11× Fachada largo 2.50, got ${JSON.stringify(r.paneles)}`);
  assert.equal(byQty[5], 2.3, `5× Fachada largo 2.30, got ${JSON.stringify(r.paneles)}`);
  assert.equal(byQty[6], 4, `6× Cubierta largo 4.00, got ${JSON.stringify(r.paneles)}`);
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
  assert.equal(p.longitud, 4.4, "Bug CG: explicit × 4.40 m must not snap to catalog 4");
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
  // Bug BX — modern default-L=6 echo + classic explicit L for same tipo|esp|qty must not 2×.
  const dual = parseLogisticaFromAdjuntoText(
    `ISODEC EPS 100mm · 10 paneles 113.68 m² 41.15 4,677.93
Isodec EPS 100 mm 4,00 10 37,00 370,00`,
  );
  assert.equal(dual.paneles.length, 1, `expected 1 panel after BX collapse, got ${JSON.stringify(dual.paneles)}`);
  assert.equal(dual.paneles[0].cantidad, 10);
  assert.equal(dual.paneles[0].longitud, 4, "prefer classic explicit length over default 6");
  assert.equal(
    dual.paneles.reduce((s, p) => s + p.cantidad, 0),
    10,
    `panel qty must stay 10, got ${JSON.stringify(dual.paneles)}`,
  );
  ok("Bug BX: dual-format modern+classic → single ISODEC ×10 @ L=4");
}

{
  // Modern-only (no classic) still keeps default L=6.
  const modernOnly = parseLogisticaFromAdjuntoText("ISODEC EPS 100mm · 10 paneles 113.68 m² 41.15 4,677.93");
  assert.equal(modernOnly.paneles.length, 1);
  assert.equal(modernOnly.paneles[0].longitud, 6);
  assert.equal(modernOnly.paneles[0].cantidad, 10);
  ok("modern-only still defaults length to 6");
}

{
  // Distinct lengths with same qty remain (true multi-length order).
  const multi = parseLogisticaFromAdjuntoText(
    `Isopanel EPS 100 mm (Fachada)                             2,50        11                  37,00              1.159,95
Isopanel EPS 100 mm (Fachada)                             2,30        11                  37,00                 485,07`,
  );
  assert.equal(multi.paneles.length, 2, `expected 2 distinct L rows: ${JSON.stringify(multi.paneles)}`);
  assert.equal(
    multi.paneles.reduce((s, p) => s + p.cantidad, 0),
    22,
  );
  ok("distinct classic lengths same qty are kept");
}

{
  // Bug BY — free-text accessory + classic table echo of same piece.
  const accEcho = parseLogisticaFromAdjuntoText(
    `2 Gotero Frontal Izquierdo
Perf. Ch. Gotero Frontal Izquierdo 30 mm   3,03   2   7,15`,
  );
  assert.equal(
    accEcho.accesorios.length,
    1,
    `expected 1 gotero after BY collapse, got ${JSON.stringify(accEcho.accesorios)}`,
  );
  assert.equal(accEcho.accesorios[0].cantidad, 2);
  ok("Bug BY: free-text + classic gotero echo → qty 2 once");
}

{
  // Bug CE — pdf.js often omits hasEOL between classic table rows → one line, was qty 11 only.
  const collapsed = [
    "Isopanel EPS 100 mm (Fachada) 2,50 11 37,00 1.159,95 ",
    "Isopanel EPS 100 mm (Fachada) 2,30 5 37,00 485,07 ",
    "Isodec EPS 100 mm (Cubierta) 4,00 6 37,00 994,56",
  ].join("");
  const r = parseLogisticaFromAdjuntoText(collapsed);
  assert.equal(r.paneles.length, 3, `expected 3 panels from collapsed line, got ${JSON.stringify(r.paneles)}`);
  const sum = r.paneles.reduce((a, p) => a + p.cantidad, 0);
  assert.equal(sum, 22, `collapsed Petinho must stay 11+5+6=22, got ${sum}`);
  ok("Bug CE: collapsed classic multi-row line keeps all qty");
}

{
  // Bug CE — Alcance "2 Zonas" + product on same line used to null the whole blob → 0 panels.
  const alvaroCollapsed =
    "Alcance: ISODEC EPS · 100mm · Color Blanco · Techo · 2 Zonas 113.7 m² · 10 paneles · 3 apoyos · 57 fijaciones " +
    "ISODEC EPS 100mm · 10 paneles 113.68 m² 41.15 4,677.93";
  const r = parseLogisticaFromAdjuntoText(alvaroCollapsed);
  const main = r.paneles.find((p) => p.cantidad === 10 && p.espesor === 100 && p.tipo === "ISODEC");
  assert.ok(main, `expected ISODEC×10 from collapsed Alvaro, got ${JSON.stringify(r.paneles)}`);
  assert.equal(
    r.paneles.filter((p) => p.tipo === "ISODEC" && p.cantidad === 10).length,
    1,
    `no double-count on collapsed Alvaro: ${JSON.stringify(r.paneles)}`,
  );
  ok("Bug CE: collapsed Alvaro Alcance+product still yields 10 panels");
}

{
  // Accessory line mentioning Isodec/Isopanel must not be destroyed by tipo-split.
  const free = parseLogisticaFromAdjuntoText("2 Gotero Frontal Isodec Isopanel 200mm");
  assert.ok(
    free.accesorios.some((a) => /gotero/i.test(a.descr) && a.cantidad === 2),
    `gotero survived split: ${JSON.stringify(free.accesorios)}`,
  );
  assert.equal(free.paneles.length, 0);
  ok("Bug CE: accessory with ISO* context still parses after split guard");
}

{
  // Bug DA — classic L≥10 + qty≥100 used to fail-closed (qty≥100 && len≥10 skip) → 0 cargo.
  const industrial = parseLogisticaFromAdjuntoText(
    `Producto                                            Largos (m) Cantidades         Costo m2 (USD)
Isopanel EPS 100 mm (Fachada)                            10,00       120                  37,00              4.440,00
Isodec EPS 100 mm (Cubierta)                             12          150                  37,00              6.660,00
Isopanel EPS 50 mm (Fachada)                             10          100                  25,00              2.500,00`,
  );
  assert.equal(
    industrial.paneles.length,
    3,
    `Bug DA expected 3 industrial classic rows, got ${JSON.stringify(industrial.paneles)}`,
  );
  const sum = industrial.paneles.reduce((a, p) => a + p.cantidad, 0);
  assert.equal(sum, 370, `120+150+100=370, got ${sum} ${JSON.stringify(industrial.paneles)}`);
  const byQty = Object.fromEntries(industrial.paneles.map((p) => [p.cantidad, p.longitud]));
  assert.equal(byQty[120], 10, `120× Fachada @10m: ${JSON.stringify(industrial.paneles)}`);
  assert.equal(byQty[150], 12, `150× Cubierta @12m: ${JSON.stringify(industrial.paneles)}`);
  assert.equal(byQty[100], 10, `100× Fachada 50mm @10m: ${JSON.stringify(industrial.paneles)}`);
  ok("Bug DA: classic L≥10 + qty≥100 keep full industrial cargo");
}

{
  // Bug DA border: qty 99 @ L=10 always worked; qty 100 must too.
  const border99 = parsePanelLineHeuristic("Isopanel EPS 100 mm (Fachada)  10  99  37,00  3.663,00");
  const border100 = parsePanelLineHeuristic("Isopanel EPS 100 mm (Fachada)  10  100  37,00  3.700,00");
  assert.ok(border99 && border99.cantidad === 99 && border99.longitud === 10);
  assert.ok(
    border100 && border100.cantidad === 100 && border100.longitud === 10,
    JSON.stringify(border100),
  );
  ok("Bug DA: qty 99 and 100 at L=10 both parse");
}

{
  // Regression: small classic Petinho rows still parse after removing the L≥10/qty≥100 skip.
  const petinho = parsePanelLineHeuristic("Isopanel EPS 100 mm (Fachada)  2,50  11  37,00  1.159,95");
  assert.ok(petinho);
  assert.equal(petinho.cantidad, 11);
  assert.equal(petinho.longitud, 2.5);
  // qty=99 @ L=10 was already accepted before DA; keep as lower-bound control.
  const under = parsePanelLineHeuristic("Isodec EPS 100 mm (Cubierta)  10  80  37,00  2.960,00");
  assert.ok(under);
  assert.equal(under.cantidad, 80);
  assert.equal(under.longitud, 10);
  ok("Bug DA: Petinho small qty + L=10 qty<100 still parse");
}

console.log(`\n${passed} passed`);
