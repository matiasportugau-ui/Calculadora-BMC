// ═══════════════════════════════════════════════════════════════════════════
// roofVisualQuoteConsistency.js — Alineación planta 2D vs conteo paneles (Node)
// Ejecutar: node tests/roofVisualQuoteConsistency.js
// También invocado desde npm test.
// ═══════════════════════════════════════════════════════════════════════════

import { calcPanelesTecho } from "../src/utils/calculations.js";
import { getPricing } from "../src/data/pricing.js";
import { panelCountAcrossAnchoPlanta, buildAnchoStripsPlanta } from "../src/utils/roofPanelStripsPlanta.js";
import {
  calcCantPanelesAnchoSingleRun,
  resolveRoofZoneVisualModel,
  resolveZonaPlantaAnchoM,
  stripCountForPlantaWidth,
  visualAnchoAlignsWithSingleCalcRun,
} from "../src/utils/roofVisualQuoteModel.js";
import { executeScenario } from "../src/utils/scenarioOrchestrator.js";

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    console.error("FAIL:", msg);
  }
}

const { PANELS_TECHO } = getPricing();
const panel = PANELS_TECHO.ISODEC_EPS;
const esp = 100;
const au = panel.au;
const largo = 6;

// 1) Franjas === columnas simbólicas
const wTest = 5.0;
assert(
  stripCountForPlantaWidth(wTest, au) === panelCountAcrossAnchoPlanta(wTest, au),
  "stripCount debe igualar panelCountAcrossAnchoPlanta",
);

// 2) Una corrida: calcPanelesTecho.cantPaneles === ceil(w/au) === panelCount (w>0)
const paneles = calcPanelesTecho(panel, esp, largo, wTest);
assert(paneles && paneles.cantPaneles === Math.ceil(wTest / au), "calcPanelesTecho cantPaneles vs ceil");
assert(
  paneles && paneles.cantPaneles === panelCountAcrossAnchoPlanta(wTest, au),
  "calcPanelesTecho cantPaneles vs panelCountAcrossAnchoPlanta (una agua w)",
);
assert(visualAnchoAlignsWithSingleCalcRun(wTest, au), "visualAnchoAlignsWithSingleCalcRun w=5");

// 3) Dos aguas: ancho planta = mitad; una corrida con mitad coincide con columnas visuales
const anchoTotal = 10;
const wHalf = resolveZonaPlantaAnchoM(anchoTotal, "dos_aguas");
assert(Math.abs(wHalf - 5) < 1e-9, "eff ancho planta dos aguas = ancho/2");
const halfPaneles = calcPanelesTecho(panel, esp, largo, wHalf);
const colsHalf = panelCountAcrossAnchoPlanta(wHalf, au);
assert(
  halfPaneles && halfPaneles.cantPaneles === colsHalf,
  "dos aguas: cantPaneles una corrida mitad === columnas planta rect",
);

// 4) executeScenario solo_techo suma dos corridas → cantPaneles merged = 2 × columna por faldón (simétrico)
const techoMock = {
  familia: "ISODEC_EPS",
  espesor: esp,
  color: "Blanco",
  tipoAguas: "dos_aguas",
  tipoEst: "metal",
  pendiente: 0,
  pendienteModo: "calcular_pendiente",
  alturaDif: 0,
  ptsHorm: 0,
  borders: { frente: "gotero_frontal", fondo: "cumbrera", latIzq: "gotero_lateral", latDer: "gotero_lateral" },
  opciones: { inclCanalon: false, inclGotSup: false, inclSell: true, bomComercial: false },
  zonas: [{ largo, ancho: anchoTotal }],
  inclAccesorios: true,
};

const scenarioRes = executeScenario("solo_techo", { techo: techoMock, pared: {}, camara: {} });
const mergedCant = scenarioRes?.paneles?.cantPaneles;
const expectedMerged = colsHalf * 2;
assert(
  mergedCant === expectedMerged,
  `dos aguas merged cantPaneles: got ${mergedCant}, expected ${expectedMerged}`,
);

// 5) resolveRoofZoneVisualModel bandera alineación
const vm = resolveRoofZoneVisualModel({ largo, ancho: anchoTotal }, "dos_aguas", au);
assert(vm.visualAlignsSingleSlope === true, "resolveRoofZoneVisualModel.visualAlignsSingleSlope");
assert(
  vm.expectedCantPanelesZonaMergedDosAguas === expectedMerged,
  "expectedCantPanelesZonaMergedDosAguas",
);

// 6) buildAnchoStripsPlanta suma anchos ≈ w
const strips = buildAnchoStripsPlanta(wTest, au);
const sumW = strips.reduce((s, x) => s + x.width, 0);
assert(Math.abs(sumW - wTest) < 1e-6, "suma franjas === ancho planta");

console.log(`roofVisualQuoteConsistency: ${passed} ok${failed ? `, ${failed} failed` : ""}`);
if (failed) process.exit(1);
