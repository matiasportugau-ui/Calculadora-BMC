// ═══════════════════════════════════════════════════════════════════════════
// src/utils/scenarioCalc.js — Shared scenario orchestration logic
// Used by both api/cotizar.js and server/routes/calc.js
// ═══════════════════════════════════════════════════════════════════════════

import {
  calcTechoCompleto,
  calcParedCompleto,
  calcTotalesSinIVA,
} from "./calculations.js";
import { PANELS_TECHO } from "../data/constants.js";

const VALID_SCENARIOS = ["solo_techo", "solo_fachada", "techo_fachada", "camara_frig"];

/**
 * Execute a scenario calculation given input parameters.
 * Returns { results, error } where error is a string if validation fails.
 */
export function executeScenario({ scenario, techo = {}, pared = {}, camara = {} }) {
  if (!VALID_SCENARIOS.includes(scenario)) {
    return { error: `Invalid scenario '${scenario}'. Must be one of: ${VALID_SCENARIOS.join(", ")}` };
  }

  if (scenario === "solo_techo") {
    if (!techo.familia || !techo.espesor) {
      return { error: "Techo: falta familia o espesor" };
    }
    return { results: calcTechoCompleto(techo) };
  }

  if (scenario === "solo_fachada") {
    if (!pared.familia || !pared.espesor) {
      return { error: "Pared: falta familia o espesor" };
    }
    return { results: calcParedCompleto(pared) };
  }

  if (scenario === "techo_fachada") {
    const rT = techo.familia && techo.espesor ? calcTechoCompleto(techo) : null;
    const rP = pared.familia && pared.espesor ? calcParedCompleto(pared) : null;
    if (!rT && !rP) {
      return { error: "Techo y/o Pared: faltan datos" };
    }
    const allItems = [...(rT?.allItems || []), ...(rP?.allItems || [])];
    const totales = calcTotalesSinIVA(allItems);
    return {
      results: {
        ...rT,
        paredResult: rP,
        allItems,
        totales,
        warnings: [...(rT?.warnings || []), ...(rP?.warnings || [])],
      },
    };
  }

  if (scenario === "camara_frig") {
    if (!pared.familia || !pared.espesor) {
      return { error: "Pared: falta familia o espesor" };
    }
    const perim = 2 * ((camara.largo_int || 0) + (camara.ancho_int || 0));
    const rP = calcParedCompleto({
      ...pared,
      perimetro: perim,
      alto: camara.alto_int || pared.alto,
    });
    const techoFam = pared.familia in PANELS_TECHO ? pared.familia : "ISODEC_EPS";
    const techoPanel = PANELS_TECHO[techoFam];
    const extraW = [];
    let techoEsp = pared.espesor;
    if (!techoPanel?.esp?.[techoEsp]) {
      const available = Object.keys(techoPanel?.esp || {}).map(Number).sort((a, b) => a - b);
      techoEsp = available.find(e => e >= techoEsp) || available[available.length - 1];
      if (techoEsp) extraW.push(`Techo cámara: espesor ${pared.espesor}mm no disponible en ${techoFam}, se usó ${techoEsp}mm.`);
    }
    const rT = calcTechoCompleto({
      familia: techoFam,
      espesor: techoEsp,
      largo: camara.largo_int || 0,
      ancho: camara.ancho_int || 0,
      tipoEst: "metal",
      borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
      opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
      color: pared.color || "Blanco",
    });
    if (rT?.error) extraW.push(`Techo cámara: ${rT.error}`);
    const techoItems = rT?.error ? [] : (rT?.allItems || []);
    const allItems = [...(rP?.allItems || []), ...techoItems];
    const totales = calcTotalesSinIVA(allItems);
    return {
      results: {
        ...rP,
        techoResult: rT?.error ? null : rT,
        allItems,
        totales,
        warnings: [...(rP?.warnings || []), ...(rT?.warnings || []), ...extraW],
      },
    };
  }

  return { error: "Escenario no reconocido" };
}
