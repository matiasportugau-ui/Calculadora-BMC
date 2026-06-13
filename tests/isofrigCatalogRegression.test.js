import assert from "node:assert/strict";

import {
  PANELS_PARED,
  PERFIL_PARED,
  PERFIL_TECHO,
} from "../src/data/constants.js";
import {
  computePresupuestoLibreCatalogo,
  flattenPerfilesLibre,
} from "../src/utils/presupuestoLibreCatalogo.js";
import { resolveSKU_techo } from "../src/utils/calculations.js";

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const isofrig = PANELS_PARED.ISOFRIG_PIR;
assert.equal(isofrig.au, 1.1, "ISOFRIG must keep the Kingspan 1.10 m useful width");
assert.deepEqual(
  Object.keys(isofrig.esp).map(Number).sort((a, b) => a - b),
  [40, 60, 80, 100, 120, 150, 180],
  "ISOFRIG must exclude the cloned 200 mm source row",
);
assert.equal(isofrig.esp[100].venta, 58.01, "ISOFRIG 100 mm venta must stay cost x 1.15");

const libreVenta = computePresupuestoLibreCatalogo({
  listaPrecios: "venta",
  librePanelLines: [{ familia: "ISOFRIG_PIR", espesor: 100, m2: 10 }],
});
const ventaLine = libreVenta.libreGroups.find((group) => group.title === "PANELES").items[0];
assert.equal(round2(ventaLine.total), 580.1, "presupuesto_libre must use the validated ISOFRIG venta price");

assert.equal(
  PERFIL_TECHO.gotero_lateral_camara.ISODEC_PIR._all.sku,
  "GLDCAMPIR",
  "ISODEC PIR lateral-camara fallback must not regress to the generic GLDCAM-DC SKU",
);
assert.equal(resolveSKU_techo("gotero_lateral_camara", "ISODEC_PIR", 80).sku, "GLDCAMPIR");

const perfilRows = flattenPerfilesLibre({}, PERFIL_PARED);
const perfilById = new Map(perfilRows.map((row) => [row.id, row]));
assert.equal(perfilById.get("pp:perfil_u:ISOFRIG:80")?.sku, "PU80MM");
assert.equal(perfilById.get("pp:perfil_u:ISOFRIG:100")?.sku, "PU100MM");
assert.equal(perfilById.get("pp:perfil_u:ISOFRIG:150")?.sku, "PU150MM");
for (const invalidEspesor of [40, 60, 120, 180, 200]) {
  assert.equal(
    perfilById.has(`pp:perfil_u:ISOFRIG:${invalidEspesor}`),
    false,
    `ISOFRIG ${invalidEspesor} mm must not invent perfil U prices by analogy`,
  );
}

console.log("isofrigCatalogRegression: all assertions passed");
