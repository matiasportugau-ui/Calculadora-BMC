/**
 * Bug DQ — project import must clear prior-session libre/manual BOM lines.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildLibreUiStateFromDeserialized,
  DEFAULT_LIBRE_ACC,
  DEFAULT_LIBRE_EXTRA,
} from "../src/utils/projectLibreReset.js";
import { deserializeProject } from "../src/utils/projectFile.js";
import { computePresupuestoLibreCatalogo } from "../src/utils/presupuestoLibreCatalogo.js";
import { mergeLibreGroups, bomToGroups } from "../src/utils/helpers.js";
import { executeScenario } from "../src/utils/scenarioOrchestrator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const calcSrc = readFileSync(
  join(__dirname, "../src/components/PanelinCalculadoraV3_backup.jsx"),
  "utf8",
);

assert.match(
  calcSrc,
  /buildLibreUiStateFromDeserialized/,
  "calculator import path must use buildLibreUiStateFromDeserialized",
);
assert.ok(
  !/if \(state\.librePanelLines\) setLibrePanelLines/.test(calcSrc),
  "must not guard librePanelLines with if(state.libre*) (Bug DQ regression)",
);
assert.ok(
  !/if \(state\.librePerfilQty\) setLibrePerfilQty/.test(calcSrc),
  "must not guard librePerfilQty with if(state.libre*) (Bug DQ regression)",
);

// Absent libre fields → empty qty maps + blank panel line (not prior-session leftovers)
const clean = buildLibreUiStateFromDeserialized(
  deserializeProject({
    scenario: "solo_techo",
    techo: {
      familia: "ISODEC",
      espesor: "50",
      zonas: [{ largo: 6, ancho: 5 }],
    },
  }),
);
assert.deepEqual(clean.librePerfilQty, {});
assert.deepEqual(clean.libreFijQty, {});
assert.deepEqual(clean.libreSellQty, {});
assert.equal(clean.librePanelLines.length, 1);
assert.equal(clean.librePanelLines[0].familia, "");
assert.deepEqual(clean.libreAcc, { ...DEFAULT_LIBRE_ACC });
assert.deepEqual(clean.libreExtra, { ...DEFAULT_LIBRE_EXTRA });

// Dirty prior session then "import" clean quote → additive groups must be empty
const dirtyThenClean = buildLibreUiStateFromDeserialized(
  deserializeProject({
    scenario: "solo_techo",
    listaPrecios: "venta",
    techo: {
      familia: "ISODEC",
      espesor: "50",
      color: "Blanco",
      zonas: [{ largo: 6, ancho: 5, dosAguas: false }],
      pendiente: 0,
      tipoAguas: "una_agua",
      tipoEst: "metal",
    },
  }),
);
// Simulate what Bug DQ left behind before the fix:
const contaminated = {
  librePanelLines: [
    {
      familia: "ISODEC",
      espesor: "100",
      color: "Blanco",
      m2: 40,
      inputModo: "m2",
    },
  ],
  librePerfilQty: { "some-perfil": 12 },
  libreFijQty: {},
  libreSellQty: {},
  libreExtra: { texto: "ghost", precio: "100", unidades: "1", cantidad: "1" },
};
const additiveDirty = computePresupuestoLibreCatalogo({
  listaPrecios: "venta",
  ...contaminated,
  flete: 0,
});
assert.ok(
  (additiveDirty.libreGroups || []).some((g) => g.items?.length),
  "sanity: dirty libre state produces BOM lines",
);

const additiveClean = computePresupuestoLibreCatalogo({
  listaPrecios: "venta",
  librePanelLines: dirtyThenClean.librePanelLines,
  librePerfilQty: dirtyThenClean.librePerfilQty,
  libreFijQty: dirtyThenClean.libreFijQty,
  libreSellQty: dirtyThenClean.libreSellQty,
  libreExtra: dirtyThenClean.libreExtra,
  flete: 0,
});
const cleanItems = (additiveClean.libreGroups || []).flatMap((g) => g.items || []);
assert.equal(
  cleanItems.length,
  0,
  "after reset, additive libre groups must not inflate imported solo_techo BOM",
);

// Preserve libre lines when the imported project actually has them
const withLibre = buildLibreUiStateFromDeserialized(
  deserializeProject({
    scenario: "presupuesto_libre",
    listaPrecios: "venta",
    librePanelLines: [
      { familia: "ISODEC", espesor: "50", color: "Blanco", m2: 12, inputModo: "m2" },
    ],
    librePerfilQty: { x: 2 },
  }),
);
assert.equal(withLibre.librePanelLines.length, 1);
assert.equal(withLibre.librePanelLines[0].familia, "ISODEC");
assert.equal(withLibre.librePerfilQty.x, 2);

// Merge path: clean reset must not change scenario BOM totals vs no-libre merge
const roof = executeScenario("solo_techo", {
  techo: {
    familia: "ISODEC",
    espesor: "50",
    color: "Blanco",
    zonas: [{ largo: 6, ancho: 5, dosAguas: false }],
    pendiente: 0,
    tipoAguas: "una_agua",
    tipoEst: "metal",
    ptsHorm: 0,
    borders: {
      frente: "gotero_frontal",
      fondo: "gotero_lateral",
      latIzq: "gotero_lateral",
      latDer: "gotero_lateral",
    },
    opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
  },
  pared: {},
  camara: {},
});
const baseGroups = bomToGroups(roof);
const mergedClean = mergeLibreGroups(baseGroups, additiveClean.libreGroups || []);
const baseTotal = baseGroups
  .flatMap((g) => g.items || [])
  .reduce((s, i) => s + (Number(i.total) || 0), 0);
const mergedTotal = mergedClean
  .flatMap((g) => g.items || [])
  .reduce((s, i) => s + (Number(i.total) || 0), 0);
assert.equal(
  mergedTotal,
  baseTotal,
  "mergeLibreGroups after clean reset must not change scenario subtotal",
);

console.log("projectLibreReset.test.js: OK");
