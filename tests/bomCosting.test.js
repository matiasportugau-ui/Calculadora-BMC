/**
 * Internal costing sheet — unit cost resolve + margin rollup.
 * Uses injected panel/flete ctx so bake #1054 price churn cannot flake pins.
 * Run: node tests/bomCosting.test.js
 */
import assert from "node:assert/strict";
import {
  resolveBomLineCostUnit,
  buildCostingReport,
} from "../src/utils/bomCosting.js";

console.log("\n— bomCosting\n");

const ctx = {
  PANELS_TECHO: {
    ISODEC_EPS: { esp: { 100: { costo: 30 } } },
  },
  PANELS_PARED: {
    ISOPANEL_EPS: { esp: { 50: { costo: 18.5 } } },
  },
  PERFIL_TECHO: {
    gotero_frontal: {
      ISODEC_EPS: {
        100: { sku: "GFS100", costo: 12 },
      },
    },
  },
  PERFIL_PARED: {},
  fleteCostUsd: 40,
  fleteVentaUsd: 80,
};

assert.equal(resolveBomLineCostUnit({}, ctx), null);
assert.equal(resolveBomLineCostUnit({ sku: "" }, ctx), null);
assert.equal(resolveBomLineCostUnit({ sku: "UNKNOWN-SKU" }, ctx), null);
assert.equal(resolveBomLineCostUnit({ sku: "ISODEC_EPS-100" }, ctx), 30);
assert.equal(resolveBomLineCostUnit({ sku: "ISOPANEL_EPS-50" }, ctx), 18.5);
assert.equal(resolveBomLineCostUnit({ sku: "GFS100" }, ctx), 12);
assert.equal(resolveBomLineCostUnit({ sku: "FLETE" }, ctx), 40);
assert.equal(resolveBomLineCostUnit({ sku: "FLETE" }, { ...ctx, fleteCostUsd: undefined }), null);
assert.equal(resolveBomLineCostUnit({ sku: "FLETE" }, { ...ctx, fleteCostUsd: -1 }), null);
assert.equal(typeof resolveBomLineCostUnit({ sku: "tornillo_t2" }, {}), "number");

const report = buildCostingReport(
  [
    {
      title: "PANELES",
      items: [
        { label: "ISODEC EPS 100", sku: "ISODEC_EPS-100", cant: 10, unidad: "m²", pu: 41.15, total: 411.5 },
      ],
    },
    {
      title: "SERVICIOS",
      items: [
        { label: "Flete", sku: "FLETE", cant: 1, unidad: "servicio", pu: 80, total: 80 },
      ],
    },
  ],
  ctx,
);

assert.equal(report.rows.length, 2);
assert.equal(report.fleteMissingCost, false);
assert.equal(report.sumCostAll, 340); // 10*30 + 1*40
assert.equal(report.sumSaleAll, 491.5);
assert.equal(report.sumSaleForMargin, 491.5);
assert.equal(report.sumCostForMargin, 340);
assert.equal(report.totalMargin, 151.5);
assert.equal(report.rows[0].margin, 111.5);
assert.equal(report.rows[1].isFlete, true);
assert.equal(report.rows[1].unitCost, 40);
assert.equal(report.missingCostRows.length, 0);

const missingFlete = buildCostingReport(
  [
    {
      title: "SERVICIOS",
      items: [{ label: "Flete", sku: "FLETE", cant: 1, pu: 80, total: 80 }],
    },
    {
      title: "PANELES",
      items: [{ label: "ghost", sku: "NO-SUCH", cant: 2, pu: 10, total: 20 }],
    },
  ],
  { fleteVentaUsd: 80 },
);
assert.equal(missingFlete.fleteMissingCost, true);
assert.equal(missingFlete.rows.find((r) => r.isFlete).countForMargin, false);
assert.equal(missingFlete.rows.find((r) => r.sku === "NO-SUCH").countForMargin, false);
assert.equal(missingFlete.sumSaleForMargin, 0);
assert.equal(missingFlete.missingCostRows.length, 2);

const empty = buildCostingReport([], ctx);
assert.equal(empty.sumSaleAll, 0);
assert.equal(empty.totalMargin, 0);
assert.equal(empty.totalMarginPct, null);

console.log("bomCosting: ok");
