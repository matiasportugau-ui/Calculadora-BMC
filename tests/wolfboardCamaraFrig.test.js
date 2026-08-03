/**
 * Wolfboard quote-batch camara_frig — ceiling must not drop when wall family
 * is used (ISOPANEL_EPS is not in PANELS_TECHO). Regression sibling of SuperAgent #814.
 */
import assert from "node:assert/strict";
import { runWolfboardBatchCalc } from "../server/routes/wolfboard.js";
import {
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

{
  const extracted = {
    escenario: "camara_frig",
    pared: { familia: "ISOPANEL_EPS", espesor: 150 },
    camara: { largo_int: 4, ancho_int: 6, alto_int: 3 },
  };
  const used = [];
  const wb = runWolfboardBatchCalc(extracted, used);
  assert.ok(wb, "camara_frig calc should return a result");
  assert.equal(wb._escenario, "camara_frig");
  assert.ok(wb.techoResult && !wb.techoResult.error, "ceiling must succeed");
  assert.ok(
    (wb.allItems || []).length > (wb.techoResult?.allItems || []).length,
    "BOM must include wall + techo items",
  );

  setListaPrecios("web");
  const orchestrated = executeScenario("camara_frig", {
    techo: {},
    pared: {
      familia: "ISOPANEL_EPS",
      espesor: 150,
      color: "Blanco",
      tipoEst: "metal",
      numEsqExt: 4,
      numEsqInt: 0,
      inclSell: true,
    },
    camara: { largo_int: 4, ancho_int: 6, alto_int: 3 },
  });
  assert.ok(orchestrated && !orchestrated.error, "orchestrator baseline");
  assert.equal(
    totalFromResult(wb),
    totalFromResult(orchestrated),
    "Wolfboard camara_frig total must match scenarioOrchestrator (wall+ceiling)",
  );

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
  assert.ok(totalFromResult(wb) > totalFromResult(wallOnly), "must not return wall-only underquote");
  assert.ok(
    Object.prototype.hasOwnProperty.call(
      PANELS_TECHO,
      wb.techoResult.panel?.familia || wb.techoResult?.familia || "ISODEC_EPS",
    ) || used.some((d) => /ISODEC/i.test(String(d))),
    "techo family must resolve via PANELS_TECHO / ISODEC fallback",
  );
}

{
  assert.equal(
    runWolfboardBatchCalc({
      escenario: "camara_frig",
      camara: { largo_int: 0, ancho_int: 0, alto_int: 0 },
    }, []),
    null,
    "missing camara dims → null",
  );
}

console.log("wolfboardCamaraFrig.test.js: ok");
