/**
 * Contract tests for server/lib/verifiedQuotePayload.js
 * Run: node tests/verifiedQuotePayload.test.js
 */

import { buildVerifiedQuotePayload, ELIGIBLE_TOOLS } from "../server/lib/verifiedQuotePayload.js";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed += 1; }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}
function group(name, fn) { console.log(`\n— ${name}`); fn(); }

const SAMPLE_CALC = {
  scenario: "solo_techo",
  listaPrecios: "web",
  subtotalSinIVA: 6840.5,
  totalConIVA: 8345.41,
  iva22: 1504.91,
  area_m2: 142.8,
  cant_paneles: 18,
  autoportancia: { ok: true, vano: 4.5 },
  warnings: [],
};

const SAMPLE_COMPARAR_LISTAS = {
  ok: true,
  scenario: "solo_techo",
  web:   { subtotalSinIVA: 6840.5, totalConIVA: 8345.41 },
  venta: { subtotalSinIVA: 5800.0, totalConIVA: 7076.0 },
  delta_usd: 1269.41,
  delta_pct: 15.21,
  ahorro_lista_venta_usd: 1269.41,
  nota: "Lista venta es USD 1269.41 (15.21%) más barata que web.",
};

const SAMPLE_COMPARAR_ESCENARIOS = {
  ok: true,
  listaPrecios: "web",
  a: { scenario: "solo_techo",  subtotalSinIVA: 6840.5,  totalConIVA: 8345.41 },
  b: { scenario: "solo_fachada", subtotalSinIVA: 4200.0,  totalConIVA: 5124.0 },
  delta_usd: -3221.41,
  delta_pct: -38.6,
  nota: "...",
};

group("Eligible tools list is exact", () => {
  assert(ELIGIBLE_TOOLS.size === 3, "exactly 3 eligible tools");
  assert(ELIGIBLE_TOOLS.has("calcular_cotizacion"), "calcular_cotizacion eligible");
  assert(ELIGIBLE_TOOLS.has("comparar_listas"), "comparar_listas eligible");
  assert(ELIGIBLE_TOOLS.has("comparar_escenarios"), "comparar_escenarios eligible");
});

group("Returns null for ineligible tools", () => {
  assert(buildVerifiedQuotePayload("guardar_en_crm", SAMPLE_CALC) === null, "guardar_en_crm rejected");
  assert(buildVerifiedQuotePayload("aplicar_estado_calc", SAMPLE_CALC) === null, "aplicar_estado_calc rejected");
  assert(buildVerifiedQuotePayload("listar_paneles", SAMPLE_CALC) === null, "listar_paneles rejected");
});

group("Returns null on error results", () => {
  assert(buildVerifiedQuotePayload("calcular_cotizacion", { error: "boom" }) === null, "error key → null");
  assert(buildVerifiedQuotePayload("calcular_cotizacion", null) === null, "null parsed → null");
  assert(buildVerifiedQuotePayload("comparar_listas", { ok: false, error: "x" }) === null, "ok:false → null");
});

group("calcular_cotizacion → kind: single", () => {
  const p = buildVerifiedQuotePayload("calcular_cotizacion", SAMPLE_CALC);
  assert(p !== null, "non-null payload");
  assert(p.kind === "single", `kind === single, got ${p.kind}`);
  assert(p.lista === "web", "lista web");
  assert(p.total_con_iva === 8345.41, "total_con_iva 8345.41");
  assert(p.subtotal_sin_iva === 6840.5, "subtotal 6840.5");
  assert(p.iva_pct === 22, "iva_pct 22 (default)");
  assert(p.area_m2 === 142.8, "area 142.8");
  assert(p.cant_paneles === 18, "cant 18");
  assert(p.scenario === "solo_techo", "scenario solo_techo");
});

group("comparar_listas → kind: comparar_listas", () => {
  const p = buildVerifiedQuotePayload("comparar_listas", SAMPLE_COMPARAR_LISTAS);
  assert(p !== null, "non-null payload");
  assert(p.kind === "comparar_listas", "kind comparar_listas");
  assert(p.web.total_con_iva === 8345.41, "web total");
  assert(p.venta.total_con_iva === 7076.0, "venta total");
  assert(p.delta_usd === 1269.41, "delta_usd");
  assert(p.delta_pct === 15.21, "delta_pct");
});

group("comparar_escenarios → kind: comparar_escenarios", () => {
  const p = buildVerifiedQuotePayload("comparar_escenarios", SAMPLE_COMPARAR_ESCENARIOS);
  assert(p !== null, "non-null payload");
  assert(p.kind === "comparar_escenarios", "kind comparar_escenarios");
  assert(p.a.scenario === "solo_techo", "a.scenario");
  assert(p.b.scenario === "solo_fachada", "b.scenario");
  assert(p.a.total_con_iva === 8345.41, "a total");
  assert(p.b.total_con_iva === 5124.0, "b total");
  assert(p.delta_usd === -3221.41, "delta negative");
  assert(p.lista === "web", "lista web (from listaPrecios)");
});

group("ivaPct override is honored", () => {
  const p = buildVerifiedQuotePayload("calcular_cotizacion", SAMPLE_CALC, { ivaPct: 21 });
  assert(p.iva_pct === 21, "uses opts.ivaPct");
});

group("Defensive against malformed shapes", () => {
  assert(buildVerifiedQuotePayload("calcular_cotizacion", { listaPrecios: "web" }) === null, "missing totals → null");
  assert(buildVerifiedQuotePayload("comparar_listas", { ok: true, web: {}, venta: {} }) === null, "comparar_listas no totals → null");
  assert(buildVerifiedQuotePayload("comparar_escenarios", { ok: true }) === null, "comparar_escenarios no a/b → null");
});

console.log(`\n${failed === 0 ? "✓" : "✗"} verifiedQuotePayload: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
