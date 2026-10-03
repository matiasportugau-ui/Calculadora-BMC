// Offline pins for src/utils/bomCosting.js — internal cost vs sale margins.
// Run: node tests/bomCostingGates.test.js
//
// A deleted catalog lookup, a venta-price used as cost, or a missing flete
// folded back into the margin would still pass the calculator suites.

import { FIJACIONES, HERRAMIENTAS, SELLADORES } from "../src/data/constants.js";
import { buildCostingReport, resolveBomLineCostUnit } from "../src/utils/bomCosting.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

const PANEL_CTX = {
  PANELS_TECHO: {
    TEST: { esp: { 50: { costo: 10, venta: 99 } } },
    ZERO: { esp: { 30: { costo: 0, venta: 40 } } },
    varilla_38: { esp: { 1: { costo: 999 } } },
  },
  PERFIL_TECHO: {
    gotero: { ISO: { 50: { sku: "SOFT-80", costo: 4.25, venta: 12 } } },
  },
  PANELS_PARED: {
    SOFT: { esp: { 80: { costo: "nope", venta: 50 } } },
  },
};

group("resolveBomLineCostUnit", () => {
  assert(resolveBomLineCostUnit(null, PANEL_CTX) === null, "null item → null");
  assert(resolveBomLineCostUnit({}, PANEL_CTX) === null, "missing sku → null");
  assert(resolveBomLineCostUnit({ sku: "" }, PANEL_CTX) === null, "empty sku → null");
  assert(resolveBomLineCostUnit({ sku: " FLETE" }, PANEL_CTX) === null, "untrimmed flete is not FLETE");
  assert(resolveBomLineCostUnit({ sku: "flete" }, { fleteCostUsd: 12 }) === null, "flete match is case-sensitive");

  assert(resolveBomLineCostUnit({ sku: "FLETE" }, { fleteCostUsd: 12.5 }) === 12.5, "numeric flete cost");
  assert(resolveBomLineCostUnit({ sku: "FLETE" }, { fleteCostUsd: 0 }) === 0, "zero flete cost is known");
  assert(resolveBomLineCostUnit({ sku: "FLETE" }, { fleteCostUsd: -1 }) === null, "negative flete cost rejected");
  assert(resolveBomLineCostUnit({ sku: "FLETE" }, { fleteCostUsd: Number.NaN }) === null, "NaN flete cost rejected");
  assert(resolveBomLineCostUnit({ sku: "FLETE" }, { fleteCostUsd: "12" }) === null, "string flete cost rejected");

  assert(
    resolveBomLineCostUnit({ sku: "varilla_38" }, PANEL_CTX) === FIJACIONES.varilla_38.costo,
    "fijación costo wins over a colliding panel catalog",
  );
  assert(
    resolveBomLineCostUnit({ sku: "pistola_apl_dx03" }, {}) === HERRAMIENTAS.pistola_apl_dx03.costo,
    "herramienta costo",
  );
  assert(
    resolveBomLineCostUnit({ sku: "silicona" }, {}) === SELLADORES.silicona.costo,
    "sellador costo",
  );
  assert(
    resolveBomLineCostUnit({ sku: "TEST-50" }, PANEL_CTX) === 10,
    "panel sku uses costo, not venta",
  );
  assert(
    resolveBomLineCostUnit({ sku: "ZERO-30" }, PANEL_CTX) === 0,
    "numeric zero panel costo does not fall through to perfil",
  );
  assert(
    resolveBomLineCostUnit({ sku: "SOFT-80" }, PANEL_CTX) === 4.25,
    "non-numeric panel costo falls through to perfil sku",
  );
  assert(resolveBomLineCostUnit({ sku: "NOPE" }, PANEL_CTX) === null, "unknown sku → null");
});

group("buildCostingReport margins", () => {
  const varillaUnit = FIJACIONES.varilla_38.costo;
  const varillaCost = +(varillaUnit * 3).toFixed(2);
  const ctx = {
    ...PANEL_CTX,
    fleteCostUsd: 20,
    fleteVentaUsd: 40,
  };
  const groups = [
    {
      title: "Paneles",
      items: [
        { label: "Panel", sku: "TEST-50", cant: "2", unidad: "m2", pu: 15, total: "30" },
        { label: "Sin costo", sku: "UNKNOWN", cant: 1, total: 8 },
        { label: "Varilla", sku: "varilla_38", cant: 3, total: 12 },
      ],
    },
    {
      title: "Logística",
      items: [{ label: "Flete", sku: "FLETE", cant: 1, total: 40 }],
    },
  ];
  const report = buildCostingReport(groups, ctx);

  const panel = report.rows.find((r) => r.sku === "TEST-50");
  assert(panel.cant === 2 && panel.unitCost === 10 && panel.costTotal === 20, "string cant/total still cost 2 × 10");
  assert(panel.margin === 10 && panel.marginPct === 50 && panel.countForMargin === true, "panel margin 50%");
  assert(groups[0].items[0].total === "30", "input line total is not mutated");

  const missing = report.rows.find((r) => r.sku === "UNKNOWN");
  assert(missing.costTotal == null && missing.countForMargin === false && missing.margin == null, "unknown sku excluded from margin");

  const varilla = report.rows.find((r) => r.sku === "varilla_38");
  assert(varilla.costTotal === varillaCost, "varilla cost is catalog costo × cant");
  assert(varilla.margin === +(12 - varillaCost).toFixed(2), "varilla margin is sale − cost");

  const flete = report.rows.find((r) => r.sku === "FLETE");
  assert(flete.isFlete === true && flete.unitCost === 20 && flete.marginPct === 100, "known flete stays in the margin");

  const sumCost = +(20 + varillaCost + 20).toFixed(2);
  const sumSaleMargin = +(30 + 12 + 40).toFixed(2);
  assert(report.sumSaleAll === 90, "all sales counted, including uncosted lines");
  assert(report.sumCostAll === sumCost, "sumCostAll includes only known costs");
  assert(report.sumSaleForMargin === sumSaleMargin && report.sumCostForMargin === sumCost, "uncosted sale dropped from margin base");
  assert(report.totalMargin === +(sumSaleMargin - sumCost).toFixed(2), "total margin");
  assert(
    report.totalMarginPct === +(((sumSaleMargin - sumCost) / sumCost) * 100).toFixed(1),
    "total margin percent rounded to 1 decimal",
  );
  assert(report.fleteMissingCost === false, "known flete cost is not flagged missing");
  assert(report.coveredSalePct === +((sumSaleMargin / 90) * 100).toFixed(1), "covered sale percent");
  assert(report.missingCostRows.length === 1 && report.missingCostRows[0].sku === "UNKNOWN", "missing-cost rows listed");

  const paneles = report.byGroup.find((g) => g.group === "Paneles");
  assert(paneles.items === 3 && paneles.knownCostItems === 2 && paneles.missingCostItems === 1, "group counts");
  assert(paneles.saleTotal === 50 && paneles.costTotal === +(20 + varillaCost).toFixed(2), "group sale/cost");
  assert(
    paneles.marginPct === +((paneles.marginTotal / paneles.costTotal) * 100).toFixed(1),
    "group margin percent",
  );
});

group("flete missing vs zero cost", () => {
  const missing = buildCostingReport(
    [{ title: "Logística", items: [{ label: "Flete", sku: "FLETE", cant: 1, total: 40 }] }],
    { fleteVentaUsd: 40 },
  );
  assert(missing.fleteMissingCost === true, "sale without numeric cost flags fleteMissingCost");
  assert(missing.rows[0].countForMargin === false && missing.sumSaleForMargin === 0, "missing flete excluded from margin");
  assert(missing.sumSaleAll === 40 && missing.coveredSalePct === 0, "flete sale still in sumSaleAll");
  assert(missing.totalMarginPct === null, "no cost base → null margin percent");

  const zero = buildCostingReport(
    [{ title: "Logística", items: [{ label: "Flete", sku: "FLETE", cant: 1, total: 40 }] }],
    { fleteCostUsd: 0, fleteVentaUsd: 40 },
  );
  assert(zero.fleteMissingCost === false, "zero flete cost is a known cost");
  assert(zero.rows[0].costTotal === 0 && zero.rows[0].margin === 40 && zero.rows[0].marginPct === null, "zero cost has margin dollars and null percent");
  assert(zero.rows[0].countForMargin === true && zero.totalMarginPct === null, "zero cost stays in the base but percent stays null");

  const empty = buildCostingReport(null, {});
  assert(empty.rows.length === 0 && empty.sumSaleAll === 0 && empty.coveredSalePct === null, "null groups → empty report");
  assert(empty.totalMargin === 0 && empty.totalMarginPct === null && empty.fleteMissingCost === false, "empty report has null percents");
});

console.log(`\nbomCostingGates: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
