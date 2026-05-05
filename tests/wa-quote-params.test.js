// ═══════════════════════════════════════════════════════════════════════════
// WA Cockpit — F3 quote params extraction (offline)
// ═══════════════════════════════════════════════════════════════════════════

import { extractQuoteParams, paramsToCalcBody } from "../server/lib/waQuoteParams.js";

let passed = 0;
let failed = 0;

function assert(name, cond, actual, expected) {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name} — got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
    failed++;
  }
}

console.log("\n═══ WA Cockpit · F3 quote params ═══");

// ── extractQuoteParams ─────────────────────────────────────────────────
{
  const r = extractQuoteParams("Quería cotizar 200m² de ISODEC EPS espesor 100mm para techo blanco");
  assert("metros 200", r?.metros === 200, r?.metros, 200);
  assert("espesor 100", r?.espesor === 100, r?.espesor, 100);
  assert("familia isodec_eps", r?.familia === "isodec_eps", r?.familia, "isodec_eps");
  assert("scope techo", r?.scope === "techo", r?.scope, "techo");
  assert("color Blanco", r?.color === "Blanco", r?.color, "Blanco");
  assert("ready true", r?.ready === true, r?.ready, true);
}
{
  const r = extractQuoteParams("hola, cuánto sale?");
  assert("rejects bare question", r?.ready === false, r?.ready, false);
}
{
  const r = extractQuoteParams("ISOROOF 3G 80 mm para cubierta, color rojo");
  assert("missing m² ⇒ not ready", r?.ready === false, r?.ready, false);
}
{
  const r = extractQuoteParams("Necesito 350 m2 de ISOPANEL EPS 100mm para fachada");
  assert("scope pared (fachada)", r?.scope === "pared", r?.scope, "pared");
  assert("familia isopanel_eps", r?.familia === "isopanel_eps", r?.familia, "isopanel_eps");
  assert("metros 350", r?.metros === 350, r?.metros, 350);
}
{
  const r = extractQuoteParams("500m² ISODEC PIR 80mm techo lista venta");
  assert("lista venta detectada", r?.lista === "venta", r?.lista, "venta");
  assert("familia isodec_pir", r?.familia === "isodec_pir", r?.familia, "isodec_pir");
}

// ── paramsToCalcBody ───────────────────────────────────────────────────
{
  const params = extractQuoteParams("200m² ISODEC EPS 100mm techo");
  const body = paramsToCalcBody(params);
  assert("calc body escenario solo_techo", body?.escenario === "solo_techo", body?.escenario, "solo_techo");
  assert("calc body lista default web", body?.lista === "web", body?.lista, "web");
  assert("calc body techo familia", body?.techo?.familia === "isodec_eps", body?.techo?.familia, "isodec_eps");
  assert("calc body techo espesor", body?.techo?.espesor === 100, body?.techo?.espesor, 100);
  assert("calc body 1 zona", Array.isArray(body?.techo?.zonas) && body.techo.zonas.length === 1, body?.techo?.zonas?.length, 1);
}
{
  const params = extractQuoteParams("350m² ISOPANEL 100mm fachada");
  const body = paramsToCalcBody(params);
  assert("calc body escenario solo_fachada", body?.escenario === "solo_fachada", body?.escenario, "solo_fachada");
  assert("calc body pared.familia", body?.pared?.familia === "isopanel_eps", body?.pared?.familia, "isopanel_eps");
}
{
  const body = paramsToCalcBody(null);
  assert("paramsToCalcBody(null) returns null", body === null, body, null);
}
{
  const body = paramsToCalcBody({ ready: false });
  assert("not ready ⇒ null body", body === null, body, null);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(60)}`);
console.log(`RESULTADOS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"═".repeat(60)}\n`);

process.exit(failed > 0 ? 1 : 0);
