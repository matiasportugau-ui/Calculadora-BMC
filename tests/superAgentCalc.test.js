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
import { setListaPrecios } from "../src/data/constants.js";

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

// --- techo_fachada must include BOTH techo + pared (not collapse to solo_techo) ---
{
  const extracted = {
    escenario: "techo_fachada",
    techo: {
      familia: "ISODEC_EPS",
      espesor: 100,
      largo: 20,
      ancho: 10,
      tipoEst: "metal",
    },
    pared: {
      familia: "ISOPANEL_EPS",
      espesor: 100,
      alto: 3,
      perimetro: 40,
    },
  };
  const sa = runSuperAgentCalc(extracted, []);
  assert.ok(sa, "techo_fachada calc");
  assert.equal(sa._escenario, "techo_fachada");

  setListaPrecios("web");
  const techo = calcTechoCompleto({
    familia: "ISODEC_EPS",
    espesor: 100,
    color: "Blanco",
    tipoEst: "metal",
    largo: 20,
    ancho: 10,
    borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
    opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
  });
  const pared = calcParedCompleto({
    familia: "ISOPANEL_EPS",
    espesor: 100,
    alto: 3,
    perimetro: 40,
    tipoEst: "metal",
    numEsqExt: 4,
    numEsqInt: 0,
    inclSell: true,
  });
  const combined = calcTotalesSinIVA([...(techo.allItems || []), ...(pared.allItems || [])]);
  assert.equal(totalFromResult(sa), combined.totalFinal, "techo_fachada total = techo+pared");
  assert.ok(
    totalFromResult(sa) > totalFromResult(techo),
    "techo_fachada must exceed solo techo (regression guard)",
  );
  // Missing pared → no invented fachada prices
  assert.equal(
    runSuperAgentCalc({
      escenario: "techo_fachada",
      techo: extracted.techo,
      pared: { alto: 0, perimetro: 0 },
    }, []),
    null,
  );
}

// --- missing dimensions → null (no invented prices) ---
{
  assert.equal(
    runSuperAgentCalc({ escenario: "solo_techo", techo: { largo: 0, ancho: 0 } }, []),
    null,
  );
  assert.equal(runSuperAgentCalc({ escenario: null }, []), null);
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
