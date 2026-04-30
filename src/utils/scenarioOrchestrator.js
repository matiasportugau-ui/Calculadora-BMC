// ═══════════════════════════════════════════════════════════════════════════
// src/utils/scenarioOrchestrator.js — Generic scenario calculation executor
//
// Replaces the if/else chain in PanelinCalculadoraV3.jsx.
// Adding a new scenario = add 1 entry to SCENARIOS_DEF (no changes here).
// ═══════════════════════════════════════════════════════════════════════════

import {
  calcTechoCompleto,
  calcParedCompleto,
  calcTotalesSinIVA,
  mergeZonaResults,
  perimetroVerticalInteriorPuntosDesdePlanta,
} from "./calculations.js";
import { buildEdgeBOM, encounterPairKey, getSharedSidesPerZona, layoutZonasLogico } from "./roofPlanGeometry.js";
import {
  encounterEsContinuo,
  encounterBorderPerfil,
  resolveNeighborSharedSide,
  listEncounterPairSegmentRuns,
} from "./roofEncounterModel.js";
import { getPricing } from "../data/pricing.js";

const EMPTY_BORDERS = { frente: "none", fondo: "none", latIzq: "none", latDer: "none" };

/**
 * Escenario techo+fachada (sin `encounterByPair`): anula perfilería solo en lados **enteros** compartidos con otra zona.
 * Solape parcial: se conserva el tipo de borde del usuario; `edgeML` en `calcPerfileriaTecho` acorta la longitud al tramo libre.
 *
 * @param {Record<string, string>} mergedBorders
 * @param {Map<string, { fullySide: boolean }>|undefined|null} sharedSideMapForGi - `getSharedSidesPerZona(...).get(gi)`
 */
export function effectiveBordersTechoFachada(mergedBorders, sharedSideMapForGi) {
  const m = mergedBorders && typeof mergedBorders === "object" ? mergedBorders : {};
  if (!sharedSideMapForGi || typeof sharedSideMapForGi.get !== "function" || sharedSideMapForGi.size === 0) {
    return { ...m };
  }
  return Object.fromEntries(
    Object.entries(m).map(([k, v]) => {
      const entry = sharedSideMapForGi.get(k);
      if (!entry) return [k, v];
      return [k, entry.fullySide ? "none" : v];
    }),
  );
}

/**
 * Perfiles en encuentros (geometría): una fila por tramo compartido, solo en la zona dueña `min(a,b)`.
 * @param {number} gi
 * @param {object[]} encounters
 * @param {object[]} zonas
 */
function junctionListForZonaGi(gi, encounters, zonas) {
  const out = [];
  for (const e of encounters || []) {
    const [a, b] = e.zoneIndices || [];
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (Math.min(a, b) !== gi) continue;
    const pk = encounterPairKey(a, b);
    const raw = zonas[gi]?.preview?.encounterByPair?.[pk];
    if (!raw) continue;
    const runs = listEncounterPairSegmentRuns(raw);
    for (const run of runs) {
      if (!run.includeInBom) continue;
      if (encounterEsContinuo(run.effectiveRaw)) continue;
      const perfil = encounterBorderPerfil(run.effectiveRaw);
      if (!perfil || perfil === "none") continue;
      const frac = Math.max(0, Math.min(1, run.t1) - Math.max(0, Math.min(1, run.t0)));
      const len = +(e.length * frac).toFixed(4);
      if (!(len > 0)) continue;
      out.push({
        perfil,
        lengthM: len,
        label: `Encuentro (${pk})[${run.id}]: ${perfil}`,
      });
    }
  }
  return out;
}

/**
 * Shared helper: compute techo zonas and merge results.
 *
 * @param {object} techo - Techo input state
 * @param {boolean} useEncounterBorders - true = solo_techo (respects encounter profiles),
 *                                        false = techo_fachada (blanks shared sides)
 */
function computeTechoZonas(techo, useEncounterBorders) {
  const is2Aguas = techo.tipoAguas === "dos_aguas";
  const sharedSidesMap = techo.inclAccesorios !== false
    ? getSharedSidesPerZona(techo.zonas, techo.tipoAguas)
    : new Map();

  const edgePack = Array.isArray(techo.zonas) && techo.zonas.length
    ? buildEdgeBOM(techo.zonas, techo.tipoAguas)
    : null;
  const layoutRects = edgePack?.rects ?? layoutZonasLogico(techo.zonas || [], techo.tipoAguas);

  const zonaResults = techo.zonas.flatMap((zona, gi) => {
    const inputs = {
      ...techo,
      largo: zona.largo,
      ancho: zona.ancho,
      pendiente: zona.pendiente ?? techo.pendiente ?? 0,
      pendienteModo: zona.pendienteModo ?? techo.pendienteModo ?? "incluye_pendiente",
      alturaDif: zona.alturaDif ?? techo.alturaDif ?? 0,
    };
    const globalBorders = techo.inclAccesorios === false ? EMPTY_BORDERS : techo.borders;
    const mergedBorders = { ...globalBorders, ...(zona.preview?.borders ?? {}) };
    const sharedSideMap = sharedSidesMap.get(gi);

    let effectiveBorders;
    if (useEncounterBorders) {
      // solo_techo: resolve borders using encounter profile data
      effectiveBorders = sharedSideMap?.size > 0
        ? Object.fromEntries(Object.entries(mergedBorders).map(([k, v]) => {
            if (!sharedSideMap.get(k)?.fullySide) return [k, v];
            const { neighborGi } = resolveNeighborSharedSide(gi, k, layoutRects);
            const pk = neighborGi != null ? encounterPairKey(gi, neighborGi) : null;
            const rawPair = pk != null ? techo.zonas[Math.min(gi, neighborGi)]?.preview?.encounterByPair?.[pk] : null;
            const enc = rawPair ?? zona.preview?.encounters?.[k];
            return [k, encounterEsContinuo(enc) ? "none" : encounterBorderPerfil(enc)];
          }))
        : mergedBorders;
    } else {
      effectiveBorders = effectiveBordersTechoFachada(mergedBorders, sharedSideMap);
    }

    const edgeML = edgePack?.mlByZona?.[gi]
      ? { ...edgePack.mlByZona[gi] }
      : undefined;
    const encounterJunctions = edgePack?.encounters?.length
      ? junctionListForZonaGi(gi, edgePack.encounters, techo.zonas)
      : [];
    const baseOpciones = inputs.opciones && typeof inputs.opciones === "object" ? inputs.opciones : {};
    const opcionesMerged = {
      ...baseOpciones,
      ...(edgeML ? { edgeML } : {}),
      ...(encounterJunctions.length ? { encounterJunctions } : {}),
    };

    const perimVertPts =
      !is2Aguas && Array.isArray(techo.zonas) && techo.zonas.length
        ? perimetroVerticalInteriorPuntosDesdePlanta(techo.zonas, techo.tipoAguas, gi)
        : undefined;

    if (is2Aguas) {
      const halfAncho = +(zona.ancho / 2).toFixed(2);
      // Dos faldones: repetimos el cálculo de paneles por mitad de ancho. La perfilería de encuentros
      // (cumbrera/pretil entre zonas) debe cargarse una sola vez para no duplicar líneas en el BOM.
      const opcionesHalf0 = { ...opcionesMerged };
      const opcionesHalf1 = {
        ...baseOpciones,
        ...(edgeML ? { edgeML } : {}),
      };
      return [
        calcTechoCompleto({
          ...inputs,
          ancho: halfAncho,
          borders: { ...effectiveBorders, fondo: "cumbrera" },
          opciones: opcionesHalf0,
        }),
        calcTechoCompleto({
          ...inputs,
          ancho: halfAncho,
          borders: {
            frente: effectiveBorders.fondo === "cumbrera" ? "cumbrera" : effectiveBorders.fondo,
            fondo: "none",
            latIzq: effectiveBorders.latIzq,
            latDer: effectiveBorders.latDer,
          },
          opciones: opcionesHalf1,
        }),
      ];
    }
    return [
      calcTechoCompleto({
        ...inputs,
        borders: effectiveBorders,
        opciones: opcionesMerged,
        ...(perimVertPts != null ? { perimetroVerticalInteriorPuntos: perimVertPts } : {}),
      }),
    ];
  });

  return mergeZonaResults(zonaResults);
}

/**
 * Execute a scenario calculation generically.
 *
 * Supports: solo_techo, solo_fachada, techo_fachada, camara_frig.
 * presupuesto_libre is handled separately by computePresupuestoLibreCatalogo.
 *
 * @param {string} scenarioId
 * @param {{ techo: object, pared: object, camara: object }} inputs
 * @returns {object|null}
 */
export function executeScenario(scenarioId, { techo, pared, camara }) {
  const { PANELS_TECHO } = getPricing();

  if (scenarioId === "solo_techo") {
    if (!techo.familia || !techo.espesor) return null;
    return computeTechoZonas(techo, true);
  }

  if (scenarioId === "solo_fachada") {
    if (!pared.familia || !pared.espesor) return null;
    return calcParedCompleto(pared);
  }

  if (scenarioId === "techo_fachada") {
    const rT = (techo.familia && techo.espesor) ? computeTechoZonas(techo, false) : null;
    const rP = (pared.familia && pared.espesor) ? calcParedCompleto(pared) : null;
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

  if (scenarioId === "camara_frig") {
    if (!pared.familia || !pared.espesor) return null;
    const perim = 2 * (camara.largo_int + camara.ancho_int);
    const rP = calcParedCompleto({ ...pared, perimetro: perim, alto: camara.alto_int, numEsqExt: 4, numEsqInt: 0 });
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
      familia: techoFam, espesor: techoEsp,
      largo: camara.largo_int, ancho: camara.ancho_int,
      tipoEst: "metal",
      borders: EMPTY_BORDERS,
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

  return null;
}
