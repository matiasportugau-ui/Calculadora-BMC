/**
 * Contract tests for src/utils/cotizacionAssignment.js
 * Run: node tests/cotizacionAssignment.test.js
 */

import {
  suggestOwner,
  operatorLabel,
  OPERATOR_CODES,
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

group("Soporte / post-venta keywords → MA", () => {
  assert(suggestOwner({ origen: "WA", consulta: "Tengo una queja con el último envío" }) === "MA", "queja → MA");
  assert(suggestOwner({ origen: "EM", consulta: "Quiero hacer una devolución de los goteros" }) === "MA", "devolución → MA");
  assert(suggestOwner({ origen: "WA", consulta: "Recibí mal el panel, está roto" }) === "MA", "roto → MA");
  assert(suggestOwner({ origen: "CL", consulta: "Reclamo por garantía del panel" }) === "MA", "garantía → MA");
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

group("Llamada → MA (default until anyone confirms)", () => {
  assert(suggestOwner({ origen: "LL", consulta: "Necesito cotizar techo" }) === "MA", "LL → MA");
});

group("Residual channels FB / IG → MA", () => {
  assert(suggestOwner({ origen: "FB", consulta: "Vi su post" }) === "MA", "FB → MA");
  assert(suggestOwner({ origen: "IG", consulta: "DM por kit" }) === "MA", "IG → MA");
});

group("Unknown / missing origen → MA", () => {
  assert(suggestOwner({ origen: "", consulta: "loquesea" }) === "MA", "empty origen → MA");
  assert(suggestOwner({ origen: "XYZ", consulta: "loquesea" }) === "MA", "unknown code → MA");
  assert(suggestOwner({}) === "MA", "no args → MA");
  assert(suggestOwner() === "MA", "undefined arg → MA");
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
  assert(operatorLabel("MA") === "Matías", "MA → Matías");
  assert(operatorLabel("RA") === "Ramiro", "RA → Ramiro");
  assert(operatorLabel("TIN") === "Martín", "TIN → Martín");
  assert(operatorLabel("SA") === "Sandra", "SA → Sandra");
  assert(operatorLabel("ma") === "Matías", "lowercase normalized → Matías");
  assert(operatorLabel("UNKNOWN") === "UNKNOWN", "unknown code returns raw");
  assert(operatorLabel("") === "—", "empty → em dash");
  assert(operatorLabel(null) === "—", "null → em dash");
});

group("Case insensitive origen", () => {
  assert(suggestOwner({ origen: "wa", consulta: "panel corto" }) === "TIN", "lowercase wa accepted");
  assert(suggestOwner({ origen: " EM ", consulta: "cotizar" }) === "RA", "spaces trimmed");
});

console.log(`\n${failed === 0 ? "✓" : "✗"} cotizacionAssignment: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
