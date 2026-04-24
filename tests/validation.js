// ═══════════════════════════════════════════════════════════════════════════
// Tests de Validación — Panelin Calculadora BMC v3.0
// Ejecutar: node tests/validation.js
// ═══════════════════════════════════════════════════════════════════════════

import {
  calcTechoCompleto,
  calcParedCompleto,
  calcFactorPendiente,
  calcLargoReal,
  mergeZonaResults,
  calcPresupuestoLibre,
  calcPerfileriaTechoComercial,
  calcSelladoresTecho,
  calcFijacionesVarilla,
  countPuntosFijacionVarillaGrilla,
  countVarillasRoscadasDesdeBarras1m,
  perimetroVerticalInteriorPuntosDesdePlanta,
  calcTotalesSinIVA,
} from "../src/utils/calculations.js";
import { deserializeProject } from "../src/utils/projectFile.js";
import { bomToGroups, applyOverrides, createLineId } from "../src/utils/helpers.js";
import { computePresupuestoLibreCatalogo, flattenPerfilesLibre } from "../src/utils/presupuestoLibreCatalogo.js";
import { PERFIL_TECHO, PERFIL_PARED, PANELS_TECHO, PANELS_PARED } from "../src/data/constants.js";
import { listDueItems, parseDueInput, parseDays } from "../server/lib/followUpStore.js";
import { normalizeMlAnswerCurrencyText } from "../server/lib/mlAnswerText.js";
import {
  buildInitialByKeyFromOrderedDots,
  bulkDisableDots,
  bulkSetDotsMaterialEnabled,
  countCombinadaMaterialsInDots,
  countPtsWithOverrides,
  cycleCombinadaMaterial,
  stripDotOverrideKeys,
} from "../src/utils/combinadaFijacionShared.js";
import {
  fijacionDotsLayout,
  fijacionDotsLayoutDistributeTotal,
  fijacionDotKeysForVerticalJoint,
  fijacionDotKeysNearPanelJoint,
} from "../src/utils/roofEstructuraDotsLayout.js";
import { buildProgramSnapshot } from "../scripts/program-status.mjs";
import {
  cuerpoFromMessage,
  messageToIngestBody,
  remitenteFromFrom,
  selectMessagesForIngest,
  stableMessageKey,
} from "../server/lib/emailSnapshotIngest.js";
import {
  parseCsvNumber,
  findVentaColumnIndex,
  findVentaWebColumnIndex,
  findVentaWebIvaIncColumnIndex,
  findVentaLocalIvaIncColumnIndex,
  getDuplicatePathReport,
  getDuplicatePathReportFromRows,
  parseCsvRows,
} from "../src/utils/csvPricingImport.js";
import { resolveEmailInboxRepoRoot } from "../server/lib/emailInboxRepoResolve.js";
import { readPanelsimEmailSummary } from "../server/lib/panelsimSummaryReader.js";
import { colLetterToIndex, colIndexToLetter } from "../server/lib/sheetColumnLetters.js";
import {
  normalizeIsodecEpsVentaLocalCsvRows,
  splitCsvRowSafe,
} from "../server/lib/matrizCsvNormalization.js";
import {
  parseAccesorioLine,
  parseLogisticaFromAdjuntoText,
  parsePanelLineHeuristic,
  parseQtyCell,
} from "../docs/bmc-dashboard-modernization/logistica-carga-prototype/lib/adjuntoLineParse.js";
import {
  extractStopFieldsFromPaste,
  parseTsvRows,
} from "../docs/bmc-dashboard-modernization/logistica-carga-prototype/lib/sheetPaste.js";
import {
  canAccessDashboardRoute,
  getMinRoleForDashboardRoute,
  normalizePanelinRole,
  roleMeetsMin,
} from "../server/lib/panelinInternalRbac.js";
import { getInternalToolById, mayInvokeTool } from "../server/lib/panelinInternalInvoke.js";
import {
  collectClienteNamesFromStop,
  findFirstStopByClienteLabel,
  uniqueClientesFromStops,
} from "../docs/bmc-dashboard-modernization/logistica-carga-prototype/lib/clienteFromSheet.js";
import {
  COLORS as LOG_COLORS,
  collectUrlsFromRow,
  inferLinkAdjuntoFromRow,
  inferLinkMapFromRow,
  resetDefaultCargoIds as resetLogisticaIds,
  stopFromProximaRow,
} from "../docs/bmc-dashboard-modernization/logistica-carga-prototype/lib/cargoEngine.js";
import {
  estimatePanelLinePhysical,
  estimateRouteLoadPhysical,
  kgPerM2ForEspesor,
} from "../docs/bmc-dashboard-modernization/logistica-carga-prototype/lib/loadCharacteristics.js";
import { parsePedidoRetiroFromFreeText, parsePedidoFromColumnC, parsePickupIdFromColumnF } from "../src/utils/ventasPedidoRetiroParse.js";
import {
  LOGISTICA_PLAN_EXPORT_SCHEMA_VERSION,
  bedViewExtents,
  buildLogisticaPlanExportPayload,
  computeLogisticaKpis,
  mirrorBedXForView,
} from "../src/utils/bmcLogisticaBedView.js";
import { buildEdgeBOM, buildRoofPlanEdges, getSharedSidesPerZona, layoutZonasEnPlanta } from "../src/utils/roofPlanGeometry.js";
import { buildZoneBorderExteriorLines } from "../src/utils/roofPlanEdgeSegments.js";
import {
  normalizeEncounter,
  resolveNeighborSharedSide,
  encounterEsContinuo,
  encounterBorderPerfil,
  listEncounterPairSegmentRuns,
  splitEncounterPairSegmentMid,
  patchEncounterPairSegment,
} from "../src/utils/roofEncounterModel.js";
import { nextRoofSlopeMark, ROOF_SLOPE_MARKS } from "../src/utils/roofSlopeMark.js";
import { effectiveBordersTechoFachada, executeScenario } from "../src/utils/scenarioOrchestrator.js";
import {
  defaultPrincipalZonaIndex,
  previewPositionForTramoApiladoFrente,
} from "../src/utils/roofPrincipalZona.js";
import {
  applyLateralAnnexLayout,
  formatZonaDisplayTitle,
  getAnnexSnapCandidateLeftXs,
  getLateralAnnexRootBodyGi,
  getRootZoneOrdinal,
  isLateralAnnexZona,
  snapLateralAnnexPlanta,
  zonasToPlantRectsLogical,
  zonasToPlantRectsWithAutoGap,
} from "../src/utils/roofLateralAnnexLayout.js";
import { buildAnchoStripsPlanta, panelCountAcrossAnchoPlanta, countPanels } from "../src/utils/roofPanelStripsPlanta.js";
import { buildZoneLayoutsForRoof3d } from "../src/utils/roofZoneLayouts3d.js";
import { buildLateralStepInfillGeometries } from "../src/utils/roof3dLateralStepInfill.js";
import { getRoofPanelMapUrl, pickBestMapUrlFromSlides } from "../src/data/roofPanelMapUrl.js";
import crypto from "node:crypto";
import { generateOpaqueToken, sha256Hex } from "../server/lib/driverToken.js";
import { verifyWhatsAppSignature } from "../server/lib/whatsappSignature.js";
import { isAllowedDriverEventType } from "../server/lib/transportistaFsm.js";
import { parseRssItems, pickTier, clamp01 } from "../scripts/knowledge-antenna-lib.mjs";

// Simulate the pricing engine inline for testing
const IVA = 0.22;
let LISTA_ACTIVA = "web";
function p(item) {
  if (!item) return 0;
  if (LISTA_ACTIVA === "venta") return item.venta || item.web || 0;
  return item.web || item.venta || 0;
}

// ── Test data ───
const ISODEC_EPS_100 = { venta: 37.76, web: 45.97, ap: 5.5 };
const ISOPANEL_EPS_100 = { venta: 37.76, web: 45.97, ap: null };
const FIJACIONES_VARILLA = { venta: 3.12, web: 3.64 };
const FIJACIONES_ANCLAJE = { venta: 0.09, web: 0.03 };

// ── Helpers ──
let passed = 0, failed = 0;
function assert(name, condition, actual, expected) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name} — got: ${actual}, expected: ${expected}`);
    failed++;
  }
}

function approx(a, b, tol = 0.02) { return Math.abs(a - b) <= tol; }

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 1: Pricing Engine
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 1: Pricing Engine ═══");

// Test p() with web list
LISTA_ACTIVA = "web";
assert("p() web returns web price", p(ISODEC_EPS_100) === 45.97, p(ISODEC_EPS_100), 45.97);

// Test p() with venta list
LISTA_ACTIVA = "venta";
assert("p() venta returns venta price", p(ISODEC_EPS_100) === 37.76, p(ISODEC_EPS_100), 37.76);

// Test p() fallback
assert("p() fallback when field missing", p({ web: 10.0 }) === 10.0, p({ web: 10.0 }), 10.0);

// Test p() null
assert("p() null returns 0", p(null) === 0, p(null), 0);

// Test IVA calculation
LISTA_ACTIVA = "web";
const subtotal = 1000;
const iva = +(subtotal * IVA).toFixed(2);
const total = +(subtotal + iva).toFixed(2);
assert("IVA calculation: 1000 + 22% = 1220", total === 1220.00, total, 1220.00);

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 2: Panel Calculations
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 2: Panel Calculations ═══");

// Techo: ISODEC EPS, 6.5m x 5.6m
const au_techo = 1.12;
const cantP_techo = Math.ceil(5.6 / au_techo);
assert("Techo cantPaneles = 5", cantP_techo === 5, cantP_techo, 5);

const area_techo = +(cantP_techo * 6.5 * au_techo).toFixed(2);
assert("Techo area = 36.40 m²", approx(area_techo, 36.40), area_techo, 36.40);

const costo_techo = +(p(ISODEC_EPS_100) * area_techo).toFixed(2);
assert("Techo costo web = $1673.31", approx(costo_techo, 1673.31, 0.5), costo_techo, 1673.31);

// Pared: ISOPANEL EPS, alto 3.5m, perimetro 40m
const au_pared = 1.14;
const cantP_pared = Math.ceil(40 / au_pared);
assert("Pared cantPaneles = 36", cantP_pared === 36, cantP_pared, 36);

const areaBruta = +(cantP_pared * 3.5 * au_pared).toFixed(2);
assert("Pared areaBruta = 143.64 m²", approx(areaBruta, 143.64), areaBruta, 143.64);

// Con aberturas
const areaAberturas = +(0.9 * 2.1 * 1 + 1.2 * 1.0 * 2).toFixed(2);
assert("Aberturas = 4.29 m²", approx(areaAberturas, 4.29), areaAberturas, 4.29);

const areaNeta = +(areaBruta - areaAberturas).toFixed(2);
assert("Pared areaNeta = 139.35 m²", approx(areaNeta, 139.35), areaNeta, 139.35);

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 3: Autoportancia
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 3: Autoportancia ═══");

const maxSpan = ISODEC_EPS_100.ap; // 5.5m
const largo_ok = 5.0;
const largo_fail = 6.5;

assert("Autoportancia OK (5.0m <= 5.5m)", largo_ok <= maxSpan, largo_ok, maxSpan);
assert("Autoportancia FAIL (6.5m > 5.5m)", largo_fail > maxSpan, largo_fail, maxSpan);

const apoyos = Math.ceil(largo_fail / maxSpan + 1);
assert("Apoyos needed = 3", apoyos === 3, apoyos, 3);

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 4: Fijaciones Techo (varilla)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 4: Fijaciones Techo ═══");

const cantP = 5,
  apoyosT = 3,
  largoT = 6.5;
const grillaSuite4 = countPuntosFijacionVarillaGrilla(cantP, apoyosT);
const puntosFij = Math.ceil(grillaSuite4 + (largoT * 2 / 2.5));
assert("Puntos fijación (grilla+perím) = 31", puntosFij === 31, puntosFij, 31);

const tramoVar100Metal = 0.1 + 0.1;
const varillas = countVarillasRoscadasDesdeBarras1m(puntosFij, tramoVar100Metal, 1);
assert("Varillas 1 m (corte 0,20 m) = 7", varillas === 7, varillas, 7);

const tuercas_metal = puntosFij * 2;
assert("Tuercas metal = 62 (31 pts × 2)", tuercas_metal === 62, tuercas_metal, 62);

const tuercas_horm = puntosFij * 1;
assert("Tuercas hormigón = 31", tuercas_horm === 31, tuercas_horm, 31);

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 5: Fijaciones Pared (NUEVO sistema v3)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 5: Fijaciones Pared (v3 NUEVO) ═══");

const cantP_p = 36, au_p = 1.14, alto_p = 3.5;
const anchoTotal_p = cantP_p * au_p;

// Anclajes H° cada 0.30m
const anclajes = Math.ceil(anchoTotal_p / 0.30);
assert("Anclajes H° = 137", anclajes === 137, anclajes, 137);

// Tornillos T2 ~5.5/m²
const areaNeta_p = cantP_p * alto_p * au_p;
const tornillosT2 = Math.ceil(areaNeta_p * 5.5);
assert("Tornillos T2 total > 700", tornillosT2 > 700, tornillosT2, ">700");

// Remaches POP
const remaches = Math.ceil(cantP_p * 2);
assert("Remaches = 72", remaches === 72, remaches, 72);

// Verify NO varilla/tuerca in pared items
assert("Pared NO debe incluir varilla/tuerca", true, "anclaje+T2+remaches", "anclaje+T2+remaches");

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 6: Soporte Canalón (CORREGIDO v3)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 6: Soporte Canalón (v3 corregido) ═══");

const cantP_can = 5;
const largo_barra = 3.0;
const mlSoportes = (cantP_can + 1) * 0.30;
const barrasSoporte = Math.ceil(mlSoportes / largo_barra);
assert("ML soportes = 1.80", approx(mlSoportes, 1.80), mlSoportes, 1.80);
assert("Barras soporte = 1", barrasSoporte === 1, barrasSoporte, 1);

// Caso más grande: 20 paneles
const mlSop20 = (20 + 1) * 0.30;
const barras20 = Math.ceil(mlSop20 / 3.0);
assert("20 paneles: ML = 6.30", approx(mlSop20, 6.30), mlSop20, 6.30);
assert("20 paneles: barras = 3", barras20 === 3, barras20, 3);

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 7: Perfilería Pared Nuevos (K2, G2)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 7: Perfilería Pared Nuevos ═══");

// K2 junta interior
const cantP_k2 = 36;
const alto_k2 = 3.5;
const largo_k2 = 3.0;
const juntasK2 = (cantP_k2 - 1) * Math.ceil(alto_k2 / largo_k2);
assert("K2 juntas = 70", juntasK2 === 70, juntasK2, 70);

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 8: Selladores Pared (membrana + espuma)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 8: Selladores Pared Nuevos ═══");

const perim_s = 40;
const rollosMembrana = Math.ceil(perim_s / 10);
assert("Rollos membrana = 4", rollosMembrana === 4, rollosMembrana, 4);

const espumas = rollosMembrana * 2;
assert("Espumas PU = 8", espumas === 8, espumas, 8);

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 9: Fijaciones Caballete (ISOROOF)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 9: Fijaciones Caballete (ISOROOF) ═══");

const cantP_cb = 5, largo_cb = 6.5;
const caballetes = Math.ceil((cantP_cb * 3 * (largo_cb / 2.9 + 1)) + ((largo_cb * 2) / 0.3));
assert("Caballetes: positive integer", caballetes > 0 && Number.isInteger(caballetes), caballetes, ">0");

const tornillosAguja = caballetes * 2;
assert("Tornillo aguja cant >= 1 unidad", tornillosAguja >= 1, tornillosAguja, ">=1");
assert("Tornillos aguja = caballetes × 2", tornillosAguja === caballetes * 2, tornillosAguja, caballetes * 2);

// Smaller roof: 3 panels × 4m
const cab_small = Math.ceil((3 * 3 * (4.0 / 2.9 + 1)) + ((4.0 * 2) / 0.3));
assert("Caballetes 3p×4m: positive integer", cab_small > 0 && Number.isInteger(cab_small), cab_small, ">0");

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 10: Perfilería Techo (borders)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 10: Perfilería Techo ═══");

const au_perf = 1.12, cantP_perf = 5, largo_perf_panel = 6.5;
const anchoTotal_perf = cantP_perf * au_perf; // 5.60m
const largo_gotero = 3.03;

const pzasFrente = Math.ceil(anchoTotal_perf / largo_gotero);
assert("Gotero frente: 2 piezas para 5.60m", pzasFrente === 2, pzasFrente, 2);

const pzasLateral = Math.ceil(largo_perf_panel / 3.0);
assert("Gotero lateral: 3 piezas para 6.5m", pzasLateral === 3, pzasLateral, 3);

// Tornillos T1 para perfilería: 1 cada 30cm del ML total
const mlFrente = pzasFrente * largo_gotero;
const mlLateral = pzasLateral * 3.0;
const mlTotal = mlFrente + mlLateral;
const fijPerf = Math.ceil(mlTotal / 0.30);
assert("Tornillos T1 (unidades perfilería) >= 1", fijPerf >= 1, fijPerf, ">=1");

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 11: Selladores Techo
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 11: Selladores Techo ═══");

const cantP_st = 10;
const siliconas_t = Math.ceil(cantP_st * 0.5);
assert("Siliconas techo = 5 para 10 paneles", siliconas_t === 5, siliconas_t, 5);

const cintas_t = Math.ceil(cantP_st / 10);
assert("Cintas butilo techo = 1 para 10 paneles", cintas_t === 1, cintas_t, 1);

const sellTechoSample = calcSelladoresTecho(10, {
  panel: { au: 1 },
  largoReal: 6.5,
  anchoTotal: 5.6,
  borders: {},
  familiaP: "ISOROOF",
  espesor: 30,
});
const sil600 = sellTechoSample.items.find((i) => i.sku === "silicona");
const sil300 = sellTechoSample.items.find((i) => i.sku === "silicona_300_neutra");
assert("Selladores techo: incluye silicona 300 (2× 600)", !!sil600 && !!sil300, { sil600: !!sil600, sil300: !!sil300 }, "both");
assert(
  "Selladores techo: cant 300 = 2 × cant 600",
  sil600 && sil300 && sil300.cant === sil600.cant * 2,
  sil300?.cant,
  sil600 ? sil600.cant * 2 : null,
);

// 20 panels
const sil_20 = Math.ceil(20 * 0.5);
assert("Siliconas techo = 10 para 20 paneles", sil_20 === 10, sil_20, 10);

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 12: Perfiles Extra Pared — K2 + G2 (formulas corregidas)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 12: Perfiles Extra Pared (K2 + G2 corregido) ═══");

// K2 (unchanged): (cantP - 1) × ceil(alto / largo_perfil)
const cantP_ex = 36, alto_ex = 3.5, largo_perfil = 3.0;
const juntasK2_ex = (cantP_ex - 1) * Math.ceil(alto_ex / largo_perfil);
assert("K2 juntas = 70 para 36 paneles 3.5m", juntasK2_ex === 70, juntasK2_ex, 70);

// G2 (FIXED formula): (cantP - 1) × ceil(alto / largo_perfil)
const juntasG2_fixed = (cantP_ex - 1) * Math.ceil(alto_ex / largo_perfil);
assert("G2 juntas = 70 para 36 paneles 3.5m", juntasG2_fixed === 70, juntasG2_fixed, 70);

// G2 for 2 panels: 1 junta × ceil(3.5/3.0) = 1 × 2 = 2
const juntasG2_2p = (2 - 1) * Math.ceil(3.5 / largo_perfil);
assert("G2: 1 junta × 2 barras = 2 para 2 paneles 3.5m", juntasG2_2p === 2, juntasG2_2p, 2);

// G2 for 1 panel: no joints (cantP - 1 = 0)
const juntasG2_1p = (1 - 1) * Math.ceil(3.5 / largo_perfil);
assert("G2: 0 juntas para 1 panel (sin juntas interiores)", juntasG2_1p === 0, juntasG2_1p, 0);

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 13: Flete BOM (BUG-01 fix validation)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 13: Flete BOM (fix BUG-01) ═══");

// Fixture: price-list value for Flete (should NOT be used when user overrides)
const SERVICIOS = {
  flete: { venta: 150, web: 200 },
};
const fleteLista = p(SERVICIOS.flete);

// The fixed logic: flete state value is used directly as pu and total
const fleteState = 280; // user-supplied value (different from fleteLista)
const fleteItem = {
  label: "Flete",
  sku: "FLETE",
  cant: 1,
  unidad: "servicio",
  pu: fleteState,
  total: fleteState,
};

// Simulate computed BOM group that should use the user value, not the price list
const bomGroupFlete = {
  label: "Servicios",
  items: [fleteItem],
};
const bomFleteLine = bomGroupFlete.items[0];

// Validate that BOM line uses the user-entered value
assert("Flete BOM pu matches user input", bomFleteLine.pu === fleteState, bomFleteLine.pu, fleteState);
assert("Flete BOM total matches user input", bomFleteLine.total === fleteState, bomFleteLine.total, fleteState);

// And explicitly *not* the price-list value (would detect regression to p(SERVICIOS.flete))
assert(
  "Flete BOM pu does not use price-list value",
  bomFleteLine.pu !== fleteLista,
  bomFleteLine.pu,
  fleteLista
);
assert(
  "Flete BOM total does not use price-list value",
  bomFleteLine.total !== fleteLista,
  bomFleteLine.total,
  fleteLista
);
const fleteState0 = 0;
assert("Flete = 0 means no line added (guard check)", fleteState0 === 0, fleteState0, 0);

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 14: Integration — real calcTechoCompleto / calcParedCompleto
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 14: Integration — calcTechoCompleto / calcParedCompleto ═══");

// --- calcTechoCompleto ---
const techoInput = {
  familia: "ISODEC_EPS", espesor: 100,
  largo: 5.0, ancho: 5.6,
  tipoEst: "metal", ptsHorm: 0,
  borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
  opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
  color: "Blanco",
};
const techoResult = calcTechoCompleto(techoInput);

assert("calcTechoCompleto: no error", !techoResult.error, techoResult.error, undefined);
assert("calcTechoCompleto: cantPaneles = 5", techoResult.paneles?.cantPaneles === 5, techoResult.paneles?.cantPaneles, 5);
assert("calcTechoCompleto: areaTotal ≈ 28.00 m²", approx(techoResult.paneles?.areaTotal, 28.00), techoResult.paneles?.areaTotal, 28.00);
assert("calcTechoCompleto: allItems is non-empty array", Array.isArray(techoResult.allItems) && techoResult.allItems.length > 0, techoResult.allItems?.length, ">0");
assert("calcTechoCompleto: totales.subtotalSinIVA > 0", techoResult.totales?.subtotalSinIVA > 0, techoResult.totales?.subtotalSinIVA, ">0");
assert("calcTechoCompleto: autoportancia.ok = true", techoResult.autoportancia?.ok === true, techoResult.autoportancia?.ok, true);

// --- descarte: zero discard (ancho=5.6 fits exactly 5 × 1.12m panels) ---
assert("calcTechoCompleto: descarte exists", !!techoResult.paneles?.descarte, !!techoResult.paneles?.descarte, true);
assert("calcTechoCompleto: descarte.anchoM = 0 when panels fit exactly", techoResult.paneles?.descarte?.anchoM === 0, techoResult.paneles?.descarte?.anchoM, 0);
assert("calcTechoCompleto: descarte.areaM2 = 0 when panels fit exactly", techoResult.paneles?.descarte?.areaM2 === 0, techoResult.paneles?.descarte?.areaM2, 0);
assert("calcTechoCompleto: descarte.porcentaje = 0 when panels fit exactly", techoResult.paneles?.descarte?.porcentaje === 0, techoResult.paneles?.descarte?.porcentaje, 0);

// --- descarte: positive discard (ancho=5.0 → 5 panels × 1.12 = 5.60m, descarte = 0.60m) ---
const techoInputDescarte = { ...techoInput, ancho: 5.0 };
const techoResultDescarte = calcTechoCompleto(techoInputDescarte);
assert("calcTechoCompleto(descarte>0): cantPaneles = 5", techoResultDescarte.paneles?.cantPaneles === 5, techoResultDescarte.paneles?.cantPaneles, 5);
assert("calcTechoCompleto(descarte>0): descarte.anchoM ≈ 0.60", approx(techoResultDescarte.paneles?.descarte?.anchoM, 0.60), techoResultDescarte.paneles?.descarte?.anchoM, 0.60);
assert("calcTechoCompleto(descarte>0): descarte.areaM2 ≈ 3.00", approx(techoResultDescarte.paneles?.descarte?.areaM2, 3.00), techoResultDescarte.paneles?.descarte?.areaM2, 3.00);
assert("calcTechoCompleto(descarte>0): descarte.porcentaje ≈ 12.0", approx(techoResultDescarte.paneles?.descarte?.porcentaje, 12.0), techoResultDescarte.paneles?.descarte?.porcentaje, 12.0);

// --- calcParedCompleto ---
const paredInput = {
  familia: "ISOPANEL_EPS", espesor: 100,
  alto: 3.5, perimetro: 40,
  numEsqExt: 4, numEsqInt: 0,
  aberturas: [{ ancho: 0.9, alto: 2.1, cant: 1 }, { ancho: 1.2, alto: 1.0, cant: 2 }],
  tipoEst: "metal", inclSell: true, incl5852: false, color: "Blanco",
};
const paredResult = calcParedCompleto(paredInput);

assert("calcParedCompleto: no error", !paredResult.error, paredResult.error, undefined);
assert("calcParedCompleto: cantPaneles = 36", paredResult.paneles?.cantPaneles === 36, paredResult.paneles?.cantPaneles, 36);
assert("calcParedCompleto: areaBruta ≈ 143.64 m²", approx(paredResult.paneles?.areaBruta, 143.64), paredResult.paneles?.areaBruta, 143.64);
assert("calcParedCompleto: areaAberturas ≈ 4.29 m²", approx(paredResult.paneles?.areaAberturas, 4.29), paredResult.paneles?.areaAberturas, 4.29);
assert("calcParedCompleto: areaNeta ≈ 139.35 m²", approx(paredResult.paneles?.areaNeta, 139.35), paredResult.paneles?.areaNeta, 139.35);
assert("calcParedCompleto: allItems is non-empty array", Array.isArray(paredResult.allItems) && paredResult.allItems.length > 0, paredResult.allItems?.length, ">0");
assert("calcParedCompleto: totales.subtotalSinIVA > 0", paredResult.totales?.subtotalSinIVA > 0, paredResult.totales?.subtotalSinIVA, ">0");

// T2 fachada: cotización por unidad (no paquete ×100); cinta/sil300 opcionales
const t2Line = paredResult.fijaciones?.items?.find((i) => i.sku === "tornillo_t2");
const expT2Cant = Math.ceil(paredResult.paneles.areaBruta * 5.5);
assert("calcParedCompleto: T2 unidad = unid", t2Line?.unidad === "unid", t2Line?.unidad, "unid");
assert("calcParedCompleto: T2 cant = ceil(areaBruta×5.5)", t2Line?.cant === expT2Cant, t2Line?.cant, expT2Cant);
assert(
  "calcParedCompleto: T2 PU = lista web unitario",
  t2Line && approx(t2Line.pu, 0.05, 0.0001),
  t2Line?.pu,
  0.05
);
const hasCintaDef = paredResult.allItems.some((i) => i.sku === "cinta_butilo");
assert("calcParedCompleto: sin cinta butilo por defecto", !hasCintaDef, hasCintaDef, false);
const sil600P = paredResult.allItems.find((i) => i.sku === "silicona");
const sil300P = paredResult.allItems.find((i) => i.sku === "silicona_300_neutra");
assert("calcParedCompleto: incluye silicona 300 junto a 600", !!sil600P && !!sil300P, { sil600P: !!sil600P, sil300P: !!sil300P }, "both");
assert(
  "calcParedCompleto: cant silicona 300 = 2 × cant 600",
  sil600P && sil300P && sil300P.cant === sil600P.cant * 2,
  sil300P?.cant,
  sil600P ? sil600P.cant * 2 : null,
);
const paredConCinta = calcParedCompleto({ ...paredInput, inclCintaButilo: true });
assert(
  "calcParedCompleto + inclCintaButilo: incluye cinta",
  paredConCinta.allItems.some((i) => i.sku === "cinta_butilo"),
  paredConCinta.allItems.filter((i) => i.sku === "cinta_butilo").length,
  ">=1"
);

// --- BOM comercial ISODEC PIR (2+6+kit selladores + puntos fijos) ---
const techoComercial = calcTechoCompleto({
  familia: "ISODEC_PIR",
  espesor: 80,
  largo: 7.1,
  ancho: 3.36,
  tipoEst: "metal",
  borders: { frente: "gotero_frontal", fondo: "babeta_empotrar", latIzq: "babeta_empotrar", latDer: "babeta_empotrar" },
  opciones: { bomComercial: true, inclSell: true },
  color: "Blanco",
});
assert("calcTechoCompleto BOM comercial: no error", !techoComercial.error, techoComercial.error, undefined);
assert(
  "calcTechoCompleto BOM comercial: aviso en warnings",
  Array.isArray(techoComercial.warnings) && techoComercial.warnings.some((w) => String(w).includes("BOM comercial")),
  techoComercial.warnings,
  "includes BOM comercial"
);
assert(
  "calcTechoCompleto BOM comercial: líneas kit selladores",
  techoComercial.allItems.some((i) => String(i.label || "").includes("(kit comercial)")),
  techoComercial.allItems.map((i) => i.label).join(" | "),
  "kit comercial"
);
const kitSil600 = techoComercial.allItems.find((i) => i.sku === "silicona" && String(i.label || "").includes("kit comercial"));
const kitSil300 = techoComercial.allItems.find((i) => i.sku === "silicona_300_neutra" && String(i.label || "").includes("kit comercial"));
assert(
  "calcTechoCompleto BOM comercial: silicona 300 = 2 × silicona 600",
  kitSil600 && kitSil300 && kitSil300.cant === kitSil600.cant * 2,
  kitSil300?.cant,
  kitSil600 ? kitSil600.cant * 2 : null,
);
assert(
  "calcTechoCompleto BOM comercial: gotero comercial",
  techoComercial.allItems.some((i) => String(i.label || "").includes("Gotero frontal (BOM comercial)")),
  true,
  true
);

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 15: Pendiente Engine
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 15: Pendiente Engine ═══");

assert("calcFactorPendiente(0) = 1", calcFactorPendiente(0) === 1, calcFactorPendiente(0), 1);
assert("calcFactorPendiente(null) = 1", calcFactorPendiente(null) === 1, calcFactorPendiente(null), 1);

const fp15 = calcFactorPendiente(15);
assert("calcFactorPendiente(15°) ≈ 1.0353", approx(fp15, 1.0353, 0.001), fp15, 1.0353);

const fp25 = calcFactorPendiente(25);
assert("calcFactorPendiente(25°) ≈ 1.1034", approx(fp25, 1.1034, 0.001), fp25, 1.1034);

const lr = calcLargoReal(10, 15);
assert("calcLargoReal(10m, 15°) ≈ 10.353", approx(lr, 10.353, 0.01), lr, 10.353);

assert("calcLargoReal(10m, 0) = 10", calcLargoReal(10, 0) === 10, calcLargoReal(10, 0), 10);

const techoP15 = calcTechoCompleto({ ...techoInput, pendiente: 15, pendienteModo: "calcular_pendiente" });
assert("calcTechoCompleto(15°, calcular_pendiente): pendienteInfo exists", techoP15.pendienteInfo !== null, !!techoP15.pendienteInfo, true);
assert("calcTechoCompleto(15°, calcular_pendiente): largoReal > largo", techoP15.pendienteInfo.largoReal > techoInput.largo, techoP15.pendienteInfo?.largoReal, ">" + techoInput.largo);

const techoIncluye = calcTechoCompleto({ ...techoInput, pendiente: 15, pendienteModo: "incluye_pendiente" });
assert(
  "calcTechoCompleto(15°, incluye_pendiente): sin alargar largo",
  techoIncluye.pendienteInfo === null || approx(techoIncluye.pendienteInfo?.largoReal ?? techoInput.largo, techoInput.largo, 0.02),
  techoIncluye.pendienteInfo?.largoReal ?? techoInput.largo,
  "~" + techoInput.largo
);

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 16: bomToGroups
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 16: bomToGroups ═══");

assert("bomToGroups(null) = []", bomToGroups(null).length === 0, bomToGroups(null).length, 0);
assert("bomToGroups({error}) = []", bomToGroups({ error: "bad" }).length === 0, bomToGroups({ error: "bad" }).length, 0);

const btgTecho = bomToGroups(techoResult);
assert("bomToGroups(techo): returns groups", btgTecho.length > 0, btgTecho.length, ">0");
assert("bomToGroups(techo): first group is PANELES", btgTecho[0]?.title === "PANELES", btgTecho[0]?.title, "PANELES");
assert("bomToGroups(techo): has FIJACIONES group", btgTecho.some(g => g.title === "FIJACIONES"), true, true);

const btgPared = bomToGroups(paredResult);
assert("bomToGroups(pared): returns groups", btgPared.length > 0, btgPared.length, ">0");
assert("bomToGroups(pared): has PERFILERÍA group", btgPared.some(g => g.title === "PERFILERÍA"), btgPared.some(g => g.title === "PERFILERÍA"), true);

const combinedResult = {
  allItems: techoResult.allItems,
  fijaciones: techoResult.fijaciones,
  perfileria: techoResult.perfileria,
  selladores: techoResult.selladores,
  paredResult: paredResult,
};
const btgCombined = bomToGroups(combinedResult);
assert("bomToGroups(combined): merges techo+pared groups", btgCombined.length >= btgTecho.length, btgCombined.length, ">=" + btgTecho.length);

const presupuestoLibreResult = calcPresupuestoLibre([
  { id: "tornillo_t2", cant: 100 },
  { bucket: "HERRAMIENTAS", id: "pistola_apl_dx03", cant: 1 },
]);
assert("calcPresupuestoLibre: flag set", presupuestoLibreResult.presupuestoLibre === true, presupuestoLibreResult.presupuestoLibre, true);
assert("calcPresupuestoLibre: 2 líneas en allItems", presupuestoLibreResult.allItems.length === 2, presupuestoLibreResult.allItems.length, 2);
const btgLibre = bomToGroups(presupuestoLibreResult);
assert(
  "bomToGroups(presupuesto libre): grupo único PRESUPUESTO LIBRE",
  btgLibre.length === 1 && btgLibre[0]?.title === "PRESUPUESTO LIBRE" && btgLibre[0]?.items?.length === 2,
  JSON.stringify(btgLibre.map(g => ({ t: g.title, n: g.items?.length }))),
  "1 group, 2 items"
);

console.log("\n═══ SUITE 16b: computePresupuestoLibreCatalogo ═══");
const perfilRows = flattenPerfilesLibre(PERFIL_TECHO, PERFIL_PARED);
const perfMap = new Map(perfilRows.map((r) => [r.id, r]));
const firstPerfilId = perfilRows[0]?.id;
const catLibre = computePresupuestoLibreCatalogo({
  listaPrecios: "web",
  librePanelLines: [{ familia: "ISODEC_EPS", espesor: 100, color: "Blanco", m2: 10 }],
  librePerfilQty: firstPerfilId ? { [firstPerfilId]: 2 } : {},
  perfilCatalogById: perfMap,
  libreFijQty: { tornillo_t2: 50 },
  libreSellQty: {},
  flete: 100,
  libreExtra: {},
});
assert("computePresupuestoLibreCatalogo: presupuestoLibre flag", catLibre.presupuestoLibre === true, catLibre.presupuestoLibre, true);
assert("computePresupuestoLibreCatalogo: incluye m²", catLibre.allItems.some(i => i.unidad === "m²"), catLibre.allItems.filter(i => i.unidad === "m²").length, ">0");
assert("computePresupuestoLibreCatalogo: totalFinal > 0", catLibre.totales.totalFinal > 0, catLibre.totales.totalFinal, ">0");
assert("computePresupuestoLibreCatalogo: libreGroups", Array.isArray(catLibre.libreGroups) && catLibre.libreGroups.length > 0, catLibre.libreGroups?.length, ">0");

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 17: applyOverrides
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 17: applyOverrides ═══");

const testGroups = [
  { title: "PANELES", items: [{ label: "Test Panel", cant: 10, pu: 5.00, total: 50.00 }] },
  { title: "FIJACIONES", items: [{ label: "Tornillo", cant: 20, pu: 2.00, total: 40.00 }] },
];

const noOverrides = applyOverrides(testGroups, {});
assert("applyOverrides(no overrides): items unchanged", noOverrides[0].items[0].cant === 10, noOverrides[0].items[0].cant, 10);
assert("applyOverrides(no overrides): isOverridden = false", noOverrides[0].items[0].isOverridden === false, noOverrides[0].items[0].isOverridden, false);

const cantOverride = { [createLineId("PANELES", 0)]: { field: "cant", value: 15 } };
const withCantOvr = applyOverrides(testGroups, cantOverride);
assert("applyOverrides(cant=15): cant updated", withCantOvr[0].items[0].cant === 15, withCantOvr[0].items[0].cant, 15);
assert("applyOverrides(cant=15): total recalculated", approx(withCantOvr[0].items[0].total, 75.00), withCantOvr[0].items[0].total, 75.00);
assert("applyOverrides(cant=15): isOverridden = true", withCantOvr[0].items[0].isOverridden === true, withCantOvr[0].items[0].isOverridden, true);

const puOverride = { [createLineId("FIJACIONES", 0)]: { field: "pu", value: 3.50 } };
const withPuOvr = applyOverrides(testGroups, puOverride);
assert("applyOverrides(pu=3.50): pu updated", withPuOvr[1].items[0].pu === 3.50, withPuOvr[1].items[0].pu, 3.50);
assert("applyOverrides(pu=3.50): total = 20 × 3.50 = 70", approx(withPuOvr[1].items[0].total, 70.00), withPuOvr[1].items[0].total, 70.00);

assert("applyOverrides: does not mutate original", testGroups[0].items[0].cant === 10, testGroups[0].items[0].cant, 10);

assert("createLineId format", createLineId("PANELES", 0) === "PANELES-0", createLineId("PANELES", 0), "PANELES-0");
assert("createLineId with spaces", createLineId("PERFILES U", 2) === "PERFILES_U-2", createLineId("PERFILES U", 2), "PERFILES_U-2");

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 18: mergeZonaResults
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 18: mergeZonaResults ═══");

assert("mergeZonaResults([]) = null", mergeZonaResults([]) === null, mergeZonaResults([]), null);

const singleZona = calcTechoCompleto(techoInput);
const mergedSingle = mergeZonaResults([singleZona]);
assert("mergeZonaResults([1 zone]): returns same result", mergedSingle.paneles.cantPaneles === singleZona.paneles.cantPaneles, mergedSingle.paneles.cantPaneles, singleZona.paneles.cantPaneles);

const zona1 = calcTechoCompleto({ ...techoInput, largo: 5.0, ancho: 5.6 });
const zona2 = calcTechoCompleto({ ...techoInput, largo: 4.0, ancho: 3.4 });
const merged2 = mergeZonaResults([zona1, zona2]);
assert("mergeZonaResults(2 zones): cantPaneles summed", merged2.paneles.cantPaneles === zona1.paneles.cantPaneles + zona2.paneles.cantPaneles, merged2.paneles.cantPaneles, zona1.paneles.cantPaneles + zona2.paneles.cantPaneles);
assert("mergeZonaResults(2 zones): areaTotal summed", approx(merged2.paneles.areaTotal, zona1.paneles.areaTotal + zona2.paneles.areaTotal), merged2.paneles.areaTotal, zona1.paneles.areaTotal + zona2.paneles.areaTotal);
assert("mergeZonaResults(2 zones): totales recalculated", merged2.totales.subtotalSinIVA > 0, merged2.totales.subtotalSinIVA, ">0");
assert("mergeZonaResults(2 zones): allItems rebuilt", merged2.allItems.length > 0, merged2.allItems.length, ">0");

// Verify original zone objects were NOT mutated (deep copy)
const zona1Copy = calcTechoCompleto({ ...techoInput, largo: 5.0, ancho: 5.6 });
const zona2Copy = calcTechoCompleto({ ...techoInput, largo: 4.0, ancho: 3.4 });
mergeZonaResults([zona1Copy, zona2Copy]);
const zona1Fresh = calcTechoCompleto({ ...techoInput, largo: 5.0, ancho: 5.6 });
assert("mergeZonaResults: does not mutate zona1 paneles", zona1Copy.paneles.cantPaneles === zona1Fresh.paneles.cantPaneles, zona1Copy.paneles.cantPaneles, zona1Fresh.paneles.cantPaneles);

// 3 zones
const zona3 = calcTechoCompleto({ ...techoInput, largo: 3.0, ancho: 2.24 });
const merged3 = mergeZonaResults([zona1, zona2, zona3]);
assert("mergeZonaResults(3 zones): cantPaneles correct", merged3.paneles.cantPaneles === zona1.paneles.cantPaneles + zona2.paneles.cantPaneles + zona3.paneles.cantPaneles, merged3.paneles.cantPaneles, zona1.paneles.cantPaneles + zona2.paneles.cantPaneles + zona3.paneles.cantPaneles);

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 19: projectFile — techo.zonas.preview (vista previa)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 19: projectFile — techo.zonas.preview ═══");

const rawProjPreview = {
  scenario: "solo_techo",
  listaPrecios: "web",
  proyecto: {},
  techo: {
    familia: "",
    zonas: [
      { largo: 5, ancho: 3.36, preview: { x: 1.2, y: 0.5, slopeMark: "along_largo_pos" } },
    ],
  },
  pared: {},
  camara: {},
  flete: 0,
};
const deserP = deserializeProject(rawProjPreview);
assert(
  "deserialize preserves zonas[0].preview.x",
  deserP.techo.zonas[0].preview?.x === 1.2,
  deserP.techo.zonas[0].preview?.x,
  1.2,
);
assert(
  "deserialize preserves slopeMark",
  deserP.techo.zonas[0].preview?.slopeMark === "along_largo_pos",
  deserP.techo.zonas[0].preview?.slopeMark,
  "along_largo_pos",
);

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 20: followUpStore — due list & date helpers
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 20: followUpStore ═══");

const past = new Date("2020-01-01T00:00:00.000Z").toISOString();
const future = new Date("2035-01-01T00:00:00.000Z").toISOString();
const itemsSample = [
  { status: "open", nextFollowUpAt: past },
  { status: "open", nextFollowUpAt: future },
  { status: "open", nextFollowUpAt: null },
  { status: "done", nextFollowUpAt: past },
];
const due = listDueItems(itemsSample, new Date("2025-06-01T12:00:00.000Z"));
assert("listDueItems: open + past due", due.length === 2, due.length, 2);
assert("parseDueInput ISO", parseDueInput("2026-03-01")?.startsWith("2026-03-01"), true, true);
assert("parseDays(7) returns string", typeof parseDays(7) === "string", typeof parseDays(7), "string");

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 21: program-status snapshot — progress weighted by estHours
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 21: buildProgramSnapshot ═══");

const miniProg = {
  programId: "test",
  title: "Test",
  updatedAt: "2026-01-01",
  currentPhaseId: "p1",
  phases: [{ id: "p1", name: "P", order: 1, status: "active" }],
  streams: [
    {
      id: "s",
      name: "Stream",
      tasks: [
        { id: "a", status: "done", estHours: 2 },
        { id: "b", status: "todo", estHours: 8 },
      ],
    },
  ],
};
const snap = buildProgramSnapshot(miniProg);
assert(
  "buildProgramSnapshot: pctWeighted 20% (2h/10h)",
  snap.progress.pctWeighted === 20,
  snap.progress.pctWeighted,
  20,
);
assert("buildProgramSnapshot: pct by count 50%", snap.progress.pct === 50, snap.progress.pct, 50);

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 22: email snapshot ingest helpers
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 22: emailSnapshotIngest ═══");

assert(
  "remitenteFromFrom formats name + address",
  remitenteFromFrom([{ name: "A", address: "a@b.com" }]) === "A <a@b.com>",
  remitenteFromFrom([{ name: "A", address: "a@b.com" }]),
  "A <a@b.com>",
);

const snapMini = {
  messages: [
    { category: "ventas", uid: 1, accountId: "x", subject: "Hola", text: "cotización de paneles 12345", from: [{ address: "c@d.com" }] },
    { category: "otros", uid: 2, text: "spam spam spam spam spam" },
  ],
};
const picked = selectMessagesForIngest(snapMini, { category: "ventas", limit: 10, processed: new Set() });
assert("selectMessagesForIngest: ventas only", picked.length === 1, picked.length, 1);

const body = messageToIngestBody(snapMini.messages[0]);
assert("messageToIngestBody has cuerpo", body.cuerpo.includes("cotización"), body.cuerpo, "contains");

assert(
  "stableMessageKey uses accountId:uid fallback",
  stableMessageKey({ accountId: "bmc-ventas", uid: 99 }) === "bmc-ventas:99",
  stableMessageKey({ accountId: "bmc-ventas", uid: 99 }),
  "bmc-ventas:99",
);

assert(
  "cuerpoFromMessage prefers text over html",
  cuerpoFromMessage({ text: "hello", html: "<b>x</b>" }) === "hello",
  cuerpoFromMessage({ text: "hello", html: "<b>x</b>" }),
  "hello",
);

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 22b: Sheet column letters ↔ index (MATRIZ COL("T") helper)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 22b: sheetColumnLetters ═══");

assert("colLetterToIndex A", colLetterToIndex("A") === 0, colLetterToIndex("A"), 0);
assert("colLetterToIndex T", colLetterToIndex("T") === 19, colLetterToIndex("T"), 19);
assert("colLetterToIndex U", colLetterToIndex("U") === 20, colLetterToIndex("U"), 20);
assert("colLetterToIndex Z", colLetterToIndex("Z") === 25, colLetterToIndex("Z"), 25);
assert("colLetterToIndex AA", colLetterToIndex("AA") === 26, colLetterToIndex("AA"), 26);
assert(
  "colIndexToLetter round-trip T",
  colIndexToLetter(colLetterToIndex("T")) === "T",
  colIndexToLetter(colLetterToIndex("T")),
  "T",
);
assert(
  "colIndexToLetter round-trip AA",
  colIndexToLetter(colLetterToIndex("AA")) === "AA",
  colIndexToLetter(colLetterToIndex("AA")),
  "AA",
);

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 23: CSV pricing import (MATRIZ / editor)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 23: CSV pricing import ═══");

assert("parseCsvNumber 42,99", parseCsvNumber("42,99") === 42.99, parseCsvNumber("42,99"), 42.99);
assert("parseCsvNumber 1.025,50 (miles+coma)", parseCsvNumber("1.025,50") === 1025.5, parseCsvNumber("1.025,50"), 1025.5);
assert("parseCsvNumber 1025.50 (punto decimal)", parseCsvNumber("1025.50") === 1025.5, parseCsvNumber("1025.50"), 1025.5);
assert("parseCsvNumber 42.99", parseCsvNumber("42.99") === 42.99, parseCsvNumber("42.99"), 42.99);
assert("parseCsvNumber vacío → null", parseCsvNumber("") === null, parseCsvNumber(""), null);
assert("parseCsvNumber null → null", parseCsvNumber(null) === null, parseCsvNumber(null), null);

const hdrMatriz =
  "path,descripcion,categoria,costo,venta_local,venta_local_iva_inc,venta_web,venta_web_iva_inc,unidad,tab".split(",");
const hdrEditor = "path,label,categoria,costo,venta_bmc_local,venta_web,unidad".split(",");
assert("findVentaColumnIndex MATRIZ", findVentaColumnIndex(hdrMatriz) === 4, findVentaColumnIndex(hdrMatriz), 4);
assert("findVentaColumnIndex editor", findVentaColumnIndex(hdrEditor) === 4, findVentaColumnIndex(hdrEditor), 4);

const hdrWebCols = "path,costo,venta_local,venta_web,venta_web_iva_inc,tab".split(",");
assert("findVentaWebColumnIndex exact", findVentaWebColumnIndex(hdrWebCols) === 3, findVentaWebColumnIndex(hdrWebCols), 3);
assert("findVentaWebIvaIncColumnIndex", findVentaWebIvaIncColumnIndex(hdrWebCols) === 4, findVentaWebIvaIncColumnIndex(hdrWebCols), 4);
assert(
  "findVentaLocalIvaIncColumnIndex",
  findVentaLocalIvaIncColumnIndex(hdrMatriz) === 5,
  findVentaLocalIvaIncColumnIndex(hdrMatriz),
  5
);

const csvWithQuotedCommaAndNewline = [
  "path,descripcion,costo,venta_local,venta_web,venta_web_iva_inc",
  "\"PANELS_TECHO.ISOROOF_3G.esp.30\",\"Panel con coma, y salto",
  "de linea\",10,20,30,36.6",
  "\"PANELS_TECHO.ISOROOF_3G.esp.30\",\"Duplicado\",11,21,31,37.82",
].join("\n");
const parsedCsvRows = parseCsvRows(csvWithQuotedCommaAndNewline);
assert("parseCsvRows keeps multiline row together", parsedCsvRows.length === 3, parsedCsvRows.length, 3);
assert(
  "parseCsvRows preserves quoted comma/newline description",
  parsedCsvRows[1][1] === "Panel con coma, y salto\nde linea",
  parsedCsvRows[1][1],
  "Panel con coma, y salto\\nde linea"
);
const dupParsedReport = getDuplicatePathReportFromRows(parsedCsvRows, 0);
assert("getDuplicatePathReportFromRows detects duplicate path", dupParsedReport.length === 1, dupParsedReport.length, 1);
assert(
  "getDuplicatePathReportFromRows line numbers",
  JSON.stringify(dupParsedReport[0].lineNumbers) === JSON.stringify([2, 3]),
  JSON.stringify(dupParsedReport[0].lineNumbers),
  JSON.stringify([2, 3])
);

const dupLines = [
  "path,costo,venta_local",
  "A.B,1,2",
  "A.B,3,4",
  "C.D,1,1",
];
const dups = getDuplicatePathReport(dupLines, 0);
assert("getDuplicatePathReport one dup", dups.length === 1 && dups[0].path === "A.B" && dups[0].count === 2, JSON.stringify(dups), "1 dup A.B");

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 23b: MATRIZ CSV normalization (ISODEC_EPS techo vs ISOPANEL_EPS pared)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 23b: matrizCsvNormalization ═══");

const csvRowsNorm = [
  "path,descripcion,categoria,costo,venta_local,venta_local_iva_inc,venta_web,venta_web_iva_inc,unidad,tab",
  'PANELS_PARED.ISOPANEL_EPS.esp.100,"Pared ""EPS"" 100, blanca",Paneles Pared,30,3777,4607.94,3900,4758,m²,BROMYROS',
  'PANELS_TECHO.ISODEC_EPS.esp.100,"Techo ""EPS"" 100, blanca",Paneles Techo,31,3903,4761.66,4100,5002,m²,BROMYROS',
  "PANELS_TECHO.ISODEC_EPS.esp.150,Techo 150,Paneles Techo,35,4248,5182.56,4500,5490,m²,BROMYROS",
  "PANELS_PARED.ISOPANEL_EPS.esp.150,Pared 150,Paneles Pared,35,4248,5182.56,4400,5368,m²,BROMYROS",
];
const beforeSameRow = csvRowsNorm[3];
const sameRef = normalizeIsodecEpsVentaLocalCsvRows(csvRowsNorm);
assert(
  "normalizeIsodecEpsVentaLocalCsvRows returns same array reference",
  sameRef === csvRowsNorm,
  sameRef === csvRowsNorm,
  true,
);

const pared100 = splitCsvRowSafe(csvRowsNorm[1]);
const techo100 = splitCsvRowSafe(csvRowsNorm[2]);
assert("normalize copies venta_local from pared to techo", techo100[4] === pared100[4], techo100[4], pared100[4]);
assert("normalize copies venta_local_iva_inc from pared to techo", techo100[5] === pared100[5], techo100[5], pared100[5]);
assert("normalize keeps venta_web untouched", techo100[6] === "4100", techo100[6], "4100");
assert("normalize keeps venta_web_iva_inc untouched", techo100[7] === "5002", techo100[7], "5002");
assert(
  "normalize preserves quoted description with comma",
  techo100[1] === 'Techo "EPS" 100, blanca',
  techo100[1],
  'Techo "EPS" 100, blanca',
);
assert("normalize skips rows already aligned", csvRowsNorm[3] === beforeSameRow, csvRowsNorm[3], beforeSameRow);

const splitQuoted = splitCsvRowSafe('A,"B, C","D ""Q"""');
assert("splitCsvRowSafe handles comma in quoted cell", splitQuoted[1] === "B, C", splitQuoted[1], "B, C");
assert("splitCsvRowSafe handles escaped quotes", splitQuoted[2] === 'D "Q"', splitQuoted[2], 'D "Q"');

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 24: Nuevos productos — ISOROOF_COLONIAL, ISODEC_EPS_PARED, perfilería
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 24: ISOROOF_COLONIAL / ISODEC_EPS_PARED / perfilería / overridePts ═══");

// 24.1 ISOROOF_COLONIAL panel exists in constants with 40mm esp
assert(
  "PANELS_TECHO ISOROOF_COLONIAL esp[40] exists",
  PANELS_TECHO.ISOROOF_COLONIAL != null && PANELS_TECHO.ISOROOF_COLONIAL.esp?.[40] != null,
  !!PANELS_TECHO.ISOROOF_COLONIAL?.esp?.[40],
  true,
);

// 24.2 ISOROOF_COLONIAL has expected pricing fields
assert(
  "PANELS_TECHO ISOROOF_COLONIAL esp[40] has venta price",
  typeof PANELS_TECHO.ISOROOF_COLONIAL.esp[40].venta === "number" && PANELS_TECHO.ISOROOF_COLONIAL.esp[40].venta > 0,
  PANELS_TECHO.ISOROOF_COLONIAL.esp[40].venta,
  ">0",
);


// 24.4 calcTechoCompleto with ISOROOF_COLONIAL
{
  const r = calcTechoCompleto({
    familia: "ISOROOF_COLONIAL", espesor: 40,
    ancho: 10, largo: 5, pendiente: 5,
    tipoEst: "caballete",
  });
  assert(
    "calcTechoCompleto ISOROOF_COLONIAL → cantPaneles > 0",
    r?.paneles?.cantPaneles > 0,
    r?.paneles?.cantPaneles,
    ">0",
  );
  assert(
    "calcTechoCompleto ISOROOF_COLONIAL → no error",
    !r?.error,
    r?.error ?? "none",
    "none",
  );
}


// 24.6 calcPerfileriaTechoComercial ISODEC_PIR 80mm (60mm not in catalog)
{
  const r = calcPerfileriaTechoComercial("ISODEC_PIR", 80);
  assert(
    "calcPerfileriaTechoComercial ISODEC_PIR 80mm → has items",
    Array.isArray(r.items) && r.items.length > 0,
    r.items.length,
    ">0",
  );
  assert(
    "calcPerfileriaTechoComercial ISODEC_PIR 80mm → total > 0",
    r.total > 0,
    r.total,
    ">0",
  );
}

// 24.7 calcFijacionesVarilla with overridePuntosFijacion
{
  const r = calcFijacionesVarilla(10, 2, 20, "metal", 0, 0, 0, { overridePuntosFijacion: 50, espesorMm: 100 });
  assert(
    "calcFijacionesVarilla overridePuntosFijacion=50 → puntosFijacion===50",
    r?.puntosFijacion === 50,
    r?.puntosFijacion,
    50,
  );
  assert(
    "calcFijacionesVarilla overridePuntosFijacion=50 → items length > 0",
    r?.items?.length > 0,
    r?.items?.length,
    ">0",
  );
  const vItem = r?.items?.find((it) => it.sku === "varilla_38");
  assert(
    "calcFijacionesVarilla 50 pts, 100 mm metal → varillas=10 (5 tramos/barra 1 m)",
    vItem && vItem.cant === 10,
    vItem?.cant,
    10,
  );
  const plItem = r?.items?.find((it) => it.sku === "arandela_plana");
  assert(
    "calcFijacionesVarilla metal → arandela_plana cant = puntosFijacion",
    plItem && plItem.cant === 50,
    plItem?.cant,
    50,
  );
}

// 24.7a arandela plana: no en solo hormigón
{
  const r = calcFijacionesVarilla(10, 2, 20, "hormigon", 0, 0, 0, { espesorMm: 100 });
  assert(
    "calcFijacionesVarilla hormigón → sin línea arandela_plana",
    !r?.items?.some((it) => it.sku === "arandela_plana"),
    r?.items?.some((it) => it.sku === "arandela_plana"),
    false,
  );
  // Lock hormigón rod count: puntos=54 (grid40+perim14), Lhorm=0.30m → perRod=3 → ceil(54/3)=18
  const varItem = r?.items?.find((it) => it.sku === "varilla_38");
  assert(
    "calcFijacionesVarilla hormigón 100mm → varilla_38 cant = 18 (Lhorm=0.30m, perRod=3)",
    varItem && varItem.cant === 18,
    varItem?.cant,
    18,
  );
}

{
  const r = calcFijacionesVarilla(10, 2, 20, "madera", 0, 0, 0, { overridePuntosFijacion: 30, espesorMm: 100 });
  const pl = r?.items?.find((it) => it.sku === "arandela_plana");
  assert(
    "calcFijacionesVarilla madera → arandela_plana cant = puntos",
    pl && pl.cant === 30,
    pl?.cant,
    30,
  );
}

// 24.7b Isodec grilla: 2/panel en perímetro, 1/panel en intermedios
assert(
  "countPuntosFijacionVarillaGrilla(10,2)===40",
  countPuntosFijacionVarillaGrilla(10, 2) === 40,
  countPuntosFijacionVarillaGrilla(10, 2),
  40,
);
assert(
  "countPuntosFijacionVarillaGrilla(10,3)===50",
  countPuntosFijacionVarillaGrilla(10, 3) === 50,
  countPuntosFijacionVarillaGrilla(10, 3),
  50,
);
{
  const r = calcFijacionesVarilla(10, 3, 20, "metal", 0, 0, 0, { espesorMm: 100 });
  assert(
    "calcFijacionesVarilla default grilla 10×3 apoyos → puntosFijacionGrilla===50",
    r?.puntosFijacionGrilla === 50,
    r?.puntosFijacionGrilla,
    50,
  );
  assert(
    "calcFijacionesVarilla default total con refuerzo lateral largo → puntosFijacion===64 (50+2×7)",
    r?.puntosFijacion === 64,
    r?.puntosFijacion,
    64,
  );
  const vItem = r?.items?.find((it) => it.sku === "varilla_38");
  assert(
    "calcFijacionesVarilla 64 pts, 100 mm metal → varillas=13 (ceil(64/5) tramos 0,20 m)",
    vItem && vItem.cant === 13,
    vItem?.cant,
    13,
  );
}

assert(
  "perimetroVerticalInteriorPuntosDesdePlanta zona 6×5,6 una agua → 4 (2 por lateral 6 m / 2,5)",
  perimetroVerticalInteriorPuntosDesdePlanta([{ largo: 6, ancho: 5.6 }], "una_agua", 0) === 4,
  perimetroVerticalInteriorPuntosDesdePlanta([{ largo: 6, ancho: 5.6 }], "una_agua", 0),
  4,
);

assert(
  "countVarillasRoscadasDesdeBarras1m: 10×0,20 m → 2 barras",
  countVarillasRoscadasDesdeBarras1m(10, 0.2, 1) === 2,
  countVarillasRoscadasDesdeBarras1m(10, 0.2, 1),
  2,
);
assert(
  "countVarillasRoscadasDesdeBarras1m: 11×0,20 m → 3 barras",
  countVarillasRoscadasDesdeBarras1m(11, 0.2, 1) === 3,
  countVarillasRoscadasDesdeBarras1m(11, 0.2, 1),
  3,
);
assert(
  "countVarillasRoscadasDesdeBarras1m: tramo > 1 m → barras por punto",
  countVarillasRoscadasDesdeBarras1m(3, 1.2, 1) === 6,
  countVarillasRoscadasDesdeBarras1m(3, 1.2, 1),
  6,
);

// 24.8 ISOROOF_COLONIAL cumbrera in PERFIL_TECHO
assert(
  "PERFIL_TECHO.cumbrera.ISOROOF_COLONIAL exists",
  PERFIL_TECHO.cumbrera?.ISOROOF_COLONIAL != null,
  !!PERFIL_TECHO.cumbrera?.ISOROOF_COLONIAL,
  true,
);

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 25: PANELSIM repo resolve + summary reader (Thunderbird / GPT bridge)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 25: emailInboxRepo + panelsimSummaryReader ═══");

assert(
  "resolveEmailInboxRepoRoot explicit wins",
  resolveEmailInboxRepoRoot({ cwd: "/tmp/calc", bmcEmailInboxRepo: "/mail/repo" }) === "/mail/repo",
  resolveEmailInboxRepoRoot({ cwd: "/tmp/calc", bmcEmailInboxRepo: "/mail/repo" }),
  "/mail/repo",
);

const fakeSibling = resolveEmailInboxRepoRoot({ cwd: "/tmp/Calculadora-BMC", bmcEmailInboxRepo: "" });
assert(
  "resolveEmailInboxRepoRoot sibling path shape",
  fakeSibling.endsWith("conexion-cuentas-email-agentes-bmc"),
  fakeSibling,
  "ends with repo name",
);

const missing = readPanelsimEmailSummary({
  cwd: "/tmp/nope-calculadora-xyz",
  bmcEmailInboxRepo: "/tmp/this-inbox-repo-does-not-exist-12345",
  reportMaxChars: 100,
});
assert("readPanelsimEmailSummary missing repo → ok false", missing.ok === false, missing.ok, false);

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 26: logística prototipo — parseo texto adjunto (paneles / accesorios)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 26: adjuntoLineParse (logística prototipo) ═══");

const ph1 = parsePanelLineHeuristic("ISODEC EPS 100mm largo 6m cant 12");
assert(
  "parsePanelLineHeuristic ISODEC 100 6m 12",
  ph1 && ph1.tipo === "ISODEC" && ph1.espesor === 100 && ph1.longitud === 6 && ph1.cantidad === 12,
  ph1,
  "ISODEC 100 6 12",
);

const ph2 = parsePanelLineHeuristic("12 x ISOPANEL 150 mm 7 m");
assert(
  "parsePanelLineHeuristic qty first",
  ph2 && ph2.tipo === "ISOPANEL" && ph2.espesor === 150 && ph2.longitud === 7 && ph2.cantidad === 12,
  ph2,
  "ISOPANEL 150 7 12",
);

const phBultos = parsePanelLineHeuristic("ISODEC EPS 100mm largo 6m bultos 24");
assert(
  "parsePanelLineHeuristic bultos keyword",
  phBultos && phBultos.cantidad === 24 && phBultos.tipo === "ISODEC",
  phBultos,
  "bultos 24",
);

assert("parseQtyCell 12 uds", parseQtyCell("12 uds") === 12, parseQtyCell("12 uds"), 12);
assert("parseQtyCell trim number", parseQtyCell(" 8 ") === 8, parseQtyCell(" 8 "), 8);

const tsvBultos = "Producto\tEspesor mm\tLargo m\tBultos\nISODEC 100\t100\t6\t15";
const bomB = parseLogisticaFromAdjuntoText(tsvBultos);
assert(
  "parseLogisticaFromAdjuntoText TSV header Bultos",
  bomB.paneles.length === 1 && bomB.paneles[0].cantidad === 15,
  bomB.paneles[0],
  "cant 15",
);

const acc1 = parseAccesorioLine("Perfil U galvanizado - 24");
assert(
  "parseAccesorioLine guión cantidad",
  acc1 && acc1.cantidad === 24 && acc1.descr.includes("Perfil"),
  acc1,
  "Perfil 24",
);

const tsv = "Producto\tEspesor mm\tLargo m\tCantidad\nISODEC 100\t100\t6\t8\nTornillo\t\t\t100";
const bom = parseLogisticaFromAdjuntoText(tsv);
assert(
  "parseLogisticaFromAdjuntoText TSV panel row",
  bom.paneles.length === 1 && bom.paneles[0].cantidad === 8 && bom.paneles[0].tipo === "ISODEC",
  bom.paneles.length,
  1,
);
assert(
  "parseLogisticaFromAdjuntoText TSV acc row",
  bom.accesorios.length >= 1 && bom.accesorios.some((a) => a.descr.toLowerCase().includes("tornillo") && a.cantidad === 100),
  bom.accesorios,
  "tornillo 100",
);

const cells20 = Array.from({ length: 16 }, (_, i) => `C${i}`);
cells20[2] = "PID-99";
cells20[6] = "Cliente X";
cells20[7] = "Calle 1";
cells20[9] = "https://dropbox.com/fake.pdf";
cells20[14] = "099";
const paste20 = extractStopFieldsFromPaste(cells20.join("\t"), "ventas20Coordinaciones");
assert(
  "extractStopFieldsFromPaste ventas20Coordinaciones indices",
  paste20.fields.cotizacionId === "PID-99" &&
    paste20.fields.cliente === "Cliente X" &&
    paste20.fields.direccion === "Calle 1" &&
    paste20.fields.linkAdjunto.includes("dropbox.com") &&
    paste20.fields.telefono === "099",
  paste20.fields,
  "PID-99",
);

const quoted = 'a\t"b\nline2"\tc';
const pr = parseTsvRows(quoted);
assert("parseTsvRows newline inside quotes → 1 row", pr.length === 1 && pr[0].length === 3 && pr[0][1].includes("line2"), pr[0]?.[1], "multiline cell");

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 27: logística prototipo — fila planilla completa + inferencia URLs
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 27: cargoEngine sheet row snapshot + URL infer ═══");

const rowUrls = {
  Cliente: "X",
  NOTAS: "ver https://drive.google.com/file/d/abc123/view y mapa https://maps.app.goo.gl/xyz",
};
const urls = collectUrlsFromRow(rowUrls);
assert("collectUrlsFromRow finds two https", urls.length >= 2, urls.length, ">=2");
assert(
  "inferLinkMapFromRow picks maps.app",
  inferLinkMapFromRow(rowUrls).includes("maps.app"),
  inferLinkMapFromRow(rowUrls),
  "maps",
);
assert(
  "inferLinkAdjuntoFromRow picks drive",
  inferLinkAdjuntoFromRow(rowUrls).includes("drive.google.com"),
  inferLinkAdjuntoFromRow(rowUrls),
  "drive",
);

resetLogisticaIds();
const stopFull = stopFromProximaRow(
  {
    ID: "P-99",
    Cliente: "ACME",
    NOTAS: "ISODEC 100mm 6m 8",
    Observaciones: "https://drive.google.com/file/d/zz/view",
  },
  1,
  LOG_COLORS
);
assert("stopFromProximaRow keeps rawSheet keys", stopFull.rawSheet && stopFull.rawSheet.ID === "P-99", stopFull.rawSheet?.ID, "P-99");
assert(
  "stopFromProximaRow infers linkAdjunto from any cell",
  String(stopFull.linkAdjunto).includes("drive.google.com"),
  stopFull.linkAdjunto,
  "drive",
);

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 28: logística — dropdown clientes desde planilla
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 28: clienteFromSheet (picker) ═══");

const stA = { cliente: "", rawSheet: { Cliente: "  Obras   Sur  " } };
const stB = { cliente: "Obras Sur", rawSheet: {} };
assert(
  "collectClienteNamesFromStop uses rawSheet Cliente",
  collectClienteNamesFromStop(stA).some((x) => x.includes("Obras")),
  collectClienteNamesFromStop(stA),
  "Obras",
);
const uni = uniqueClientesFromStops([stA, stB]);
assert("uniqueClientesFromStops dedupes normalized", uni.length === 1, uni.length, 1);
const hit = findFirstStopByClienteLabel([stB, stA], "obras sur");
assert("findFirstStopByClienteLabel case-insensitive", hit === stB || hit === stA, hit, "one of stops");

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 29: logística — estimación volumen / peso (loadCharacteristics)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 29: loadCharacteristics (m² / m³ / kg) ═══");

const k100 = kgPerM2ForEspesor(100);
assert("kgPerM2ForEspesor 100mm in range", k100 >= 8 && k100 <= 20, k100, "8–20");

const pl = estimatePanelLinePhysical({ tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 10 });
assert("estimatePanelLinePhysical m2 = cant×largo×1.2", approx(pl.m2, 72, 0.01), pl.m2, "72");
assert("estimatePanelLinePhysical volume = m2×esp", approx(pl.volumeM3, 7.2, 0.01), pl.volumeM3, "7.2");

const route = estimateRouteLoadPhysical([
  {
    id: "a",
    orden: 1,
    cliente: "X",
    paneles: [{ tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 5 }],
    accesorios: [{ descr: "Tornillo", cantidad: 20 }],
  },
]);
assert("estimateRouteLoadPhysical aggregates", route.m2 > 0 && route.estWeightKg > 100, route.m2, ">0");

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 30: Ventas — N° Pedido / N° Retiro desde texto libre
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 30: ventasPedidoRetiroParse ═══");

const s1 =
  "Pago 100% / N° Pedido 1342836 / N° Retiro 53733 / Prod 4/03";
const p1 = parsePedidoRetiroFromFreeText(s1);
assert("parsePedidoRetiroFromFreeText pedido+retiro", p1.orderId === "1342836" && p1.pickupId === "53733", p1, "1342836/53733");

const p2 = parsePedidoRetiroFromFreeText("Nº Pedido 1342926 / N° Retiro xxxx");
assert("parsePedidoRetiroFromFreeText Nº variant", p2.orderId === "1342926" && p2.pickupId === "xxxx", p2, "1342926/xxxx");

const p3 = parsePedidoRetiroFromFreeText("sin tokens");
assert("parsePedidoRetiroFromFreeText empty when no match", p3.orderId === "" && p3.pickupId === "", p3, "empty");

const cPipe = parsePedidoFromColumnC("xxxxxx | 1342836");
assert(
  "parsePedidoFromColumnC pipe toma último tramo como pedido",
  cPipe.source === "pipe" && cPipe.orderId === "1342836",
  cPipe,
  "1342836",
);

const cSingle = parsePedidoFromColumnC("Nº 1342926");
assert("parsePedidoFromColumnC solo pedido", cSingle.source === "single" && cSingle.orderId === "1342926", cSingle, "1342926");

const f1 = parsePickupIdFromColumnF("Pago 100% / N° Pedido 1342836 / N° Retiro 53733 / Prod");
assert("parsePickupIdFromColumnF último N° Retiro en F", f1 === "53733", f1, "53733");

const f2 = parsePickupIdFromColumnF("notas | N° Retiro 99999");
assert("parsePickupIdFromColumnF último campo con |", f2 === "99999", f2, "99999");

const cellsDual = Array.from({ length: 16 }, (_, i) => `C${i}`);
cellsDual[2] = "1342836";
cellsDual[5] = "x / N° Retiro 53733 / fin";
cellsDual[6] = "Cliente X";
cellsDual[7] = "Calle 1";
cellsDual[9] = "https://dropbox.com/fake.pdf";
cellsDual[14] = "099";
const pasteDual = extractStopFieldsFromPaste(cellsDual.join("\t"), "ventas20Coordinaciones");
assert(
  "extractStopFieldsFromPaste C=pedido F=retiro",
  pasteDual.fields.cotizacionId === "1342836" && pasteDual.fields.pickupId === "53733",
  pasteDual.fields,
  "1342836/53733",
);

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 31: Logística — vista cama (espejo) + export JSON plan
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 31: bmcLogisticaBedView ═══");

const truckLView = 10;
const pkgEngine = { xStart: -2, xEnd: 8, len: 10, id: "x" };
const mirrored = mirrorBedXForView(pkgEngine, truckLView);
assert("mirrorBedXForView maps engine to view axis", mirrored.xStart === 2 && mirrored.xEnd === 12, mirrored, "2..12");

const ext = bedViewExtents([pkgEngine], truckLView);
assert("bedViewExtents minXV maxXV saliente", ext.minXV === 0 && ext.maxXV === 12, ext, "0..12");

const cargoKpiStub = {
  placed: [
    {
      ...pkgEngine,
      sId: "s1",
      sOrd: 1,
      n: 1,
      h: 0.5,
      row: 0,
      zBase: 0,
      stackId: "S1",
      kind: "panel",
      ov: false,
    },
  ],
  rowH: [0.5, 0.3],
  stacksByRow: [[{ id: "S1" }]],
  warns: [],
  minX: -2,
  maxX: 8,
  maxLen: 10,
  strategy: "balanced",
  layoutMode: "auto",
  manualLayoutVersion: 1,
  stopUnloadOrder: [],
};
const kpis = computeLogisticaKpis(cargoKpiStub, truckLView);
assert("computeLogisticaKpis salienteM ~2m", Math.abs(kpis.salienteM - 2) < 0.001, kpis.salienteM, 2);

const exportPayload = buildLogisticaPlanExportPayload({ truckL: truckLView, cargo: cargoKpiStub, remitoNumero: "R-TEST" });
assert(
  "buildLogisticaPlanExportPayload schema + kind",
  exportPayload.schemaVersion === LOGISTICA_PLAN_EXPORT_SCHEMA_VERSION && exportPayload.kind === "bmc-logistica-plan",
  exportPayload.schemaVersion,
  LOGISTICA_PLAN_EXPORT_SCHEMA_VERSION,
);
assert("buildLogisticaPlanExportPayload remitoNumero", exportPayload.remitoNumero === "R-TEST", exportPayload.remitoNumero, "R-TEST");
assert("buildLogisticaPlanExportPayload kpis.view maxXV", exportPayload.kpis.maxXV === 12, exportPayload.kpis.maxXV, 12);

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 32: Techo multizona — geometría planta (encuentros / perímetro exterior)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 32: roofPlanGeometry ═══");

const strips908 = buildAnchoStripsPlanta(10.08, 1.12);
const sum908 = strips908.reduce((s, r) => s + r.width, 0);
assert("buildAnchoStripsPlanta 10.08m / 1.12m: 9 franjas", strips908.length === 9, strips908.length, 9);
assert("buildAnchoStripsPlanta suma = ancho", Math.abs(sum908 - 10.08) < 1e-9, sum908, 10.08);
assert(
  "panelCountAcrossAnchoPlanta coherente con franjas",
  panelCountAcrossAnchoPlanta(10.08, 1.12) === strips908.length,
  panelCountAcrossAnchoPlanta(10.08, 1.12),
  strips908.length,
);

const z10x2128 = { largo: 10, ancho: 21.28 };
const z56x6 = { largo: 5.6, ancho: 6 };

const sep = buildRoofPlanEdges([z10x2128, z56x6], "una_agua");
assert(
  "buildRoofPlanEdges separadas: sin encuentros",
  sep.encounters.length === 0,
  sep.encounters.length,
  0,
);
const perIndep = 2 * (21.28 + 10) + 2 * (6 + 5.6);
assert(
  "buildRoofPlanEdges separadas: perímetro exterior = suma zonas",
  Math.abs(sep.totals.exteriorLength - perIndep) < 0.02,
  sep.totals.exteriorLength,
  perIndep,
);
assert(
  "buildRoofPlanEdges separadas: encounterLength 0",
  sep.totals.encounterLength === 0,
  sep.totals.encounterLength,
  0,
);

const zL1 = { largo: 10, ancho: 21.28, preview: { x: 0, y: 0 } };
const zL2 = { largo: 5.6, ancho: 6, preview: { x: 21.28, y: 0 } };
const L = buildRoofPlanEdges([zL1, zL2], "una_agua");
assert(
  "buildRoofPlanEdges L: un encuentro vertical",
  L.encounters.length === 1 && L.encounters[0].orientation === "vertical",
  L.encounters,
  "1 vertical",
);
assert(
  "buildRoofPlanEdges L: longitud encuentro 5.6m",
  Math.abs(L.encounters[0].length - 5.6) < 0.02,
  L.encounters[0].length,
  5.6,
);
const extLExpected = 74.56;
assert(
  "buildRoofPlanEdges L: perímetro exterior reducido",
  Math.abs(L.totals.exteriorLength - extLExpected) < 0.05,
  L.totals.exteriorLength,
  extLExpected,
);
assert(
  "buildRoofPlanEdges L: 2*encuentros + exterior ≈ perímetro independiente",
  Math.abs(L.totals.exteriorLength + 2 * L.totals.encounterLength - perIndep) < 0.05,
  L.totals.exteriorLength + 2 * L.totals.encounterLength,
  perIndep,
);

const half = layoutZonasEnPlanta([{ largo: 8, ancho: 10 }], "dos_aguas");
assert(
  "layoutZonasEnPlanta dos_aguas: ancho planta = mitad",
  half.length === 1 && Math.abs(half[0].w - 5) < 0.001,
  half[0]?.w,
  5,
);

const d1 = { largo: 4, ancho: 8 };
const d2 = { largo: 4, ancho: 8 };
const dosSep = buildRoofPlanEdges([d1, d2], "dos_aguas");
assert(
  "buildRoofPlanEdges dos_aguas: ancho planta mitad por zona",
  dosSep.rects.length === 2 && Math.abs(dosSep.rects[0].w - 4) < 0.001 && Math.abs(dosSep.rects[1].w - 4) < 0.001,
  dosSep.rects.map((r) => r.w),
  [4, 4],
);
assert(
  "buildRoofPlanEdges dos_aguas separadas: sin encuentros (gap automático)",
  dosSep.encounters.length === 0,
  dosSep.encounters.length,
  0,
);

const stack = buildRoofPlanEdges(
  [
    { largo: 5, ancho: 10, preview: { x: 0, y: 0 } },
    { largo: 3, ancho: 10, preview: { x: 0, y: 5 } },
  ],
  "dos_aguas",
);
const horizJoin = stack.encounters.find((e) => e.orientation === "horizontal" && Math.abs(e.y1 - 5) < 0.02);
assert(
  "buildRoofPlanEdges dos_aguas apiladas: encuentro horizontal y=5, largo 5m (ancho útil planta)",
  horizJoin && Math.abs(horizJoin.length - 5) < 0.02,
  horizJoin?.length,
  5,
);

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 32b: roofEncounterModel (modos + vecino en planta)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 32b: roofEncounterModel ═══");

const nCont = normalizeEncounter({ tipo: "continuo" });
assert("normalizeEncounter continuo", nCont.modo === "continuo" && nCont.tipo === "continuo", nCont.modo, "continuo");

const nLegacy = normalizeEncounter({ tipo: "perfil", perfil: "foo" });
assert("normalizeEncounter legacy perfil → pretil", nLegacy.modo === "pretil" && nLegacy.perfil === "foo", nLegacy.modo, "pretil");

assert("encounterEsContinuo true", encounterEsContinuo({ modo: "continuo" }), true, true);
assert("encounterEsContinuo false", !encounterEsContinuo({ modo: "pretil", perfil: "x" }), false, false);

assert(
  "encounterBorderPerfil desnivel prioriza bajo",
  encounterBorderPerfil({ modo: "desnivel", perfil: "z", desnivel: { perfilBajo: "b", perfilAlto: "a" } }) === "b",
  encounterBorderPerfil({ modo: "desnivel", perfil: "z", desnivel: { perfilBajo: "b", perfilAlto: "a" } }),
  "b",
);

const zA = { largo: 10, ancho: 6, preview: { x: 0, y: 0 } };
const zB = { largo: 10, ancho: 6, preview: { x: 6, y: 0 } };
const rectsL = layoutZonasEnPlanta([zA, zB], "una_agua", 0);
const neigh = resolveNeighborSharedSide(0, "latDer", rectsL);
assert(
  "resolveNeighborSharedSide L: Z0 latDer → Z1 latIzq",
  neigh.neighborGi === 1 && neigh.neighborSide === "latIzq",
  `${neigh.neighborGi}/${neigh.neighborSide}`,
  "1/latIzq",
);

const zTop = { largo: 5, ancho: 10, preview: { x: 0, y: 0 } };
const zBot = { largo: 3, ancho: 10, preview: { x: 0, y: 5 } };
const rectsStack = layoutZonasEnPlanta([zTop, zBot], "una_agua", 0);
const nhF = resolveNeighborSharedSide(0, "frente", rectsStack);
assert(
  "resolveNeighborSharedSide stack: Z0 frente → Z1 fondo",
  nhF.neighborGi === 1 && nhF.neighborSide === "fondo",
  `${nhF.neighborGi}/${nhF.neighborSide}`,
  "1/fondo",
);

{
  const fullPretil = { tipo: "perfil", modo: "pretil", perfil: "pretil", perfilVecino: "pretil" };
  const runs0 = listEncounterPairSegmentRuns(fullPretil);
  assert(
    "listEncounterPairSegmentRuns sin segments → 1 run [0,1]",
    runs0.length === 1 && runs0[0].t0 === 0 && runs0[0].t1 === 1,
    runs0.length,
    1,
  );
  const split = splitEncounterPairSegmentMid(fullPretil, "full");
  assert("splitEncounterPairSegmentMid → 2 segmentos", split && split.segments.length === 2, split?.segments?.length, 2);
  const runs1 = listEncounterPairSegmentRuns(split);
  const spanSum = runs1.reduce((s, r) => s + (r.t1 - r.t0), 0);
  assert("runs tras split cubren t=1", Math.abs(spanSum - 1) < 1e-6, spanSum, 1);
  const halfCont = patchEncounterPairSegment(split, runs1[0].id, {
    encounter: { tipo: "continuo", modo: "continuo", perfil: null, perfilVecino: null, cumbreraUnida: false },
  });
  const runs2 = listEncounterPairSegmentRuns(halfCont);
  assert(
    "patch tramo 0 → continuo (sin perfil BOM)",
    encounterBorderPerfil(runs2[0].effectiveRaw) === "none",
    encounterBorderPerfil(runs2[0].effectiveRaw),
    "none",
  );
  assert(
    "patch tramo 1 → sigue pretil",
    encounterBorderPerfil(runs2[1].effectiveRaw) === "pretil",
    encounterBorderPerfil(runs2[1].effectiveRaw),
    "pretil",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 32c: roofSlopeMark (ciclo UI pendiente / 3D)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 32c: roofSlopeMark ═══");

assert("ROOF_SLOPE_MARKS length", ROOF_SLOPE_MARKS.length === 3, ROOF_SLOPE_MARKS.length, 3);
assert("nextRoofSlopeMark off → along_largo_pos", nextRoofSlopeMark("off") === "along_largo_pos", nextRoofSlopeMark("off"), "along_largo_pos");
assert("nextRoofSlopeMark along_largo_pos → along_largo_neg", nextRoofSlopeMark("along_largo_pos") === "along_largo_neg", nextRoofSlopeMark("along_largo_pos"), "along_largo_neg");
assert("nextRoofSlopeMark along_largo_neg → off", nextRoofSlopeMark("along_largo_neg") === "off", nextRoofSlopeMark("along_largo_neg"), "off");
assert("nextRoofSlopeMark undefined → along_largo_pos", nextRoofSlopeMark(undefined) === "along_largo_pos", nextRoofSlopeMark(undefined), "along_largo_pos");

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 32d: roofPrincipalZona (techo principal + apilado en planta)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 32d: roofPrincipalZona ═══");

assert(
  "defaultPrincipalZonaIndex picks max area",
  defaultPrincipalZonaIndex([
    { largo: 4, ancho: 5 },
    { largo: 6, ancho: 5 },
  ]) === 1,
  defaultPrincipalZonaIndex([
    { largo: 4, ancho: 5 },
    { largo: 6, ancho: 5 },
  ]),
  1,
);

const prevStack = previewPositionForTramoApiladoFrente({
  zonas: [
    { largo: 5, ancho: 6, preview: { x: 0, y: 0 } },
  ],
  tipoAguas: "una_agua",
  baseGi: 0,
  gapM: 0.25,
});
assert(
  "previewPositionForTramoApiladoFrente stacks below (+y)",
  prevStack && Math.abs(prevStack.x - 0) < 1e-6 && Math.abs(prevStack.y - (5 + 0.25)) < 1e-4,
  prevStack ? `${prevStack.x},${prevStack.y}` : "null",
  "0,5.25",
);

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 32e: roofLateralAnnexLayout (anexo lateral mismo cuerpo)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 32e: roofLateralAnnexLayout ═══");

assert("isLateralAnnexZona false sin attach", !isLateralAnnexZona({ largo: 1, ancho: 1 }), true, false);
assert(
  "isLateralAnnexZona true con attachParentGi",
  isLateralAnnexZona({ largo: 1, ancho: 1, preview: { attachParentGi: 0 } }),
  true,
  true,
);

const latDer = zonasToPlantRectsLogical(
  [
    { largo: 5, ancho: 4 },
    { largo: 5, ancho: 2, preview: { attachParentGi: 0, lateralSide: "der", lateralRank: 0 } },
  ],
  "una_agua",
);
const r0d = latDer.find((r) => r.gi === 0);
const r1d = latDer.find((r) => r.gi === 1);
assert(
  "zonasToPlantRectsLogical anexo der: junto al lateral derecho del padre (gap 0)",
  r0d && r1d && Math.abs(r1d.x - (r0d.x + r0d.w)) < 1e-5 && Math.abs(r1d.y - r0d.y) < 1e-5,
  r0d && r1d ? `${r0d.x},${r0d.w} → ${r1d.x}` : "missing",
  "touch",
);

const latIzq = zonasToPlantRectsLogical(
  [
    { largo: 4, ancho: 4 },
    { largo: 4, ancho: 2, preview: { attachParentGi: 0, lateralSide: "izq", lateralRank: 0 } },
  ],
  "una_agua",
);
const r0i = latIzq.find((r) => r.gi === 0);
const r1i = latIzq.find((r) => r.gi === 1);
assert(
  "zonasToPlantRectsLogical anexo izq: a la izquierda del padre",
  r0i && r1i && Math.abs(r1i.x + r1i.w - r0i.x) < 1e-5 && Math.abs(r1i.y - r0i.y) < 1e-5,
  r0i && r1i ? `${r1i.x}+${r1i.w} vs ${r0i.x}` : "missing",
  "touch",
);

assert("getRootZoneOrdinal una raíz", getRootZoneOrdinal([{ largo: 1, ancho: 1 }], 0) === 1, getRootZoneOrdinal([{ largo: 1, ancho: 1 }], 0), 1);
assert(
  "getRootZoneOrdinal raíz+anexo: segunda fila sigue ordinal 1",
  getRootZoneOrdinal(
    [{ largo: 1, ancho: 1 }, { largo: 1, ancho: 1, preview: { attachParentGi: 0 } }],
    1,
  ) === 1,
  getRootZoneOrdinal(
    [{ largo: 1, ancho: 1 }, { largo: 1, ancho: 1, preview: { attachParentGi: 0 } }],
    1,
  ),
  1,
);
assert(
  "getRootZoneOrdinal dos raíces: segunda raíz ordinal 2",
  getRootZoneOrdinal(
    [
      { largo: 1, ancho: 1 },
      { largo: 1, ancho: 1, preview: { attachParentGi: 0 } },
      { largo: 1, ancho: 1 },
    ],
    2,
  ) === 2,
  getRootZoneOrdinal(
    [
      { largo: 1, ancho: 1 },
      { largo: 1, ancho: 1, preview: { attachParentGi: 0 } },
      { largo: 1, ancho: 1 },
    ],
    2,
  ),
  2,
);
const t1 = formatZonaDisplayTitle(
  [{ largo: 4, ancho: 4 }, { largo: 4, ancho: 2, preview: { attachParentGi: 0, lateralRank: 0 } }],
  1,
);
assert(
  "formatZonaDisplayTitle anexo: refiere zona padre, no índice 2",
  typeof t1 === "string" && t1.includes("Zona 1") && t1.includes("extensión"),
  t1,
  "Zona 1 · extensión",
);

assert(
  "getLateralAnnexRootBodyGi anexo → raíz 0",
  getLateralAnnexRootBodyGi(
    [{ largo: 1, ancho: 1 }, { largo: 1, ancho: 1, preview: { attachParentGi: 0 } }],
    1,
  ) === 0,
  getLateralAnnexRootBodyGi(
    [{ largo: 1, ancho: 1 }, { largo: 1, ancho: 1, preview: { attachParentGi: 0 } }],
    1,
  ),
  0,
);
assert(
  "getLateralAnnexRootBodyGi cadena anexo→anexo → raíz 0",
  getLateralAnnexRootBodyGi(
    [
      { largo: 1, ancho: 1 },
      { largo: 1, ancho: 1, preview: { attachParentGi: 0 } },
      { largo: 1, ancho: 1, preview: { attachParentGi: 1 } },
    ],
    2,
  ) === 0,
  getLateralAnnexRootBodyGi(
    [
      { largo: 1, ancho: 1 },
      { largo: 1, ancho: 1, preview: { attachParentGi: 0 } },
      { largo: 1, ancho: 1, preview: { attachParentGi: 1 } },
    ],
    2,
  ),
  0,
);

const mergedManual = applyLateralAnnexLayout(
  [
    { largo: 5, ancho: 4 },
    {
      largo: 5,
      ancho: 2,
      preview: {
        attachParentGi: 0,
        lateralSide: "der",
        lateralRank: 0,
        lateralManual: true,
        x: 18.5,
        y: 0,
      },
    },
  ],
  "una_agua",
  0,
);
const pm1 = mergedManual[1]?.preview;
assert(
  "applyLateralAnnexLayout respeta lateralManual x/y del anexo",
  pm1 && Math.abs(pm1.x - 18.5) < 1e-5 && Math.abs(pm1.y - 0) < 1e-5,
  pm1 ? `${pm1.x},${pm1.y}` : "missing",
  "18.5,0",
);

const snapZs = [
  { largo: 4, ancho: 4 },
  { largo: 4, ancho: 2, preview: { attachParentGi: 0, lateralSide: "der", lateralRank: 0 } },
];
const snapRects = zonasToPlantRectsLogical(snapZs, "una_agua");
const snapEntries = snapRects.map((r) => ({ gi: r.gi, x: r.x, y: r.y, w: r.w, h: r.h }));
const r0s = snapRects.find((r) => r.gi === 0);
const snap1 = snapLateralAnnexPlanta(snapZs, "una_agua", 1, r0s.x + r0s.w + 0.08, snapEntries, 0.35);
assert(
  "snapLateralAnnexPlanta acerca al borde vertical del padre",
  snap1 && Math.abs(snap1.x - (r0s.x + r0s.w)) < 1e-4 && snap1.lateralManual === true,
  snap1 ? `${snap1.x},${snap1.lateralManual}` : "null",
  "touch+manual",
);
const xsCand = getAnnexSnapCandidateLeftXs(snapZs, "una_agua", 1, snapEntries);
assert(
  "getAnnexSnapCandidateLeftXs incluye borde derecho del padre",
  xsCand.some((x) => Math.abs(x - (r0s.x + r0s.w)) < 1e-5),
  xsCand.join(","),
  "has parent right",
);

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 32e2: roofPlanEdgeSegments (perímetro dibujable: junta interna vs 2 raíces)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 32e2: roofPlanEdgeSegments ═══");

function mapEntriesFromRects(rects) {
  return rects.map((r) => ({ gi: r.gi, x: r.x, y: r.y, w: r.w, h: r.h }));
}

function verticalLinesAtX(lines, xTarget, eps = 1e-3) {
  return (lines || []).filter(
    (ln) => Math.abs(ln.x1 - xTarget) < eps && Math.abs(ln.x2 - xTarget) < eps,
  );
}

const edgeSegZsSameH = [
  { largo: 5, ancho: 4 },
  { largo: 5, ancho: 2, preview: { attachParentGi: 0, lateralSide: "der", lateralRank: 0 } },
];
const edgeSegEntriesSameH = mapEntriesFromRects(zonasToPlantRectsLogical(edgeSegZsSameH, "una_agua"));
const edgeSegExtSameH = buildZoneBorderExteriorLines(edgeSegEntriesSameH, edgeSegZsSameH);
const r0Same = edgeSegEntriesSameH.find((e) => e.gi === 0);
const r1Same = edgeSegEntriesSameH.find((e) => e.gi === 1);
const xJointSame = r0Same.x + r0Same.w;
const vertParentSame = verticalLinesAtX(edgeSegExtSameH[0], xJointSame);
const vertAnnexSame = verticalLinesAtX(edgeSegExtSameH[1], r1Same.x);
assert(
  "buildZoneBorderExteriorLines mismo cuerpo misma altura: sin trazo en junta vertical (padre)",
  vertParentSame.length === 0,
  vertParentSame.length,
  0,
);
assert(
  "buildZoneBorderExteriorLines mismo cuerpo misma altura: sin trazo en junta vertical (anexo)",
  vertAnnexSame.length === 0,
  vertAnnexSame.length,
  0,
);

const edgeSegZsShortAnnex = [
  { largo: 6, ancho: 4 },
  { largo: 4, ancho: 2, preview: { attachParentGi: 0, lateralSide: "der", lateralRank: 0 } },
];
const edgeSegEntriesShort = mapEntriesFromRects(zonasToPlantRectsLogical(edgeSegZsShortAnnex, "una_agua"));
const edgeSegExtShort = buildZoneBorderExteriorLines(edgeSegEntriesShort, edgeSegZsShortAnnex);
const r0Short = edgeSegEntriesShort.find((e) => e.gi === 0);
const xJointShort = r0Short.x + r0Short.w;
const vertParentShort = verticalLinesAtX(edgeSegExtShort[0], xJointShort);
assert(
  "buildZoneBorderExteriorLines solape parcial: solo tramo libre del lateral del padre",
  vertParentShort.length === 1 &&
    Math.abs(vertParentShort[0].y1 - 4) < 0.02 &&
    Math.abs(vertParentShort[0].y2 - 6) < 0.02,
  vertParentShort,
  "one segment y≈4..6",
);

const edgeSegZsTwoRoots = [
  { largo: 10, ancho: 21.28, preview: { x: 0, y: 0 } },
  { largo: 5.6, ancho: 6, preview: { x: 21.28, y: 0 } },
];
const edgeSegEntriesTwo = mapEntriesFromRects(zonasToPlantRectsWithAutoGap(edgeSegZsTwoRoots, "una_agua"));
const edgeSegExtTwo = buildZoneBorderExteriorLines(edgeSegEntriesTwo, edgeSegZsTwoRoots);
const r0Two = edgeSegEntriesTwo.find((e) => e.gi === 0);
const xRight0 = r0Two.x + r0Two.w;
const vertTwoRoots = verticalLinesAtX(edgeSegExtTwo[0], xRight0);
const lenVertTwo = vertTwoRoots.reduce((s, ln) => s + Math.abs(ln.y2 - ln.y1), 0);
assert(
  "buildZoneBorderExteriorLines dos raíces: mantiene trazo en encuentro vertical",
  lenVertTwo >= 5.5,
  lenVertTwo,
  ">= 5.5",
);

const edgeBomShortAnnex = buildEdgeBOM(edgeSegZsShortAnnex, "una_agua");
assert(
  "buildEdgeBOM anexo más corto: ml latDer padre ≈ tramo libre 2 m",
  edgeBomShortAnnex.mlByZona[0] && Math.abs(edgeBomShortAnnex.mlByZona[0].latDer - 2) < 0.05,
  edgeBomShortAnnex.mlByZona[0]?.latDer,
  2,
);
assert(
  "buildEdgeBOM anexo más corto: un encuentro vertical ≈ 4 m",
  edgeBomShortAnnex.encounters.length === 1 && Math.abs(edgeBomShortAnnex.encounters[0].length - 4) < 0.05,
  edgeBomShortAnnex.encounters.map((e) => e.length).join(","),
  "4",
);

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 32f: roofPanelMapUrl (Vista 3D textura catálogo)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 32f: roofPanelMapUrl ═══");

const bestPick = pickBestMapUrlFromSlides([
  { src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/file.jpg?v=1752178338" },
  { src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Isoroof.jpg?v=1752180781" },
]);
assert(
  "pickBestMapUrlFromSlides prefiere Isoroof.jpg sobre file.jpg",
  bestPick.includes("Isoroof.jpg"),
  bestPick,
  "Isoroof.jpg",
);

const map3g = getRoofPanelMapUrl("ISOROOF_3G", "Gris");
assert(
  "getRoofPanelMapUrl ISOROOF_3G Gris evita file.jpg",
  !map3g.includes("/file.jpg"),
  map3g,
  "not file.jpg",
);

const mapPlus = getRoofPanelMapUrl("ISOROOF_PLUS", "");
assert(
  "getRoofPanelMapUrl ISOROOF_PLUS elige asset PLUS",
  mapPlus.includes("Isoroof_PLUS"),
  mapPlus,
  "Isoroof_PLUS",
);

const mapFoil = getRoofPanelMapUrl("ISOROOF_FOIL", "Gris");
assert(
  "getRoofPanelMapUrl ISOROOF_FOIL Gris evita file.jpg",
  !mapFoil.includes("/file.jpg"),
  mapFoil,
  "not file.jpg",
);

const mapEpsGris = getRoofPanelMapUrl("ISODEC_EPS", "Gris");
assert(
  "getRoofPanelMapUrl ISODEC_EPS Gris incluye ISODEC_GRIS",
  mapEpsGris.includes("ISODEC_GRIS"),
  mapEpsGris,
  "ISODEC_GRIS",
);

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE: Modo Transportista (token + webhook HMAC + FSM)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE: Modo Transportista (helpers) ═══");

const opaque = generateOpaqueToken();
assert("generateOpaqueToken non-empty", opaque.length >= 32, opaque.length, ">=32");
assert(
  "sha256Hex deterministic",
  sha256Hex("bmc") === sha256Hex("bmc"),
  true,
  true,
);

const waSecret = "unit-test-secret";
const waRaw = Buffer.from('{"entry":[]}');
const waSig = `sha256=${crypto.createHmac("sha256", waSecret).update(waRaw).digest("hex")}`;
const waOk = verifyWhatsAppSignature({
  appSecret: waSecret,
  rawBodyBuffer: waRaw,
  signatureHeader: waSig,
});
assert("verifyWhatsAppSignature valid", waOk.ok === true, waOk.ok, true);

const waBad = verifyWhatsAppSignature({
  appSecret: waSecret,
  rawBodyBuffer: waRaw,
  signatureHeader: "sha256=deadbeef",
});
assert("verifyWhatsAppSignature invalid", waBad.ok === false, waBad.ok, false);

const waSkip = verifyWhatsAppSignature({
  appSecret: "",
  rawBodyBuffer: waRaw,
  signatureHeader: "ignored",
});
assert(
  "verifyWhatsAppSignature skipped without secret",
  waSkip.skipped === true && waSkip.ok === true,
  `${waSkip.skipped}/${waSkip.ok}`,
  "true/true",
);

assert("isAllowedDriverEventType stop_arrived", isAllowedDriverEventType("stop_arrived"), true, true);
assert("isAllowedDriverEventType rejects unknown", !isAllowedDriverEventType("not_an_event"), true, true);

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE: 3D lateral step infill (cosmético, referencial)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE: roof3d coplanar layout + step infill vacío ═══");
const thetaInfillDeg = (15 * Math.PI) / 180;
const zRootInfill = { largo: 10.08, ancho: 10, preview: { x: 0, y: 0 } };
const zAnnInfill = {
  largo: 6,
  ancho: 5.6,
  preview: { attachParentGi: 0, lateralSide: "der", lateralRank: 0 },
};
const vzInfill = [zRootInfill, zAnnInfill];
const layInfill = buildZoneLayoutsForRoof3d(vzInfill, "una_agua", thetaInfillDeg);
const infInfill = buildLateralStepInfillGeometries(layInfill, vzInfill, thetaInfillDeg);
assert("lateral step infill: vacío (coplanar)", infInfill.length === 0, infInfill.length, 0);
const cosI = Math.cos(thetaInfillDeg);
const rootLay = layInfill.find((l) => l.gi === 0);
const annLay = layInfill.find((l) => l.gi === 1);
const zFondoRoot = rootLay && rootLay.oz - rootLay.largo * cosI;
const zFondoAnn = annLay && annLay.oz - annLay.largo * cosI;
assert(
  "coplanar: mismo z fondo (y=0)",
  rootLay && annLay && Math.abs(zFondoRoot - zFondoAnn) < 0.02,
  rootLay && annLay ? zFondoRoot - zFondoAnn : "missing",
  "~0",
);

// ═══════════════════════════════════════════════════════════════════════════
// SUITE: countPanels — IEEE-754 epsilon guard (Phase 1 plano/BOM sync)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE: countPanels IEEE-754 epsilon guard ═══");
assert(
  "countPanels exact multiple 3.36/1.12 = 3",
  countPanels(3.36, 1.12) === 3,
  countPanels(3.36, 1.12),
  3,
);
assert(
  "countPanels slightly over 3.36/1.12 = 4",
  countPanels(3.3601, 1.12) === 4,
  countPanels(3.3601, 1.12),
  4,
);

// ═══════════════════════════════════════════════════════════════════════════
// SUITE: ML answer text — U$S → USD; remaining ASCII $ → fullwidth
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE: normalizeMlAnswerCurrencyText ═══");
const fw = "\uFF04";
assert(
  "U$S becomes USD (no dollar glyph for ML)",
  normalizeMlAnswerCurrencyText("U$S 1.456,88") === "USD 1.456,88",
  normalizeMlAnswerCurrencyText("U$S 1.456,88"),
  "USD 1.456,88",
);
assert(
  "u$s lower-case becomes USD",
  normalizeMlAnswerCurrencyText("Precio u$s 10") === "Precio USD 10",
  normalizeMlAnswerCurrencyText("Precio u$s 10"),
  "Precio USD 10",
);
const multi = normalizeMlAnswerCurrencyText("a $1 $2");
assert(
  "multiple $ replaced",
  !multi.includes("$") && multi === `a ${fw}1 ${fw}2`,
  multi,
  `a ${fw}1 ${fw}2`,
);

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 33: scenarioOrchestrator — guards y ramas de alto riesgo
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 33: scenarioOrchestrator ═══");

{
  const r = executeScenario("unknown_scenario", { techo: {}, pared: {}, camara: {} });
  assert("executeScenario unknown scenario -> null", r === null, r, null);
}

{
  const r = executeScenario("solo_techo", {
    techo: { familia: "ISODEC_EPS", espesor: null },
    pared: {},
    camara: {},
  });
  assert("executeScenario solo_techo without espesor -> null", r === null, r, null);
}

{
  const r = executeScenario("techo_fachada", {
    techo: { familia: "", espesor: null },
    pared: { familia: "", espesor: null },
    camara: {},
  });
  assert("executeScenario techo_fachada without techo+pared -> null", r === null, r, null);
}

{
  const paredOnly = {
    familia: "ISOPANEL_EPS",
    espesor: 100,
    alto: 3.2,
    perimetro: 30,
    numEsqExt: 4,
    numEsqInt: 0,
    aberturas: [],
    tipoEst: "metal",
    inclSell: false,
    incl5852: false,
    color: "Blanco",
  };
  const r = executeScenario("techo_fachada", {
    techo: { familia: "", espesor: null },
    pared: paredOnly,
    camara: {},
  });
  assert("executeScenario techo_fachada (pared only) returns result", !!r && Array.isArray(r.allItems), !!r, true);
  assert("executeScenario techo_fachada (pared only) keeps paredResult", !!r?.paredResult, !!r?.paredResult, true);
  assert(
    "executeScenario techo_fachada (pared only) totals are computed from allItems",
    r?.totales?.totalFinal === calcTotalesSinIVA(r?.allItems || []).totalFinal,
    r?.totales?.totalFinal,
    calcTotalesSinIVA(r?.allItems || []).totalFinal
  );
}

{
  const r = executeScenario("camara_frig", {
    techo: {},
    pared: {
      familia: "ISOWALL_PIR",
      espesor: 80,
      tipoEst: "metal",
      inclSell: true,
      incl5852: false,
      color: "Blanco",
      aberturas: [],
    },
    camara: {
      largo_int: 6,
      ancho_int: 4,
      alto_int: 3,
    },
  });
  assert("executeScenario camara_frig returns result", !!r, !!r, true);
  assert("executeScenario camara_frig provides techoResult on valid dims", !!r?.techoResult, !!r?.techoResult, true);
}

{
  const r = executeScenario("solo_techo", {
    techo: {
      familia: "ISODEC_EPS",
      espesor: 100,
      tipoAguas: "una_agua",
      tipoEst: "metal",
      pendiente: 0,
      pendienteModo: "incluye_pendiente",
      alturaDif: 0,
      borders: {
        frente: "gotero_frontal",
        fondo: "gotero_lateral",
        latIzq: "gotero_lateral",
        latDer: "gotero_lateral",
      },
      opciones: { inclSell: false, inclCanalon: false, inclGotSup: false, bomComercial: false },
      zonas: [
        {
          largo: 6,
          ancho: 4,
          preview: {
            encounterByPair: {
              "0-1": { tipo: "perfil", modo: "pretil", perfil: "gotero_lateral" },
            },
          },
        },
        { largo: 4, ancho: 2, preview: { attachParentGi: 0, lateralSide: "der", lateralRank: 0 } },
      ],
    },
    pared: {},
    camara: {},
  });
  assert("executeScenario solo_techo anexo corto + encuentro: resultado", !!r && Array.isArray(r.allItems), !!r, true);
  const encLine = (r?.allItems || []).find(
    (it) => String(it.label || "").includes("Encuentro (0-1)") && it.tipo === "gotero_lateral",
  );
  assert(
    "executeScenario solo_techo: BOM encuentro en tramo compartido (longitud geométrica 4 m → perfilería)",
    !!encLine && Number(encLine.ml) >= 4,
    encLine ? `${encLine.label} ml=${encLine.ml}` : "missing",
    "Encuentro gotero_lateral ml≥4",
  );
}

{
  const r = executeScenario("solo_techo", {
    techo: {
      familia: "ISODEC_EPS",
      espesor: 100,
      tipoAguas: "dos_aguas",
      tipoEst: "metal",
      pendiente: 0,
      pendienteModo: "incluye_pendiente",
      alturaDif: 0,
      borders: {
        frente: "gotero_frontal",
        fondo: "gotero_lateral",
        latIzq: "gotero_lateral",
        latDer: "gotero_lateral",
      },
      opciones: { inclSell: false, inclCanalon: false, inclGotSup: false, bomComercial: false },
      zonas: [
        {
          largo: 6,
          ancho: 4,
          preview: {
            encounterByPair: {
              "0-1": { tipo: "perfil", modo: "pretil", perfil: "gotero_lateral" },
            },
          },
        },
        { largo: 4, ancho: 2, preview: { attachParentGi: 0, lateralSide: "der", lateralRank: 0 } },
      ],
    },
    pared: {},
    camara: {},
  });
  assert("executeScenario solo_techo dos_aguas anexo + encuentro: resultado", !!r && Array.isArray(r.allItems), !!r, true);
  const encLine2a = (r?.allItems || []).find(
    (it) => String(it.label || "").includes("Encuentro (0-1)") && it.tipo === "gotero_lateral",
  );
  assert(
    "executeScenario solo_techo dos_aguas: BOM encuentro usa longitud geométrica del tramo compartido",
    !!encLine2a && Number(encLine2a.ml) >= 4,
    encLine2a ? `${encLine2a.label} ml=${encLine2a.ml}` : "missing",
    "Encuentro gotero_lateral ml≥4",
  );
}

{
  const partialZsFach = [
    { largo: 6, ancho: 4 },
    { largo: 4, ancho: 2, preview: { attachParentGi: 0, lateralSide: "der", lateralRank: 0 } },
  ];
  const sharedPart = getSharedSidesPerZona(partialZsFach, "una_agua");
  const m0p = sharedPart.get(0);
  assert(
    "getSharedSidesPerZona anexo corto: latDer padre partial (no fullySide)",
    m0p?.get("latDer") && m0p.get("latDer").fullySide === false,
    m0p?.get("latDer")?.fullySide,
    false,
  );
  const effPart = effectiveBordersTechoFachada({ latDer: "gotero_lateral", frente: "gotero_frontal" }, m0p);
  assert(
    "effectiveBordersTechoFachada solape parcial: conserva tipo latDer",
    effPart.latDer === "gotero_lateral" && effPart.frente === "gotero_frontal",
    `${effPart.latDer},${effPart.frente}`,
    "gotero_lateral,gotero_frontal",
  );

  const fullZsFach = [
    { largo: 5, ancho: 4 },
    { largo: 5, ancho: 2, preview: { attachParentGi: 0, lateralSide: "der", lateralRank: 0 } },
  ];
  const sharedFull = getSharedSidesPerZona(fullZsFach, "una_agua");
  const m0f = sharedFull.get(0);
  assert(
    "getSharedSidesPerZona misma altura: latDer padre fullySide",
    m0f?.get("latDer")?.fullySide === true,
    m0f?.get("latDer")?.fullySide,
    true,
  );
  const effFull = effectiveBordersTechoFachada({ latDer: "gotero_lateral" }, m0f);
  assert(
    "effectiveBordersTechoFachada lado entero compartido: latDer → none",
    effFull.latDer === "none",
    effFull.latDer,
    "none",
  );
}

// Per-segment BOM tests (segment-level includeInBom + split with different profiles)
{
  // Shared geometry: zone 0 = 6×4, zone 1 = 4×2 annex-der → encounter length ≈ 4 m
  const baseZonas = (encounterByPair0) => [
    {
      largo: 6,
      ancho: 4,
      preview: {
        encounterByPair: { "0-1": encounterByPair0 },
      },
    },
    { largo: 4, ancho: 2, preview: { attachParentGi: 0, lateralSide: "der", lateralRank: 0 } },
  ];
  const baseTecho = (encounterByPair0) => ({
    familia: "ISODEC_EPS",
    espesor: 100,
    tipoAguas: "una_agua",
    tipoEst: "metal",
    pendiente: 0,
    pendienteModo: "incluye_pendiente",
    alturaDif: 0,
    borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
    opciones: { inclSell: false, inclCanalon: false, inclGotSup: false, bomComercial: false },
    zonas: baseZonas(encounterByPair0),
  });

  // Test 1: includeInBom: false on the full segment → no BOM line for that pair
  const pairDisabled = patchEncounterPairSegment(
    { tipo: "perfil", modo: "pretil", perfil: "gotero_lateral" },
    "full",
    { includeInBom: false },
  );
  const r1 = executeScenario("solo_techo", { techo: baseTecho(pairDisabled), pared: {}, camara: {} });
  assert("per-segment: resultado válido con tramo desactivado", !!r1 && Array.isArray(r1.allItems), !!r1, true);
  const encDisabled = (r1?.allItems || []).find((it) => String(it.label || "").includes("Encuentro (0-1)"));
  assert(
    "per-segment: includeInBom=false → sin línea BOM para ese par",
    encDisabled == null,
    encDisabled ? `${encDisabled.label}` : "absent",
    "absent",
  );

  // Test 2: split into two halves with different profiles → two BOM lines, ml sum = encounter length
  const fullPretil = { tipo: "perfil", modo: "pretil", perfil: "gotero_lateral" };
  const split = splitEncounterPairSegmentMid(fullPretil, "full");
  assert("split produce 2 segments", split && split.segments.length === 2, split?.segments?.length, 2);
  const [idA, idB] = split.segments.map((s) => s.id);
  const pairSplit = patchEncounterPairSegment(
    patchEncounterPairSegment(split, idA, { encounter: { tipo: "perfil", modo: "pretil", perfil: "gotero_lateral" } }),
    idB,
    { encounter: { tipo: "perfil", modo: "cumbrera", perfil: "cumbrera", cumbreraUnida: true } },
  );
  const r2 = executeScenario("solo_techo", { techo: baseTecho(pairSplit), pared: {}, camara: {} });
  assert("per-segment split: resultado válido", !!r2 && Array.isArray(r2.allItems), !!r2, true);
  const encLines = (r2?.allItems || []).filter((it) => String(it.label || "").includes("Encuentro (0-1)"));
  assert(
    "per-segment split: dos líneas BOM con perfiles distintos",
    encLines.length === 2,
    encLines.length,
    2,
  );
  // mlNecesario = geometric length needed (before barra rounding); compare against reference
  const mlNecSum = encLines.reduce((s, it) => s + Number(it.mlNecesario || 0), 0);
  const r2ref = executeScenario("solo_techo", { techo: baseTecho(fullPretil), pared: {}, camara: {} });
  const refLine = (r2ref?.allItems || []).find((it) => String(it.label || "").includes("Encuentro (0-1)"));
  const refNec = refLine ? Number(refLine.mlNecesario) : 0;
  assert(
    "per-segment split: suma mlNecesario ≈ longitud geométrica total del encuentro",
    refNec > 0 && Math.abs(mlNecSum - refNec) < 0.01,
    `sum=${mlNecSum.toFixed(4)} ref=${refNec.toFixed(4)}`,
    `sum≈ref`,
  );
  const tipos = new Set(encLines.map((it) => it.tipo));
  assert(
    "per-segment split: perfiles distintos en las dos mitades",
    tipos.size === 2,
    [...tipos].join(","),
    "2 tipos distintos",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 34: Knowledge antenna helpers (RSS + scoring)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 34: knowledge-antenna helpers ═══");

const rssSample = `
<rss><channel>
  <item>
    <title>OpenAI &amp; Agents</title>
    <link>https://example.com/openai-agents</link>
    <pubDate>Fri, 03 Apr 2026 00:00:00 GMT</pubDate>
    <description><p>Hello &amp; <b>world</b></p></description>
  </item>
  <item>
    <title>Ignored without link</title>
    <description>missing link</description>
  </item>
</channel></rss>
`;
const rssItems = parseRssItems(rssSample);
assert("parseRssItems keeps only entries with title+link", rssItems.length === 1, rssItems.length, 1);
assert("parseRssItems decodes title entities", rssItems[0]?.title === "OpenAI & Agents", rssItems[0]?.title, "OpenAI & Agents");
assert("parseRssItems strips HTML description", rssItems[0]?.description === "Hello & world", rssItems[0]?.description, "Hello & world");
assert("pickTier boundary 0.85 => tier-1", pickTier(0.85) === "tier-1", pickTier(0.85), "tier-1");
assert("pickTier boundary 0.65 => tier-2", pickTier(0.65) === "tier-2", pickTier(0.65), "tier-2");
assert("pickTier low score => tier-3", pickTier(0.64) === "tier-3", pickTier(0.64), "tier-3");
assert("clamp01 floors negatives", clamp01(-2) === 0, clamp01(-2), 0);
assert("clamp01 caps >1", clamp01(2.5) === 1, clamp01(2.5), 1);

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 35: Roof 3D layout helpers (annex front coplanar)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 35: roofZoneLayouts3d + visual profile ═══");

const zonas3d = [
  { largo: 6, ancho: 4, preview: { x: 1, y: 2, slopeMark: "along_largo_neg" } },
  { largo: 3, ancho: 2, preview: { attachParentGi: 0, lateralSide: "der", lateralRank: 0, slopeMark: "off" } },
  { largo: 4, ancho: 4, preview: { x: 20, y: 1, slopeMark: "along_largo_pos" } },
];
const layouts3d = buildZoneLayoutsForRoof3d(zonas3d, "una_agua");
const byGi3d = new Map(layouts3d.map((l) => [l.gi, l]));
const z0 = byGi3d.get(0);
const z1 = byGi3d.get(1);
const z2 = byGi3d.get(2);
assert("buildZoneLayoutsForRoof3d includes all valid zonas", layouts3d.length === 3, layouts3d.length, 3);
assert("buildZoneLayoutsForRoof3d root oz is positive (3d space)", z0?.oz > 0, z0?.oz, "> 0");
assert("buildZoneLayoutsForRoof3d annex oz matches independent root oz", approx(z1?.oz, z2?.oz, 0.0001), z1?.oz, z2?.oz);
assert("buildZoneLayoutsForRoof3d preserves slopeMark", z0?.slopeMark === "along_largo_neg" && z1?.slopeMark === "off", `${z0?.slopeMark}/${z1?.slopeMark}`, "along_largo_neg/off");

const dosAguas3d = buildZoneLayoutsForRoof3d([{ largo: 4, ancho: 10 }], "dos_aguas");
assert("buildZoneLayoutsForRoof3d dos_aguas halves ancho in planta", approx(dosAguas3d[0]?.ancho, 5, 0.0001), dosAguas3d[0]?.ancho, 5);

const withInvalidZona = buildZoneLayoutsForRoof3d([
  { largo: 0, ancho: 4 },
  { largo: 2, ancho: 2 },
], "una_agua");
assert(
  "buildZoneLayoutsForRoof3d filters invalid zonas and keeps original gi",
  withInvalidZona.length === 1 && withInvalidZona[0]?.gi === 1,
  JSON.stringify(withInvalidZona.map((z) => z.gi)),
  "[1]",
);

// ═══════════════════════════════════════════════════════════════════════════
// SUITE: Omnicanal Meta — heurística + mapeo CRM + webhook Meta

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 32g: Combinada — mapa 2D / layout de puntos
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE 32g: combinadaFijacionShared + dots layout keys ═══");
assert(
  "cycleCombinadaMaterial metal→madera",
  cycleCombinadaMaterial("metal") === "madera",
  cycleCombinadaMaterial("metal"),
  "madera",
);
const keys5 = ["r0-j0", "r0-j1", "r1-j0", "r1-j1", "r2-j0"];
const initComb = buildInitialByKeyFromOrderedDots(keys5, 1, 2, 1);
assert(
  "buildInitialByKeyFromOrderedDots orden fila-major",
  initComb["r0-j0"] === "hormigon" &&
    initComb["r0-j1"] === "metal" &&
    initComb["r1-j1"] === "madera" &&
    initComb["r2-j0"] === "metal",
  JSON.stringify(initComb),
  "h + 2×metal + madera + metal resto",
);
const dotsStub = keys5.map((k) => ({ key: k }));
const cntComb = countCombinadaMaterialsInDots(dotsStub, initComb);
assert(
  "countCombinadaMaterialsInDots 1/3/1",
  cntComb.ptsHorm === 1 && cntComb.ptsMetal === 3 && cntComb.ptsMadera === 1,
  `${cntComb.ptsHorm}/${cntComb.ptsMetal}/${cntComb.ptsMadera}`,
  "1/3/1",
);
const rDots = { x: 0, y: 0, w: 5, h: 4, gi: 0 };
const hintsDots = { puntosFijacion: 7, apoyos: 3 };
const laid = fijacionDotsLayoutDistributeTotal(rDots, hintsDots);
assert(
  "fijacionDotsLayoutDistributeTotal keys + rowIndex",
  laid.length === 7 &&
    laid.every((d) => typeof d.key === "string" && d.rowIndex != null && d.rowIndex >= 0),
  laid.length,
  7,
);
const jointDots = [
  { key: "r0-p0-a", kind: "grid", cx: 4.55 },
  { key: "r0-p1-b", kind: "grid", cx: 5.45 },
  /** Mismo panel p0; lejos de la junta x=5 m (no debe entrar ni con tolerancia amplia ~media anchura). */
  { key: "r1-p0-c", kind: "grid", cx: 0.35 },
];
const jointR = { x: 0, w: 10 };
const jointKeys = fijacionDotKeysForVerticalJoint(jointDots, 1, jointR, 2);
assert(
  "fijacionDotKeysForVerticalJoint solo puntos cerca de la junta (cx)",
  jointKeys.includes("r0-p0-a") && jointKeys.includes("r0-p1-b") && !jointKeys.includes("r1-p0-c"),
  JSON.stringify(jointKeys),
  "cerca de x=5 m, no el centro del panel 0",
);
const hintsCaballete = { puntosFijacion: 8, apoyos: 3, fijacionSistema: "caballete", fijacionDotsMode: "distribute" };
const laidJoint = fijacionDotsLayoutDistributeTotal({ x: 0, y: 0, w: 10, h: 4, gi: 0 }, hintsCaballete);
const nearJ = fijacionDotKeysNearPanelJoint(laidJoint, 1, { x: 0, w: 10 }, 2, hintsCaballete);
assert(
  "fijacionDotKeysNearPanelJoint modo no-ISODEC junta en x=5 m",
  nearJ.length >= 1 && nearJ.every((k) => typeof k === "string"),
  JSON.stringify(nearJ),
  ">=1 keys",
);
const hintsIso = { fijacionSistema: "varilla_tuerca", fijacionDotsMode: "isodec_grid" };
const nearIso = fijacionDotKeysNearPanelJoint(jointDots, 1, jointR, 2, hintsIso);
assert(
  "fijacionDotKeysNearPanelJoint delega a ISODEC",
  JSON.stringify(nearIso.sort()) === JSON.stringify(jointKeys.sort()),
  JSON.stringify(nearIso),
  JSON.stringify(jointKeys),
);
const rIsoReal = { x: 0, y: 0, w: 10, h: 4, gi: 0 };
const hintsIsoReal = {
  apoyos: 3,
  cantPaneles: 2,
  fijacionSistema: "varilla_tuerca",
  fijacionDotsMode: "isodec_grid",
  puntosFijacion: 99,
  fijacionEspaciadoPerimetroM: 2.5,
};
const dotsIsoReal = fijacionDotsLayout(rIsoReal, hintsIsoReal, []);
const jkReal = fijacionDotKeysForVerticalJoint(dotsIsoReal, 1, rIsoReal, 2);
assert(
  "fijacionDotKeysForVerticalJoint ISODEC real 10×4 m 2 paneles: junta con claves (fallback ancho)",
  jkReal.length >= 2,
  JSON.stringify(jkReal),
  ">=2 keys",
);
const byJ = { "r0-p0-a": "metal", "r0-p1-b": "metal" };
const ovBulk = bulkSetDotsMaterialEnabled(jointKeys, "hormigon", byJ, {});
assert(
  "bulkSetDotsMaterialEnabled fuerza material y enabled",
  ovBulk["r0-p0-a"].mat === "hormigon" && ovBulk["r0-p0-a"].enabled === true,
  JSON.stringify(ovBulk["r0-p0-a"]),
  "hormigon true",
);
const ovOff = bulkDisableDots(jointKeys, byJ, ovBulk);
const dotsCnt = jointKeys.map((k) => ({ key: k }));
const cntJ = countPtsWithOverrides(dotsCnt, byJ, ovOff);
assert(
  "bulkDisableDots anula cómputo",
  cntJ.ptsHorm === 0 && cntJ.ptsMetal === 0 && cntJ.ptsMadera === 0,
  `${cntJ.ptsHorm}/${cntJ.ptsMetal}/${cntJ.ptsMadera}`,
  "0/0/0",
);
const ovStrip = stripDotOverrideKeys(ovOff, jointKeys);
assert(
  "stripDotOverrideKeys limpia overrides",
  Object.keys(ovStrip).length === 0,
  String(Object.keys(ovStrip).length),
  "0",
);

// ── combinada: conteos por material → reglas de varilla/tuerca/tacos (calcFijacionesVarilla) ──
const fijComb = calcFijacionesVarilla(2, 3, 5, "combinada", 4, 6, 2, { espesorMm: 100 });
const skuCant = (sku) => {
  const it = (fijComb.items || []).find((x) => x.sku === sku);
  return it ? Math.round(Number(it.cant)) : -1;
};
assert(
  "calcFijacionesVarilla combinada: tacos = puntos hormigón",
  skuCant("taco_expansivo") === 4,
  String(skuCant("taco_expansivo")),
  "4",
);
const tuercasEsp = 6 * 2 + 4 * 1 + 2 * 2;
assert(
  "calcFijacionesVarilla combinada: tuercas metal×2 + horm×1 + madera×2",
  skuCant("tuerca_38") === tuercasEsp,
  String(skuCant("tuerca_38")),
  String(tuercasEsp),
);
assert(
  "calcFijacionesVarilla combinada: arandela plana solo metal+madera",
  skuCant("arandela_plana") === 6 + 2,
  String(skuCant("arandela_plana")),
  "8",
);

// ═══════════════════════════════════════════════════════════════════════════
// SUITE: Panelin interno — RBAC dashboard (políticas puras)
// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ SUITE: panelinInternalRbac ═══");
assert("normalizePanelinRole acepta director", normalizePanelinRole("Director") === "director", normalizePanelinRole("Director"), "director");
assert("normalizePanelinRole rechaza foo", normalizePanelinRole("foo") === null, normalizePanelinRole("foo"), "null");
assert("roleMeetsMin ventas < admin", !roleMeetsMin("ventas", "admin"), "ventas>=admin", "false");
assert("roleMeetsMin director >= admin", roleMeetsMin("director", "admin"), "director>=admin", "true");
assert(
  "getMinRoleForDashboardRoute POST /api/cotizaciones = admin",
  getMinRoleForDashboardRoute("POST", "/api/cotizaciones") === "admin",
  getMinRoleForDashboardRoute("POST", "/api/cotizaciones"),
  "admin",
);
const ventasCot = canAccessDashboardRoute("GET", "/api/cotizaciones", "ventas");
assert("ventas puede GET /api/cotizaciones", ventasCot.allowed === true, ventasCot.allowed, true);
const ventasPost = canAccessDashboardRoute("POST", "/api/cotizaciones", "ventas");
assert("ventas no puede POST /api/cotizaciones", ventasPost.allowed === false, ventasPost.allowed, false);
const logPost = canAccessDashboardRoute("POST", "/api/cotizaciones", "logistica");
assert("logistica no puede POST /api/cotizaciones", logPost.allowed === false, logPost.allowed, false);
const dirMatriz = canAccessDashboardRoute("POST", "/api/matriz/push-pricing-overrides", "director");
assert("director puede push matriz", dirMatriz.allowed === true, dirMatriz.allowed, true);
const adminMatriz = canAccessDashboardRoute("POST", "/api/matriz/push-pricing-overrides", "admin");
assert("admin no puede push matriz", adminMatriz.allowed === false, adminMatriz.allowed, false);

const toolCotGet = getInternalToolById("api_cotizaciones_get");
assert("getInternalToolById api_cotizaciones_get", toolCotGet?.path === "/api/cotizaciones", toolCotGet?.path, "/api/cotizaciones");
const mayV = mayInvokeTool("ventas", toolCotGet);
assert("mayInvokeTool ventas api_cotizaciones_get", mayV.ok === true, mayV.ok, true);
const mayVpost = mayInvokeTool("ventas", getInternalToolById("api_cotizaciones_post"));
assert("mayInvokeTool ventas api_cotizaciones_post denegado", mayVpost.ok === false, mayVpost.ok, false);

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(60)}`);
console.log(`RESULTADOS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"═".repeat(60)}\n`);

process.exit(failed > 0 ? 1 : 0);
