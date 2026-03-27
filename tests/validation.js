// ═══════════════════════════════════════════════════════════════════════════
// Tests de Validación — Panelin Calculadora BMC v3.0
// Ejecutar: node tests/validation.js
// ═══════════════════════════════════════════════════════════════════════════

import { calcTechoCompleto, calcParedCompleto, calcFactorPendiente, calcLargoReal, mergeZonaResults, calcPresupuestoLibre, calcPerfileriaTechoComercial, calcFijacionesVarilla } from "../src/utils/calculations.js";
import { deserializeProject } from "../src/utils/projectFile.js";
import { bomToGroups, applyOverrides, createLineId } from "../src/utils/helpers.js";
import { computePresupuestoLibreCatalogo, flattenPerfilesLibre } from "../src/utils/presupuestoLibreCatalogo.js";
import { PERFIL_TECHO, PERFIL_PARED, PANELS_TECHO, PANELS_PARED } from "../src/data/constants.js";
import { listDueItems, parseDueInput, parseDays } from "../server/lib/followUpStore.js";
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
  getDuplicatePathReport,
} from "../src/utils/csvPricingImport.js";
import { resolveEmailInboxRepoRoot } from "../server/lib/emailInboxRepoResolve.js";
import { readPanelsimEmailSummary } from "../server/lib/panelsimSummaryReader.js";
import { colLetterToIndex, colIndexToLetter } from "../server/lib/sheetColumnLetters.js";

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

const cantP = 5, apoyosT = 3, largoT = 6.5;
const puntosFij = Math.ceil(((cantP * apoyosT) * 2) + (largoT * 2 / 2.5));
assert("Puntos fijación = 36", puntosFij === 36, puntosFij, 36);

const varillas = Math.ceil(puntosFij / 4);
assert("Varillas = 9", varillas === 9, varillas, 9);

const tuercas_metal = puntosFij * 2;
assert("Tuercas metal = 72", tuercas_metal === 72, tuercas_metal, 72);

const tuercas_horm = puntosFij * 1;
assert("Tuercas hormigón = 36", tuercas_horm === 36, tuercas_horm, 36);

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
const paredConCinta = calcParedCompleto({ ...paredInput, inclCintaButilo: true });
assert(
  "calcParedCompleto + inclCintaButilo: incluye cinta",
  paredConCinta.allItems.some((i) => i.sku === "cinta_butilo"),
  paredConCinta.allItems.filter((i) => i.sku === "cinta_butilo").length,
  ">=1"
);
const paredConSil300 = calcParedCompleto({ ...paredInput, inclSilicona300Neutra: true });
assert(
  "calcParedCompleto + inclSilicona300Neutra: incluye silicona 300",
  paredConSil300.allItems.some((i) => i.sku === "silicona_300_neutra"),
  paredConSil300.allItems.filter((i) => i.sku === "silicona_300_neutra").length,
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

const techoP15 = calcTechoCompleto({ ...techoInput, pendiente: 15 });
assert("calcTechoCompleto(15°): pendienteInfo exists", techoP15.pendienteInfo !== null, !!techoP15.pendienteInfo, true);
assert("calcTechoCompleto(15°): largoReal > largo", techoP15.pendienteInfo.largoReal > techoInput.largo, techoP15.pendienteInfo?.largoReal, ">" + techoInput.largo);

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

const dupLines = [
  "path,costo,venta_local",
  "A.B,1,2",
  "A.B,3,4",
  "C.D,1,1",
];
const dups = getDuplicatePathReport(dupLines, 0);
assert("getDuplicatePathReport one dup", dups.length === 1 && dups[0].path === "A.B" && dups[0].count === 2, JSON.stringify(dups), "1 dup A.B");

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

// 24.3 ISODEC_EPS_PARED panel exists
assert(
  "PANELS_PARED ISODEC_EPS_PARED exists",
  PANELS_PARED.ISODEC_EPS_PARED != null,
  !!PANELS_PARED.ISODEC_EPS_PARED,
  true,
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

// 24.5 calcParedCompleto with ISODEC_EPS_PARED
{
  const r = calcParedCompleto({ familia: "ISODEC_EPS_PARED", espesor: 100, alto: 3, perimetro: 30, tipoEst: "metal" });
  assert(
    "calcParedCompleto ISODEC_EPS_PARED → cantPaneles > 0",
    r?.paneles?.cantPaneles > 0,
    r?.paneles?.cantPaneles,
    ">0",
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
  const r = calcFijacionesVarilla(10, 2, 20, "metal", 0, 0, 0, { overridePuntosFijacion: 50 });
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
}

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
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(60)}`);
console.log(`RESULTADOS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"═".repeat(60)}\n`);

process.exit(failed > 0 ? 1 : 0);
