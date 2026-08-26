/**
 * Catalog / Agregar producto panel lines must stay in m² mode so the
 * "Paneles por medidas" editor matches computePresupuestoLibreCatalogo.
 * Regression: after #1115, missing inputModo made the UI show dimensiones
 * while the engine used m² — toggling mode rewrote quoted area.
 */
import assert from "node:assert/strict";
import {
  computeLibrePanelLineMetrics,
  resolveLibrePanelInputModo,
} from "../src/utils/librePanelDimensions.js";
import { computePresupuestoLibreCatalogo } from "../src/utils/presupuestoLibreCatalogo.js";
import { PANELS_TECHO } from "../src/data/constants.js";

const fam = Object.keys(PANELS_TECHO)[0];
const panel = PANELS_TECHO[fam];
const espesor = Number(Object.keys(panel.esp)[0]);

/** Shape written by quickAddPanel / ProductCatalogPicker onAddPanel */
function catalogPanelLine(m2) {
  return {
    familia: fam,
    espesor,
    color: "Blanco",
    m2,
    inputModo: "m2",
  };
}

assert.equal(resolveLibrePanelInputModo({ inputModo: "m2" }), "m2");
assert.equal(resolveLibrePanelInputModo({ inputModo: "dimensiones" }), "dimensiones");
assert.equal(
  resolveLibrePanelInputModo({ m2: 50 }),
  "m2",
  "missing inputModo must default to m2 (engine + UI)",
);
assert.equal(resolveLibrePanelInputModo({}), "m2");

const line = catalogPanelLine(50);
assert.equal(resolveLibrePanelInputModo(line), "m2");
assert.equal(computeLibrePanelLineMetrics(line, {}).m2, 50);
assert.equal(computeLibrePanelLineMetrics(line, {}).mode, "m2");

// Legacy catalog add without inputModo (pre-fix) still prices by m²
const legacy = { familia: fam, espesor, color: "Blanco", m2: 50 };
assert.equal(computeLibrePanelLineMetrics(legacy, {}).m2, 50);
assert.equal(resolveLibrePanelInputModo(legacy), "m2");

const priced = computePresupuestoLibreCatalogo({
  listaPrecios: "web",
  librePanelLines: [line],
  librePerfilQty: {},
  libreFijQty: {},
  libreSellQty: {},
  flete: 0,
});
const panelItem = priced.allItems.find((i) => i.unidad === "m²");
assert.ok(panelItem, "catalog m2 line appears in BOM");
assert.equal(panelItem.cant, 50);

// Explicit dimensiones must NOT keep the catalog m2 when mode is set
const asDims = {
  ...legacy,
  inputModo: "dimensiones",
  anchoModo: "paneles",
  panelesAncho: 9,
  tramos: [{ largo: 6 }],
};
const dimM2 = computeLibrePanelLineMetrics(asDims, {}).m2;
assert.notEqual(dimM2, 50, "dimensiones mode uses largo×ancho, not leftover m2 field");
assert.ok(dimM2 > 0, `expected positive dimensiones m2, got ${dimM2}`);

console.log("librePanelInputModo.test.js: ok");
