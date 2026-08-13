/**
 * Bug DW/DQ — project import must clear prior-session libre/manual BOM lines.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildLibreUiStateFromDeserialized,
  DEFAULT_LIBRE_ACC,
} from "../src/utils/projectLibreReset.js";
import { deserializeProject } from "../src/utils/projectFile.js";
import { computePresupuestoLibreCatalogo } from "../src/utils/presupuestoLibreCatalogo.js";

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
  "must not guard librePanelLines with if(state.libre*) (Bug DW regression)",
);
assert.ok(
  !/if \(state\.librePerfilQty\) setLibrePerfilQty/.test(calcSrc),
  "must not guard librePerfilQty with if(state.libre*) (Bug DW regression)",
);
assert.ok(
  !/if \(s\.librePanelLines\) setLibrePanelLines/.test(calcSrc),
  "budget restore must not guard librePanelLines (Bug DW regression)",
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
assert.deepEqual(clean.libreExtras, []);
assert.deepEqual(clean.libreAcc, { ...DEFAULT_LIBRE_ACC });

// Dirty prior-session qty maps must not survive a clean import
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
const contaminatedAdditive = computePresupuestoLibreCatalogo({
  listaPrecios: "venta",
  librePanelLines: [
    { familia: "ISODEC", espesor: "50", color: "Blanco", m2: 40 },
  ],
  librePerfilQty: { X: 10 },
  libreFijQty: { Y: 20 },
  libreSellQty: { Z: 5 },
  libreExtras: [{ titulo: "Mano de obra", precio: "500", cantidad: "1" }],
});
assert.ok(
  (contaminatedAdditive.libreGroups || []).some((g) => (g.items || []).length > 0),
  "sanity: contaminated session would add money",
);

const afterImportAdditive = computePresupuestoLibreCatalogo({
  listaPrecios: "venta",
  librePanelLines: dirtyThenClean.librePanelLines,
  librePerfilQty: dirtyThenClean.librePerfilQty,
  libreFijQty: dirtyThenClean.libreFijQty,
  libreSellQty: dirtyThenClean.libreSellQty,
  libreExtras: dirtyThenClean.libreExtras,
});
const moneyItems = (afterImportAdditive.libreGroups || []).flatMap((g) => g.items || []);
assert.equal(
  moneyItems.length,
  0,
  "clean import must yield zero additive libre BOM lines (Bug DW)",
);

// Present libre fields still hydrate
const withExtras = buildLibreUiStateFromDeserialized(
  deserializeProject({
    scenario: "solo_techo",
    librePanelLines: [{ familia: "ISODEC", espesor: "50", color: "Blanco", m2: 12 }],
    libreExtras: [{ titulo: "Corte especial", precio: "100", cantidad: "2" }],
    librePerfilQty: { P1: 3 },
  }),
);
assert.equal(withExtras.librePanelLines[0].familia, "ISODEC");
assert.equal(withExtras.libreExtras.length, 1);
assert.equal(withExtras.libreExtras[0].titulo, "Corte especial");
assert.equal(withExtras.librePerfilQty.P1, 3);

console.log("projectLibreReset.test.js: ok");
