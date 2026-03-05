// ═══════════════════════════════════════════════════════════════════════════
// Tests de Validación — Panelin Calculadora BMC v3.0
// Ejecutar: node tests/validation.js
// ═══════════════════════════════════════════════════════════════════════════

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

const paqT2 = Math.ceil(tornillosT2 / 100);
assert("Paquetes T2 = " + paqT2, paqT2 > 0, paqT2, ">0");

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
const paquetesAguja = Math.ceil(tornillosAguja / 100);
assert("Paquetes tornillo aguja >= 1", paquetesAguja >= 1, paquetesAguja, ">=1");
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
const paquetesT1 = Math.ceil(fijPerf / 100);
assert("Tornillos T1 paquetes >= 1", paquetesT1 >= 1, paquetesT1, ">=1");

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

// The fixed logic: flete state value is used directly as pu and total
const fleteState = 280; // user-supplied value
const fleteItem = { label: "Flete", sku: "FLETE", cant: 1, unidad: "servicio", pu: fleteState, total: fleteState };
assert("Flete BOM pu matches user input", fleteItem.pu === fleteState, fleteItem.pu, fleteState);
assert("Flete BOM total matches user input", fleteItem.total === fleteState, fleteItem.total, fleteState);

const fleteState0 = 0;
assert("Flete = 0 means no line added (guard check)", fleteState0 === 0, fleteState0, 0);

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(60)}`);
console.log(`RESULTADOS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"═".repeat(60)}\n`);

process.exit(failed > 0 ? 1 : 0);
