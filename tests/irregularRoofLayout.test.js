/**
 * irregularRoofLayout goldens + real techo quote path
 */
import assert from "node:assert/strict";
import {
  buildIrregularSchedule,
  applyManualOrderLength,
  resetStripToAuto,
  bomFromIrregularSchedule,
  stepCeil,
  sideCross,
  polygonArea,
  SCHEMA,
  CORTE_EN_OBRA_NOTE,
} from "../src/utils/irregularRoofLayout.js";
import { calcTechoCompleto } from "../src/utils/calculations.js";
import { executeScenario } from "../src/utils/scenarioOrchestrator.js";

let passed = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  passed += 1;
  console.log(`  ✓ ${msg}`);
}
function approx(a, b, tol = 1e-3) {
  return Math.abs(a - b) <= tol;
}

function techoBase(overrides = {}) {
  return {
    familia: "ISODEC_EPS",
    espesor: 100,
    tipoEst: "metal",
    color: "Blanco",
    pendiente: 0,
    pendienteModo: "incluye_pendiente",
    tipoAguas: "una_agua",
    borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
    opciones: { inclCanalon: false, inclGotSup: false, inclSell: false },
    zonas: [{ largo: 6, ancho: 5.6 }],
    ...overrides,
  };
}

console.log("irregularRoofLayout.test.js");

ok(stepCeil(4.801, 0.01) === 4.81, "stepCeil 4.801 → 4.81");
ok(stepCeil(6, 0.01) === 6, "stepCeil exact 6");
ok(stepCeil(1.2, 0.01) === 1.2, "stepCeil 1.2");

{
  const layout = buildIrregularSchedule({
    mode: "rectangle",
    ancho: 5.6,
    largo: 6,
    au: 1.12,
    lmin: 2.3,
    lmax: 14,
    orderLengthStepM: 0.01,
  });
  ok(layout.schema === SCHEMA, "R1 schema");
  ok(layout.strips.length === 5, "R1 five strips");
  ok(
    layout.strips.every((s) => approx(s.L_order, 6) && approx(s.L_cover, 6)),
    "R1 all L_order=L_cover=6",
  );
  ok(approx(layout.totals.areaOrdered, 33.6), `R1 areaOrdered=33.6 got ${layout.totals.areaOrdered}`);
  ok(approx(layout.totals.areaUsable, 33.6), "R1 areaUsable=33.6");
  ok(approx(layout.totals.areaWasteSite, 0, 1e-2), "R1 waste~0");
}

{
  const cTop = sideCross({ x: 0, y: 0 }, { x: 5.6, y: 6 }, { x: 0, y: 6 });
  ok(cTop > 0, "D1 (0,6) is left of cut");

  const layout = buildIrregularSchedule({
    mode: "diagonal_halfplane",
    ancho: 5.6,
    largo: 6,
    au: 1.12,
    lmin: 2.3,
    lmax: 14,
    orderLengthStepM: 0.01,
    cut: { p0: { x: 0, y: 0 }, p1: { x: 5.6, y: 6 }, keep: "left" },
  });

  ok(layout.strips.length === 5, `D1 five strips got ${layout.strips.length}`);
  ok(approx(polygonArea(layout.polygon), 16.8, 0.05), `D1 poly area~16.8 got ${polygonArea(layout.polygon)}`);
  const orders = layout.strips.map((s) => s.L_order);
  ok(!orders.every((L) => approx(L, orders[0])), "D1 not all equal lengths");
  ok(layout.strips[0].L_order >= layout.strips[4].L_order, "D1 stepped descending-ish");
  ok(approx(layout.strips[0].L_cover, 6, 0.05), `D1 T-01 L_cover~6 got ${layout.strips[0].L_cover}`);
  const t05 = layout.strips.find((s) => s.id === "T-05");
  ok(t05 && approx(t05.L_order, 2.3), `D1 T-05 L_order=2.3 (lmin) got ${t05?.L_order}`);
  ok(
    layout.warnings.includes("IRR_BELOW_LMIN") || t05.codes?.includes("IRR_BELOW_LMIN"),
    "D1 IRR_BELOW_LMIN warned",
  );
  ok(layout.totals.areaOrdered > layout.totals.areaUsable - 1e-6, "D1 ordered >= usable");
  ok(layout.totals.areaWasteSite > 0, "D1 site waste > 0");
  ok(layout.notes.some((n) => /obra/i.test(n)), "D1 corte en obra note");
  ok(
    layout.totals.areaOrdered > 18 && layout.totals.areaOrdered < 28,
    `D1 areaOrdered in band got ${layout.totals.areaOrdered}`,
  );
}

{
  const base = buildIrregularSchedule({
    mode: "diagonal_halfplane",
    ancho: 5.6,
    largo: 6,
    au: 1.12,
    lmin: 2.3,
    lmax: 14,
    cut: { p0: { x: 0, y: 0 }, p1: { x: 5.6, y: 6 }, keep: "left" },
  });
  const t03 = base.strips.find((s) => s.id === "T-03");
  ok(!!t03, "M1 T-03 exists");
  const before = base.totals.areaOrdered;
  const manual = applyManualOrderLength(base, "T-03", 5.0);
  const t03m = manual.strips.find((s) => s.id === "T-03");
  ok(t03m.source === "manual", "M1 source manual");
  ok(approx(t03m.L_order, 5), "M1 L_order 5");
  ok(manual.totals.areaOrdered > before - 1e-6 || approx(t03.L_order, 5), "M1 totals react");
  const reset = resetStripToAuto(manual, "T-03");
  ok(reset.strips.find((s) => s.id === "T-03").source === "auto", "M1 reset auto");
}

{
  const layout = buildIrregularSchedule({
    mode: "rectangle",
    ancho: 5.6,
    largo: 6,
    au: 1.12,
    lmin: 2.3,
    lmax: 14,
  });
  const bom = bomFromIrregularSchedule(layout, 45.97);
  ok(approx(bom.areaTotal, 33.6), "BOM area 33.6");
  ok(approx(bom.costoPaneles, 33.6 * 45.97, 0.05), "BOM cost = area*precio");
  ok(bom.cantPaneles === 5, "BOM 5 panels");
}

{
  const layout = buildIrregularSchedule({
    mode: "rectangle",
    ancho: 1.12,
    largo: 15,
    au: 1.12,
    lmin: 2.3,
    lmax: 14,
  });
  ok(approx(layout.strips[0].L_order, 14), "lmax clamp 14");
  ok(layout.warnings.includes("IRR_LENGTH_EXCEEDS_LMAX"), "IRR_LENGTH_EXCEEDS_LMAX");
}

{
  const r = calcTechoCompleto({
    familia: "ISODEC_EPS",
    espesor: 100,
    largo: 6,
    ancho: 5.6,
    tipoEst: "metal",
    borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
    opciones: { inclCanalon: false, inclGotSup: false, inclSell: false },
  });
  ok(!r.error, `Q-rect no error: ${r.error || ""}`);
  ok(approx(r.paneles.areaTotal, 33.6), `Q-rect areaTotal=33.6 got ${r.paneles.areaTotal}`);
  ok(!r.paneles.irregular, "Q-rect not irregular flag");
  ok(r.paneles.cantPaneles === 5, `Q-rect 5 panels got ${r.paneles.cantPaneles}`);
}

{
  const irr = buildIrregularSchedule({
    mode: "diagonal_halfplane",
    ancho: 5.6,
    largo: 6,
    au: 1.12,
    lmin: 2.3,
    lmax: 14,
    cut: { p0: { x: 0, y: 0 }, p1: { x: 5.6, y: 6 }, keep: "left" },
  });
  const base = {
    familia: "ISODEC_EPS",
    espesor: 100,
    largo: 6,
    ancho: 5.6,
    tipoEst: "metal",
    borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
    opciones: { inclCanalon: false, inclGotSup: false, inclSell: false },
  };
  const rRect = calcTechoCompleto(base);
  const rIrr = calcTechoCompleto({ ...base, irregularLayout: irr });
  ok(!rIrr.error, `Q-irr no error: ${rIrr.error || ""}`);
  ok(rIrr.paneles.irregular === true, "Q-irr irregular flag");
  ok(
    approx(rIrr.paneles.areaTotal, irr.totals.areaOrdered, 0.02),
    `Q-irr area matches ordered ${irr.totals.areaOrdered} got ${rIrr.paneles.areaTotal}`,
  );
  ok(
    rIrr.paneles.areaTotal < rRect.paneles.areaTotal - 0.5,
    `Q-irr ordered ${rIrr.paneles.areaTotal} < rect ${rRect.paneles.areaTotal}`,
  );
  ok(
    (rIrr.warnings || []).some((w) => /obra|escalonad/i.test(w)),
    "Q-irr warning mentions corte/escalonado",
  );
}

{
  const irr = buildIrregularSchedule({
    mode: "diagonal_halfplane",
    ancho: 5.6,
    largo: 6,
    au: 1.12,
    lmin: 2.3,
    lmax: 14,
    cut: { p0: { x: 0, y: 0 }, p1: { x: 5.6, y: 6 }, keep: "left" },
  });
  const rOff = executeScenario("solo_techo", { techo: techoBase(), pared: {}, camara: {} });
  const rOn = executeScenario("solo_techo", {
    techo: techoBase({ irregularLayout: irr }),
    pared: {},
    camara: {},
  });
  ok(rOff && !rOff.error, "scenario rect ok");
  ok(rOn && !rOn.error, "scenario irr ok");
  ok(approx(rOff.paneles?.areaTotal, 33.6), `scenario rect area 33.6 got ${rOff.paneles?.areaTotal}`);
  ok(rOn.paneles?.areaTotal < rOff.paneles?.areaTotal - 0.5, `scenario irr ${rOn.paneles?.areaTotal} < rect`);
  ok(rOn.paneles?.irregular === true, "scenario paneles.irregular");
}

ok(/obra/i.test(CORTE_EN_OBRA_NOTE), "CORTE_EN_OBRA_NOTE mentions obra");

// Bug BE — remnant strip must bill full au (same SoT as rectangular calcPanelesTecho)
{
  const au = 1.12;
  const ancho = 8.36; // 7×1.12 + remnant 0.52
  const largo = 6;
  const layout = buildIrregularSchedule({
    mode: "rectangle",
    ancho,
    largo,
    au,
    lmin: 2.3,
    lmax: 14,
  });
  const remnant = layout.strips.find((s) => s.width < au - 1e-9);
  ok(!!remnant, "BE remnant strip exists");
  ok(approx(remnant.width, 0.52), `BE remnant geometric width 0.52 got ${remnant?.width}`);
  ok(
    approx(remnant.areaOrdered, largo * au),
    `BE remnant bills L×au=${largo * au} got ${remnant?.areaOrdered}`,
  );
  ok(
    approx(layout.totals.areaOrdered, 8 * largo * au),
    `BE areaOrdered=53.76 got ${layout.totals.areaOrdered}`,
  );
  ok(
    approx(layout.totals.areaWasteWidth, largo * (au - 0.52), 1e-3),
    `BE areaWasteWidth=3.6 got ${layout.totals.areaWasteWidth}`,
  );
  const rIrr = calcTechoCompleto({
    familia: "ISODEC_EPS",
    espesor: 100,
    largo,
    ancho,
    tipoEst: "metal",
    borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
    opciones: { inclCanalon: false, inclGotSup: false, inclSell: false },
    irregularLayout: layout,
  });
  const rRect = calcTechoCompleto({
    familia: "ISODEC_EPS",
    espesor: 100,
    largo,
    ancho,
    tipoEst: "metal",
    borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
    opciones: { inclCanalon: false, inclGotSup: false, inclSell: false },
  });
  ok(!rIrr.error, `BE quote no error: ${rIrr.error || ""}`);
  ok(
    approx(rIrr.paneles.areaTotal, rRect.paneles.areaTotal, 0.02),
    `BE irregular rectangle matches rect SoT ${rRect.paneles.areaTotal} got ${rIrr.paneles.areaTotal}`,
  );
}

// dos_aguas must NOT double-apply irregular schedule on both faldones
{
  const irr = buildIrregularSchedule({
    mode: "diagonal_halfplane",
    ancho: 5.6,
    largo: 6,
    au: 1.12,
    lmin: 2.3,
    lmax: 14,
    cut: { p0: { x: 0, y: 0 }, p1: { x: 5.6, y: 6 }, keep: "left" },
  });
  const r2a = executeScenario("solo_techo", {
    techo: techoBase({
      tipoAguas: "dos_aguas",
      irregularLayout: irr,
      zonas: [{ largo: 6, ancho: 5.6 }],
    }),
    pared: {},
    camara: {},
  });
  const r2aOff = executeScenario("solo_techo", {
    techo: techoBase({
      tipoAguas: "dos_aguas",
      zonas: [{ largo: 6, ancho: 5.6 }],
    }),
    pared: {},
    camara: {},
  });
  ok(r2a && !r2a.error, "dos_aguas+irr no error");
  // With irregular ignored for dos_aguas, area matches rectangular two-slope path
  ok(
    approx(r2a.paneles?.areaTotal, r2aOff.paneles?.areaTotal, 0.05),
    `dos_aguas irr ignored (same as rect): on=${r2a.paneles?.areaTotal} off=${r2aOff.paneles?.areaTotal}`,
  );
  ok(!r2a.paneles?.irregular, "dos_aguas does not set irregular flag on merged BOM");
}

console.log(`\n${passed} assertions passed`);
