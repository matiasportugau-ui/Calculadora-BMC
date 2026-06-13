/**
 * Catalog golden regressions for recent WOLF pricing loads.
 *
 * These checks keep business-critical catalog values inside the normal
 * `npm test` gate. The evals/golden-cases scripts are useful ledgers, but they
 * are not enough if a routine regression run never executes them.
 *
 * Run: node tests/catalogGolden.test.js
 */

import { PANELS_PARED, PERFIL_TECHO, SCENARIOS_DEF } from "../src/data/constants.js";
import { resolveSKU_techo } from "../src/utils/calculations.js";
import {
  computePresupuestoLibreCatalogo,
  flattenPerfilesLibre,
} from "../src/utils/presupuestoLibreCatalogo.js";

let passed = 0;
let failed = 0;

function assert(cond, label, details = "") {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`  x ${label}${details ? ` (${details})` : ""}`);
}

function group(name, fn) {
  console.log(`\n-- ${name}`);
  fn();
}

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const r4 = (n) => Math.round((Number(n) + Number.EPSILON) * 1e4) / 1e4;

group("WOLF-0001 ISOFRIG stays quotable in Presupuesto libre", () => {
  const fam = PANELS_PARED.ISOFRIG_PIR;
  const espesores = Object.keys(fam?.esp || {}).map(Number).sort((a, b) => a - b);
  const camara = SCENARIOS_DEF.find((s) => s.id === "camara_frig");

  assert(fam?.au === 1.1, "ISOFRIG useful width remains 1.10m", `got ${fam?.au}`);
  assert(fam?.col?.join(",") === "Blanco", "ISOFRIG remains Blanco-only");
  assert(espesores.join(",") === "40,60,80,100,120,150,180", "ISOFRIG real thickness list excludes cloned 200mm row", espesores.join(","));
  assert(camara?.familias?.includes("ISOFRIG_PIR"), "camara_frig scenario exposes ISOFRIG_PIR");

  const web = computePresupuestoLibreCatalogo({
    listaPrecios: "web",
    librePanelLines: [{ familia: "ISOFRIG_PIR", espesor: 100, m2: 10 }],
  });
  const webLine = web.libreGroups.find((g) => g.title === "PANELES")?.items?.[0];
  assert(webLine?.pu === 76.9454, "ISOFRIG 100mm web unit price is Matriz value", `got ${webLine?.pu}`);
  assert(r2(webLine?.total) === 769.45, "ISOFRIG 100mm web total for 10m2 is stable", `got ${webLine?.total}`);

  const venta = computePresupuestoLibreCatalogo({
    listaPrecios: "venta",
    librePanelLines: [{ familia: "ISOFRIG_PIR", espesor: 100, m2: 10 }],
  });
  const ventaLine = venta.libreGroups.find((g) => g.title === "PANELES")?.items?.[0];
  assert(ventaLine?.pu === 58.01, "ISOFRIG 100mm venta uses BMC cost x 1.15 policy", `got ${ventaLine?.pu}`);
  assert(r2(ventaLine?.total) === 580.1, "ISOFRIG 100mm venta total for 10m2 is stable", `got ${ventaLine?.total}`);
});

group("WOLF-0003 camera roof accessories keep per-thickness SKUs", () => {
  const lateral = PERFIL_TECHO.gotero_lateral_camara.ISODEC;
  const lateralKeys = Object.keys(lateral || {}).filter((key) => key !== "_all");

  assert(lateralKeys.join(",") === "100,150,200,250", "ISODEC lateral-camara exposes 100/150/200/250 thicknesses", lateralKeys.join(","));
  assert(lateral?._all === undefined, "ISODEC lateral-camara does not regress to _all collapse");
  assert(lateral?.[150]?.sku === "GLDCAM150", "ISODEC lateral-camara 150mm keeps corrected SKU", `got ${lateral?.[150]?.sku}`);
  assert(r4(lateral?.[150]?.web) === 28.91, "ISODEC lateral-camara 150mm web price is Matriz value", `got ${lateral?.[150]?.web}`);
  assert(r4(lateral?.[200]?.web) === 43.274, "ISODEC lateral-camara 200mm keeps verbatim anomaly value", `got ${lateral?.[200]?.web}`);

  const catalogRows = flattenPerfilesLibre(PERFIL_TECHO, {});
  const row150 = catalogRows.find((row) => row.id === "pt:gotero_lateral_camara:ISODEC:150");
  assert(row150?.sku === "GLDCAM150", "Presupuesto libre picker can select ISODEC lateral-camara 150mm", `got ${row150?.sku}`);
  assert(!catalogRows.some((row) => row.id === "pt:gotero_lateral_camara:ISODEC:_all"), "Presupuesto libre picker does not expose stale ISODEC _all row");
});

group("WOLF-0003 GSDECAM100 and PIR fallback stay resolvable", () => {
  const gs100 = PERFIL_TECHO.gotero_superior.ISODEC_PIR?.[100];
  assert(gs100?.sku === "GSDECAM100", "GSDECAM100 superior-camara SKU is present", `got ${gs100?.sku}`);
  assert(r4(gs100?.web) === 46.046, "GSDECAM100 web price is Matriz value", `got ${gs100?.web}`);
  assert(r4(gs100?.venta) === 39.468, "GSDECAM100 venta price is Matriz value", `got ${gs100?.venta}`);

  const pirFallback = resolveSKU_techo("gotero_lateral_camara", "ISODEC_PIR", 80);
  assert(pirFallback?.sku === "GLDCAMPIR", "PIR lateral-camara resolves through corrected fallback SKU", `got ${pirFallback?.sku}`);
  assert(r4(pirFallback?.web) === 30.92, "PIR lateral-camara fallback web price is stable", `got ${pirFallback?.web}`);
});

console.log(`\n${failed === 0 ? "OK" : "FAIL"} catalogGolden: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
