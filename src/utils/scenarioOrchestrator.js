// ═══════════════════════════════════════════════════════════════════════════
// src/utils/scenarioOrchestrator.js — Generic scenario execution engine
//
// Provides a data-driven scenario execution API intended to replace
// the hardcoded if/else chain in PanelinCalculadoraV3_backup.jsx.
// Current status: available and parity-tested, but not yet wired as
// the active runtime path in the main calculator component.
// ═══════════════════════════════════════════════════════════════════════════

import { calcTechoCompleto, calcParedCompleto, calcTotalesSinIVA, mergeZonaResults } from "./calculations.js";
import { getPricing } from "../data/pricing.js";

/**
 * Calculate roof zones with dos_aguas support.
 * Extracted from the duplicated logic that existed in both
 * solo_techo and techo_fachada branches.
 *
 * @param {Object} techo — techo state (familia, espesor, zonas[], borders, etc.)
 * @returns {Object|null} merged roof result or null if inputs incomplete
 */
export function calcTechoZonas(techo) {
  if (!techo.familia || !techo.espesor) return null;

  const is2Aguas = techo.tipoAguas === "dos_aguas";
  const emptyBorders = { frente: "none", fondo: "none", latIzq: "none", latDer: "none" };

  const zonaResults = techo.zonas.flatMap(zona => {
    const inputs = {
      ...techo,
      largo: zona.largo,
      ancho: zona.ancho,
      pendienteModo: techo.pendienteModo || "calcular_pendiente",
      alturaDif: zona.alturaDif ?? techo.alturaDif ?? 0,
    };
    const borders = techo.inclAccesorios === false ? emptyBorders : techo.borders;

    if (is2Aguas) {
      const halfAncho = +(zona.ancho / 2).toFixed(2);
      const agua1 = calcTechoCompleto({
        ...inputs,
        ancho: halfAncho,
        borders: { ...borders, fondo: "cumbrera" },
      });
      const agua2 = calcTechoCompleto({
        ...inputs,
        ancho: halfAncho,
        borders: {
          frente: borders.fondo === "cumbrera" ? "cumbrera" : borders.fondo,
          fondo: "none",
          latIzq: borders.latIzq,
          latDer: borders.latDer,
        },
      });
      return [agua1, agua2];
    }
    return [calcTechoCompleto({ ...inputs, borders })];
  });

  return mergeZonaResults(zonaResults);
}

/**
 * Calculate cold room (cámara frigorífica) — auto-derives roof from wall params.
 *
 * @param {Object} pared — pared state (familia, espesor, color, etc.)
 * @param {Object} camara — { largo_int, ancho_int, alto_int }
 * @returns {Object|null} combined result
 */
export function calcCamaraFrig(pared, camara) {
  if (!pared.familia || !pared.espesor) return null;

  const { PANELS_TECHO } = getPricing();
  const perim = 2 * (camara.largo_int + camara.ancho_int);
  const rP = calcParedCompleto({
    ...pared,
    perimetro: perim,
    alto: camara.alto_int,
    numEsqExt: 4,
    numEsqInt: 0,
  });

  const techoFam = pared.familia in PANELS_TECHO ? pared.familia : "ISODEC_EPS";
  const techoPanel = PANELS_TECHO[techoFam];
  const extraW = [];
  let techoEsp = pared.espesor;

  if (!techoPanel.esp[techoEsp]) {
    const available = Object.keys(techoPanel.esp).map(Number).sort((a, b) => a - b);
    techoEsp = available.find(e => e >= techoEsp) || available[available.length - 1];
    extraW.push(`Techo cámara: espesor ${pared.espesor}mm no disponible en ${techoFam}, se usó ${techoEsp}mm.`);
  }

  const rT = calcTechoCompleto({
    familia: techoFam,
    espesor: techoEsp,
    largo: camara.largo_int,
    ancho: camara.ancho_int,
    tipoEst: "metal",
    borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
    opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
    color: pared.color,
  });

  if (rT?.error) extraW.push(`Techo cámara: ${rT.error}`);
  const techoItems = rT?.error ? [] : (rT?.allItems || []);
  const allItems = [...(rP?.allItems || []), ...techoItems];
  const totales = calcTotalesSinIVA(allItems);

  return {
    ...rP,
    techoResult: rT?.error ? null : rT,
    allItems,
    totales,
    warnings: [...(rP?.warnings || []), ...(rT?.warnings || []), ...extraW],
  };
}

/**
 * Execute a scenario calculation based on scenario ID.
 *
 * This is the single entry point for data-driven scenario execution.
 * It is ready for integration into the component's useMemo path.
 *
 * @param {string} scenarioId — one of: solo_techo, solo_fachada, techo_fachada, camara_frig
 * @param {Object} inputs — { techo, pared, camara }
 * @returns {Object|null} calculation result with allItems, totales, warnings
 */
export function executeScenario(scenarioId, { techo, pared, camara }) {
  switch (scenarioId) {
    case "solo_techo":
      return calcTechoZonas(techo);

    case "solo_fachada":
      if (!pared.familia || !pared.espesor) return null;
      return calcParedCompleto(pared);

    case "techo_fachada": {
      const rT = calcTechoZonas(techo);
      const rP = pared.familia && pared.espesor ? calcParedCompleto(pared) : null;
      if (!rT && !rP) return null;
      const allItems = [...(rT?.allItems || []), ...(rP?.allItems || [])];
      const totales = calcTotalesSinIVA(allItems);
      return {
        ...rT,
        paredResult: rP,
        allItems,
        totales,
        warnings: [...(rT?.warnings || []), ...(rP?.warnings || [])],
      };
    }

    case "camara_frig":
      return calcCamaraFrig(pared, camara);

    default:
      return null;
  }
}
