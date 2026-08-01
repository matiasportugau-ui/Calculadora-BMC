/**
 * IMP-07 — SuperAgent calc parity + costTelemetry wiring (offline).
 * Numbers must match the shared calc engine (calcTechoCompleto / calcParedCompleto).
 */
import assert from "node:assert/strict";
import {
  runSuperAgentCalc,
  logSuperAgentCost,
} from "../server/routes/superAgent.js";
import {
  calcTechoCompleto,
  calcParedCompleto,
  calcTotalesSinIVA,
} from "../src/utils/calculations.js";
import { setListaPrecios, PANELS_TECHO } from "../src/data/constants.js";
import { executeScenario } from "../src/utils/scenarioOrchestrator.js";

function totalFromResult(r) {
  if (!r) return null;
  const totales = r.totales || calcTotalesSinIVA(r.allItems || []);
  return totales.totalFinal;
}

// --- solo_techo parity ---
{
  const extracted = {
    escenario: "solo_techo",
    techo: {
      familia: "ISODEC_EPS",
      espesor: 100,
      largo: 20,
      ancho: 10,
      tipoEst: "metal",
    },
  };
  const used = [];
  const sa = runSuperAgentCalc(extracted, used);
  assert.ok(sa, "superAgent calc should return a result");
  assert.equal(sa._escenario, "solo_techo");

  setListaPrecios("web");
  const direct = calcTechoCompleto({
    familia: "ISODEC_EPS",
    espesor: 100,
    color: "Blanco",
    tipoEst: "metal",
    largo: 20,
    ancho: 10,
    borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
    opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
  });
  assert.ok(direct && !direct.error, "direct calc should succeed");
  assert.equal(
    totalFromResult(sa),
    totalFromResult(direct),
    "SuperAgent total_usd must match calcTechoCompleto (same engine)",
  );
}

// --- solo_fachada parity ---
{
  const extracted = {
    escenario: "solo_fachada",
    pared: {
      familia: "ISOPANEL_EPS",
      espesor: 100,
      alto: 3,
      perimetro: 40,
    },
  };
  const sa = runSuperAgentCalc(extracted, []);
  assert.ok(sa, "fachada calc");
  setListaPrecios("web");
  const direct = calcParedCompleto({
    familia: "ISOPANEL_EPS",
    espesor: 100,
    alto: 3,
    perimetro: 40,
    tipoEst: "metal",
    numEsqExt: 4,
    numEsqInt: 0,
    inclSell: true,
  });
  assert.equal(totalFromResult(sa), totalFromResult(direct), "fachada parity");
}

// --- camara_frig: wall family must not underquote by dropping the ceiling ---
{
  const extracted = {
    escenario: "camara_frig",
    pared: { familia: "ISOPANEL_EPS", espesor: 150 },
    camara: { largo_int: 4, ancho_int: 6, alto_int: 3 },
  };
  const used = [];
  const sa = runSuperAgentCalc(extracted, used);
  assert.ok(sa, "camara_frig calc should return a result");
  assert.equal(sa._escenario, "camara_frig");
  assert.ok(sa.techoResult && !sa.techoResult.error, "ceiling must succeed");
  assert.ok(
    (sa.allItems || []).length > (sa.techoResult?.allItems || []).length,
    "BOM must include wall + techo items",
  );

  setListaPrecios("web");
  const orchestrated = executeScenario("camara_frig", {
    techo: {},
    pared: { familia: "ISOPANEL_EPS", espesor: 150, color: "Blanco", tipoEst: "metal", numEsqExt: 4, numEsqInt: 0, inclSell: true },
    camara: { largo_int: 4, ancho_int: 6, alto_int: 3 },
  });
  assert.ok(orchestrated && !orchestrated.error, "orchestrator baseline");
  assert.equal(
    totalFromResult(sa),
    totalFromResult(orchestrated),
    "SuperAgent camara_frig total must match scenarioOrchestrator (wall+ceiling)",
  );
  assert.ok(
    totalFromResult(sa) > (sa.totales?.totalFinal ? 0 : -1),
    "sanity",
  );
  // Wall-only total would be ~5569; combined must be higher once ceiling is priced.
  const perim = 2 * (4 + 6);
  const wallOnly = calcParedCompleto({
    familia: "ISOPANEL_EPS",
    espesor: 150,
    perimetro: perim,
    alto: 3,
    tipoEst: "metal",
    numEsqExt: 4,
    numEsqInt: 0,
    inclSell: true,
  });
  assert.ok(totalFromResult(sa) > totalFromResult(wallOnly), "must not return wall-only underquote");
  assert.ok(
    Object.prototype.hasOwnProperty.call(PANELS_TECHO, sa.techoResult.panel?.familia || sa.techoResult?.familia || "ISODEC_EPS")
      || used.some((d) => /ISODEC/i.test(String(d))),
    "techo family must resolve via PANELS_TECHO / ISODEC fallback",
  );
}

// --- missing dimensions → null (no invented prices) ---
{
  assert.equal(
    runSuperAgentCalc({ escenario: "solo_techo", techo: { largo: 0, ancho: 0 } }, []),
    null,
  );
  assert.equal(runSuperAgentCalc({ escenario: null }, []), null);
  assert.equal(
    runSuperAgentCalc({
      escenario: "camara_frig",
      pared: { familia: "ISOPANEL_EPS", espesor: 150 },
      camara: { largo_int: 0, ancho_int: 0, alto_int: 0 },
    }, []),
    null,
  );
}

// --- cost telemetry wiring ---
{
  const logs = [];
  const fakeLogger = {
    info(obj, msg) {
      logs.push({ obj, msg });
    },
  };
  const usage = { input_tokens: 120, output_tokens: 40 };
  const ev = logSuperAgentCost(usage, { call: "extract" }, fakeLogger);
  assert.equal(ev.event, "superagent_ai_call");
  assert.equal(ev.provider, "claude");
  assert.equal(ev.source, "superAgent");
  assert.equal(ev.channel, "superagent");
  assert.equal(ev.task_key, "superagent:extract");
  assert.equal(ev.input_tokens, 120);
  assert.equal(ev.output_tokens, 40);
  assert.ok(typeof ev.estimated_cost_usd === "number" || ev.estimated_cost_usd === null);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].obj.event, "superagent_ai_call");
}

console.log("superAgentCalc.test.js: ok");
