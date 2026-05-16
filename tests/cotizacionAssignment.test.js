/**
 * Contract tests for src/utils/cotizacionAssignment.js
 * Run: node tests/cotizacionAssignment.test.js
 */

import {
  suggestOwner,
  operatorLabel,
  OPERATOR_CODES,
  normalizeOperatorCode,
} from "../src/utils/cotizacionAssignment.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) { passed += 1; }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}
function group(name, fn) { console.log(`\n— ${name}`); fn(); }

group("Cobranzas keyword wins regardless of channel → SA", () => {
  assert(suggestOwner({ origen: "WA", consulta: "Hola, necesito pasar el pago de la cotización" }) === "SA", "WA + pago → SA");
  assert(suggestOwner({ origen: "EM", consulta: "Cuándo emiten la factura?" }) === "SA", "EM + factura → SA");
  assert(suggestOwner({ origen: "ML", consulta: "Hago la transferencia hoy?" }) === "SA", "ML + transferencia → SA");
  assert(suggestOwner({ origen: "LL", consulta: "Cuánto saldo me queda?" }) === "SA", "LL + saldo → SA");
});

group("Soporte / post-venta keywords → MP", () => {
  assert(suggestOwner({ origen: "WA", consulta: "Tengo una queja con el último envío" }) === "MP", "queja → MP");
  assert(suggestOwner({ origen: "EM", consulta: "Quiero hacer una devolución de los goteros" }) === "MP", "devolución → MP");
  assert(suggestOwner({ origen: "WA", consulta: "Recibí mal el panel, está roto" }) === "MP", "roto → MP");
  assert(suggestOwner({ origen: "CL", consulta: "Reclamo por garantía del panel" }) === "MP", "garantía → MP");
});

group("WA cotizaciones: short → TIN, long → RA", () => {
  assert(suggestOwner({ origen: "WA", consulta: "Isodec 100mm / 4p de 6m / completo + flete" }) === "TIN", "WA short telegráfico → TIN");
  const longConsulta = "Hola, soy ingeniero y estoy diseñando un galpón industrial de 600 m². Necesitaría cotizar el sistema completo de cubierta más cerramiento vertical. Tengo planos preliminares y puedo enviarlos para evaluación. ¿Cuáles son los productos recomendados para esta aplicación?";
  assert(suggestOwner({ origen: "WA", consulta: longConsulta }) === "RA", "WA long prose → RA");
});

group("ML / EM → RA", () => {
  assert(suggestOwner({ origen: "ML", consulta: "Hola, panel de 50mm? Cuanto sale?" }) === "RA", "ML → RA");
  assert(suggestOwner({ origen: "EM", consulta: "Buen día. Quisiera cotizar paneles para mi obra." }) === "RA", "EM → RA");
});

group("Cliente físico / Local → TIN (showroom)", () => {
  assert(suggestOwner({ origen: "CL", consulta: "Pasé por el showroom y quiero comprar 8 paneles" }) === "TIN", "CL → TIN");
  assert(suggestOwner({ origen: "LO", consulta: "Soy de la zona, vendrías a ver?" }) === "TIN", "LO → TIN");
});

group("Llamada → MP (default until anyone confirms)", () => {
  assert(suggestOwner({ origen: "LL", consulta: "Necesito cotizar techo" }) === "MP", "LL → MP");
});

group("Residual channels FB / IG → MP", () => {
  assert(suggestOwner({ origen: "FB", consulta: "Vi su post" }) === "MP", "FB → MP");
  assert(suggestOwner({ origen: "IG", consulta: "DM por kit" }) === "MP", "IG → MP");
});

group("Unknown / missing origen → MP", () => {
  assert(suggestOwner({ origen: "", consulta: "loquesea" }) === "MP", "empty origen → MP");
  assert(suggestOwner({ origen: "XYZ", consulta: "loquesea" }) === "MP", "unknown code → MP");
  assert(suggestOwner({}) === "MP", "no args → MP");
  assert(suggestOwner() === "MP", "undefined arg → MP");
});

group("Always returns one of the known operator codes", () => {
  const cases = [
    { origen: "WA", consulta: "a" },
    { origen: "WA", consulta: "x".repeat(200) },
    { origen: "ML", consulta: "" },
    { origen: "EM", consulta: "factura" },
    { origen: "IG", consulta: "" },
    { origen: null, consulta: null },
  ];
  for (const c of cases) {
    const r = suggestOwner(c);
    assert(OPERATOR_CODES.includes(r), `case ${JSON.stringify(c)} → ${r} is a valid code`);
  }
});

group("operatorLabel maps codes to first names", () => {
  assert(operatorLabel("MP") === "Matías", "MP → Matías");
  assert(operatorLabel("RA") === "Ramiro", "RA → Ramiro");
  assert(operatorLabel("TIN") === "Martín", "TIN → Martín");
  assert(operatorLabel("SA") === "Sandra", "SA → Sandra");
  assert(operatorLabel("PANELIN") === "Panelin (AI)", "PANELIN → Panelin (AI)");
  assert(operatorLabel("mp") === "Matías", "lowercase mp → Matías");
  assert(operatorLabel("panelin") === "Panelin (AI)", "lowercase panelin → Panelin (AI)");
  assert(operatorLabel("UNKNOWN") === "UNKNOWN", "unknown code returns raw");
  assert(operatorLabel("") === "—", "empty → em dash");
  assert(operatorLabel(null) === "—", "null → em dash");
});

group("Case insensitive origen", () => {
  assert(suggestOwner({ origen: "wa", consulta: "panel corto" }) === "TIN", "lowercase wa accepted");
  assert(suggestOwner({ origen: " EM ", consulta: "cotizar" }) === "RA", "spaces trimmed");
});

group("OPERATOR_CODES integrity (mirrors planilla canon)", () => {
  const set = new Set(OPERATOR_CODES);
  assert(set.size === OPERATOR_CODES.length, "no duplicates in OPERATOR_CODES");
  assert(OPERATOR_CODES.every((c) => c === c.trim().toUpperCase()), "all codes trimmed UPPER");
  assert(OPERATOR_CODES.length === 5, "5 codes total (MP, RA, TIN, SA, PANELIN)");
  assert(OPERATOR_CODES.includes("PANELIN"), "PANELIN present for AI assignments");
  assert(!OPERATOR_CODES.includes("MA"), "legacy MA removed (planilla canon is MP)");
});

group("normalizeOperatorCode — server-side validator", () => {
  assert(normalizeOperatorCode("mp") === "MP", "lowercase mp → MP");
  assert(normalizeOperatorCode(" RA ") === "RA", "padded RA → RA");
  assert(normalizeOperatorCode("Panelin") === "PANELIN", "Title-case Panelin → PANELIN");
  assert(normalizeOperatorCode("SA") === "SA", "SA passthrough");
  assert(normalizeOperatorCode("FAKE") === null, "unknown rejected");
  assert(normalizeOperatorCode("") === null, "empty rejected");
  assert(normalizeOperatorCode(null) === null, "null rejected");
  assert(normalizeOperatorCode(undefined) === null, "undefined rejected");
});

group("Legacy MA → MP alias (backwards-compat for pre-reconcile rows)", () => {
  assert(normalizeOperatorCode("MA") === "MP", "legacy MA → MP (canonical)");
  assert(normalizeOperatorCode("ma") === "MP", "lowercase ma → MP");
  assert(normalizeOperatorCode(" MA ") === "MP", "padded MA → MP");
  assert(operatorLabel("MA") === "Matías", "legacy MA still renders as Matías in UI");
});

console.log(`\n${failed === 0 ? "✓" : "✗"} cotizacionAssignment: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
