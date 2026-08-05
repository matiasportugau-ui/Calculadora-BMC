/**
 * Calc engine LISTA_ACTIVA isolation + camara_frig ceiling mapping.
 *
 * Locks money-risk regressions on the shared `runCalculation` path used by
 * /calc/cotizar and agent loopback:
 *   - consecutive web/venta quotes price independently (global lista reset)
 *   - camara_frig with wall family ISOPANEL_EPS still includes a techo BOM
 *     (sibling of SuperAgent #814 / scenarioOrchestrator mapping)
 *
 * Run: node --test tests/calcListaActivaIsolation.test.js
 */

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { runCalculation } from "../server/routes/calc.js";
import { LISTA_ACTIVA, setListaPrecios, PANELS_TECHO } from "../src/data/constants.js";
import { calcParedCompleto, calcTotalesSinIVA } from "../src/utils/calculations.js";

const TECHO_BASE = {
  familia: "ISODEC_EPS",
  espesor: 100,
  largo: 12,
  ancho: 8,
  tipoEst: "metal",
  borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
  opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
  color: "Blanco",
};

function totalOf(result) {
  if (!result || result.error) return null;
  return result.totales?.totalFinal ?? calcTotalesSinIVA(result.allItems || []).totalFinal;
}

beforeEach(() => {
  setListaPrecios("web");
});

describe("runCalculation — listaPrecios isolation", () => {
  it("venta and web produce different totals for the same geometry", () => {
    const web = runCalculation({ escenario: "solo_techo", lista: "web", techo: TECHO_BASE });
    const venta = runCalculation({ escenario: "solo_techo", lista: "venta", techo: TECHO_BASE });
    assert.equal(web.error, undefined);
    assert.equal(venta.error, undefined);
    assert.notEqual(totalOf(web), totalOf(venta), "web vs venta must diverge on list prices");
  });

  it("a venta quote does not poison the next web quote", () => {
    const web1 = runCalculation({ escenario: "solo_techo", lista: "web", techo: TECHO_BASE });
    runCalculation({ escenario: "solo_techo", lista: "venta", techo: TECHO_BASE });
    const web2 = runCalculation({ escenario: "solo_techo", lista: "web", techo: TECHO_BASE });
    assert.equal(totalOf(web1), totalOf(web2), "each call must re-apply lista at entry");
    assert.equal(LISTA_ACTIVA, "web");
  });
});

describe("runCalculation — camara_frig ceiling mapping", () => {
  it("wall family ISOPANEL_EPS still yields wall + techo items (not wall-only)", () => {
    setListaPrecios("web");
    const result = runCalculation({
      escenario: "camara_frig",
      lista: "web",
      pared: { familia: "ISOPANEL_EPS", espesor: 150, color: "Blanco", tipoEst: "metal" },
      camara: { largo_int: 4, ancho_int: 6, alto_int: 3 },
    });
    assert.equal(result.error, undefined, "camara_frig must succeed");
    assert.ok(result.techoResult && !result.techoResult.error, "ceiling must be priced");
    assert.ok(
      (result.allItems || []).length > (result.techoResult?.allItems || []).length,
      "BOM must include wall + techo lines",
    );

    const wallOnly = calcParedCompleto({
      familia: "ISOPANEL_EPS",
      espesor: 150,
      perimetro: 2 * (4 + 6),
      alto: 3,
      tipoEst: "metal",
      numEsqExt: 4,
      numEsqInt: 0,
      inclSell: true,
    });
    assert.ok(totalOf(result) > totalOf(wallOnly), "must not return wall-only underquote");

    const techoFam = result.techoResult?.panel?.familia || result.techoResult?.familia || "ISODEC_EPS";
    assert.ok(
      Object.prototype.hasOwnProperty.call(PANELS_TECHO, techoFam) || techoFam === "ISODEC_EPS",
      "techo family must resolve via PANELS_TECHO / ISODEC fallback",
    );
  });

  it("rejects incomplete camara dims", () => {
    const result = runCalculation({
      escenario: "camara_frig",
      lista: "web",
      pared: { familia: "ISOPANEL_EPS", espesor: 150 },
      camara: { largo_int: 0, ancho_int: 0, alto_int: 0 },
    });
    assert.ok(result.error, "missing dims → error");
    assert.match(String(result.error), /camara/i);
  });
});
