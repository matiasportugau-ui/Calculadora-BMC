/**
 * irregularRoofLayout goldens + real techo quote path
 */
import assert from "node:assert/strict";
import {
  buildIrregularSchedule,
  applyManualOrderLength,
  resetStripToAuto,
  bomFromIrregularSchedule,
  buildFactoryOrderList,
  irregularSchedulesForPdf,
  mergeIrregularSessionPatch,
  resolveCutKeepSide,
  EMPTY_IRREGULAR_SESSION,
  stepCeil,
  sideCross,
  polygonArea,
  SCHEMA,
  CORTE_EN_OBRA_NOTE,
} from "../src/utils/irregularRoofLayout.js";
import { calcTechoCompleto } from "../src/utils/calculations.js";
import { executeScenario } from "../src/utils/scenarioOrchestrator.js";
import { buildQuotationModel } from "../src/pdf-templates/index.js";
import { render as renderSimplePdf } from "../src/pdf-templates/simple.js";

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
  ok(
    approx(r2a.paneles?.areaTotal, r2aOff.paneles?.areaTotal, 0.05),
    `dos_aguas irr ignored (same as rect): on=${r2a.paneles?.areaTotal} off=${r2aOff.paneles?.areaTotal}`,
  );
  ok(!r2a.paneles?.irregular, "dos_aguas does not set irregular flag on merged BOM");
}

// Multi-zone: schedule only on zone 1
{
  const irrZ1 = buildIrregularSchedule({
    mode: "diagonal_halfplane",
    ancho: 5.6,
    largo: 6,
    au: 1.12,
    lmin: 2.3,
    lmax: 14,
    cut: { p0: { x: 0, y: 0 }, p1: { x: 5.6, y: 6 }, keep: "left" },
  });
  const rBoth = executeScenario("solo_techo", {
    techo: techoBase({
      zonas: [
        { largo: 6, ancho: 5.6 },
        { largo: 6, ancho: 5.6 },
      ],
      irregularLayoutByGi: { 1: irrZ1 },
    }),
    pared: {},
    camara: {},
  });
  const rNone = executeScenario("solo_techo", {
    techo: techoBase({
      zonas: [
        { largo: 6, ancho: 5.6 },
        { largo: 6, ancho: 5.6 },
      ],
    }),
    pared: {},
    camara: {},
  });
  ok(rBoth && !rBoth.error && rNone && !rNone.error, "multi-zone scenarios ok");
  ok(
    rBoth.paneles?.areaTotal < rNone.paneles?.areaTotal - 0.5,
    `multi-zone z1 only reduces total: ${rBoth.paneles?.areaTotal} < ${rNone.paneles?.areaTotal}`,
  );
}

// Factory order list + PDF schedule
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
  const factory = buildFactoryOrderList(irr);
  ok(factory && factory.rows.length === 5, "factory list 5 panels");
  ok(factory.summaryByLength.length >= 1, "factory has N×L summary groups");
  const sumCount = factory.summaryByLength.reduce((s, g) => s + g.count, 0);
  ok(sumCount === 5, "summary counts sum to panel count");
  ok(factory.rows.every((r) => r.L_order + 1e-9 >= r.L_cover), "each L_order >= L_cover");
  ok(factory.totals.areaOrdered > 0, "factory totals ordered > 0");

  const sched = irregularSchedulesForPdf(null, { 0: irr });
  ok(sched && sched.strips.length === 5, "pdf helper 5 strips");
  ok(/obra/i.test(sched.note), "pdf helper note");
  ok(sched.factorySummary && /\d+×/.test(sched.factorySummary), "pdf helper factorySummary");

  const q = buildQuotationModel({
    client: { nombre: "Test" },
    project: { refInterna: "BMC-TEST", fecha: "2026-08-07" },
    scenario: "solo_techo",
    panel: { label: "ISODEC", espesor: 100, color: "Blanco" },
    groups: [{ title: "PANELES", items: [{ label: "ISODEC 100", cant: 21.39, unidad: "m²", pu: 40, total: 855.6, cantPaneles: 5 }] }],
    totals: { subtotalSinIVA: 855.6, iva: 188.23, totalFinal: 1043.83 },
    appendix: {
      irregularSchedule: sched,
      irregularStrips: sched.strips,
      irregularNote: sched.note,
      irregularAreaOrdered: sched.areaOrdered,
      irregularAreaWasteSite: sched.areaWasteSite,
      kpi: { area: 21.39, paneles: 5 },
      zonas: [{ largo: 6, ancho: 5.6 }],
      roofBlocks: [],
    },
  });
  ok(q.irregularSchedule?.strips?.length === 5, "buildQuotationModel irregularSchedule");
  const html = renderSimplePdf(q);
  ok(/Pedido de paneles|Largos escalonados/i.test(html), "simple PDF has schedule title");
  ok(/Resumen fábrica/i.test(html), "simple PDF has factory summary");
  ok(/T-01/.test(html) && /T-05/.test(html), "simple PDF has T-01 and T-05");
  ok(/obra/i.test(html), "simple PDF corte en obra");
}

// Bug BK — shared irregularSession sequential patches must not lose cut
{
  // Absolute setState (pre-fix dual-plant bug): last write wins → cutDraft lost.
  let abs = { ...EMPTY_IRREGULAR_SESSION, enabled: true, tool: "cut" };
  const sessionSnap = abs;
  abs = { ...sessionSnap, cutDraft: { x: 1, y: 1 } };
  abs = { ...sessionSnap, cut: null };
  ok(abs.cutDraft == null, "BK absolute multi-set loses cutDraft (repro)");

  // Functional merge (fix): sequential patches in one click keep all fields.
  let sess = { ...EMPTY_IRREGULAR_SESSION, enabled: true, tool: "cut" };
  sess = mergeIrregularSessionPatch(sess, { cutDraft: { x: 1, y: 1 }, cut: null });
  ok(sess.cutDraft?.x === 1 && sess.cut == null, "BK first click keeps cutDraft");
  sess = mergeIrregularSessionPatch(sess, {
    cut: { p0: sess.cutDraft, p1: { x: 2, y: 2 } },
    cutDraft: null,
    tool: "select",
  });
  ok(
    sess.cut?.p0?.x === 1 && sess.cut?.p1?.x === 2 && sess.cutDraft == null && sess.tool === "select",
    "BK second click completes cut atomically",
  );
  sess = mergeIrregularSessionPatch(sess, { cut: null, cutDraft: null, layoutOverride: null });
  ok(sess.cut == null && sess.enabled === true, "BK clearCut keeps enabled");
}

// Bug BN — cut keep side must not depend on click stroke direction
{
  const ancho = 5.6;
  const largo = 6;
  // Same geometric cut near top: L→R vs R→L. Hardcoded keep:"left" kept opposite halves.
  const keepLR = resolveCutKeepSide(ancho, largo, { x: 0, y: 5 }, { x: 5.6, y: 5 });
  const keepRL = resolveCutKeepSide(ancho, largo, { x: 5.6, y: 5 }, { x: 0, y: 5 });
  ok(keepLR === "right", `BN top L→R keeps larger (right/bottom) got ${keepLR}`);
  ok(keepRL === "left", `BN top R→L keeps larger (left/bottom) got ${keepRL}`);

  const layLR = buildIrregularSchedule({
    mode: "diagonal_halfplane",
    ancho,
    largo,
    au: 1.12,
    lmin: 2.3,
    lmax: 14,
    cut: { p0: { x: 0, y: 5 }, p1: { x: 5.6, y: 5 }, keep: keepLR },
  });
  const layRL = buildIrregularSchedule({
    mode: "diagonal_halfplane",
    ancho,
    largo,
    au: 1.12,
    lmin: 2.3,
    lmax: 14,
    cut: { p0: { x: 5.6, y: 5 }, p1: { x: 0, y: 5 }, keep: keepRL },
  });
  ok(approx(layLR.totals.areaOrdered, layRL.totals.areaOrdered, 0.02), "BN same cut geometry → same ordered m²");
  ok(approx(layLR.totals.areaOrdered, 28, 0.05), `BN keeps larger half (~28) got ${layLR.totals.areaOrdered}`);

  // Bottom-edge R→L emptied the polygon with hardcoded keep:"left" → byGi clear → silent full rect.
  const keepBottomRL = resolveCutKeepSide(ancho, largo, { x: 5.6, y: 0 }, { x: 0, y: 0 });
  ok(keepBottomRL === "right", `BN bottom R→L picks non-empty side got ${keepBottomRL}`);
  const layBottom = buildIrregularSchedule({
    mode: "diagonal_halfplane",
    ancho,
    largo,
    au: 1.12,
    lmin: 2.3,
    lmax: 14,
    cut: { p0: { x: 5.6, y: 0 }, p1: { x: 0, y: 0 }, keep: keepBottomRL },
  });
  ok(layBottom.strips.length === 5, `BN bottom R→L has strips (not empty) got ${layBottom.strips.length}`);
  ok(approx(layBottom.totals.areaOrdered, 33.6, 0.05), "BN bottom R→L keeps full roof ordered");

  // Legacy cuts without keep: engine auto-resolves larger side
  const legacy = buildIrregularSchedule({
    mode: "diagonal_halfplane",
    ancho,
    largo,
    au: 1.12,
    lmin: 2.3,
    lmax: 14,
    cut: { p0: { x: 0, y: 5 }, p1: { x: 5.6, y: 5 } },
  });
  ok(approx(legacy.totals.areaOrdered, 28, 0.05), `BN legacy no-keep auto larger got ${legacy.totals.areaOrdered}`);

  const rLR = executeScenario("solo_techo", {
    techo: techoBase({ irregularLayoutByGi: { 0: layLR }, irregularLayout: layLR }),
    pared: {},
    camara: {},
  });
  const rRL = executeScenario("solo_techo", {
    techo: techoBase({ irregularLayoutByGi: { 0: layRL }, irregularLayout: layRL }),
    pared: {},
    camara: {},
  });
  ok(rLR && !rLR.error && rRL && !rRL.error, "BN quote paths ok");
  ok(
    approx(rLR.paneles?.areaTotal, rRL.paneles?.areaTotal, 0.05),
    `BN quote money matches both stroke dirs: ${rLR.paneles?.areaTotal} vs ${rRL.paneles?.areaTotal}`,
  );
  ok(
    rLR.paneles?.areaTotal > 20,
    `BN quote keeps larger half (not ~12.88 undercharge) got ${rLR.paneles?.areaTotal}`,
  );
}

console.log(`\n${passed} assertions passed`);
