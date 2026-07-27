/**
 * Wolfboard quote-batch calc — techo_fachada must not collapse to solo_techo.
 * Regression for Admin col J underquotes written by POST /quote-batch.
 */
import assert from "node:assert/strict";
import { runWolfboardBatchCalc } from "../server/routes/wolfboard.js";
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

// --- solo_techo unchanged ---
{
  const sa = runWolfboardBatchCalc({
    escenario: "solo_techo",
    techo: {
      familia: "ISODEC_EPS",
      espesor: 100,
      largo: 20,
      ancho: 10,
      tipoEst: "metal",
    },
  }, []);
  assert.ok(sa, "solo_techo calc");
  assert.equal(sa._escenario, "solo_techo");
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
  const wb = runWolfboardBatchCalc(extracted, []);
  assert.ok(wb, "techo_fachada calc");
  assert.equal(wb._escenario, "techo_fachada");

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
  assert.equal(totalFromResult(wb), combined.totalFinal, "techo_fachada total = techo+pared");
  assert.ok(
    totalFromResult(wb) > totalFromResult(techo),
    "techo_fachada must exceed solo techo (regression guard)",
  );
  // Missing pared → no invented fachada prices
  assert.equal(
    runWolfboardBatchCalc({
      escenario: "techo_fachada",
      techo: extracted.techo,
      pared: { alto: 0, perimetro: 0 },
    }, []),
    null,
  );
}

console.log("wolfboardBatchCalc.test.js: ok");
