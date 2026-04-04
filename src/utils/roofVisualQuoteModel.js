// ═══════════════════════════════════════════════════════════════════════════
// roofVisualQuoteModel.js — Contrato único “planta ↔ conteo paneles” (spike)
//
// Fuente de verdad numérica para **columnas en ancho de planta**:
// - Cálculo presupuesto (una corrida): `calcPanelesTecho` en calculations.js
// - Dos aguas: `scenarioOrchestrator.computeTechoZonas` corre **dos** veces con ancho/2
//
// Fuente visual 2D: `RoofPreview` usa `effAnchoPlanta` × `buildAnchoStripsPlanta` /
// `panelCountAcrossAnchoPlanta` (roofPlanGeometry + roofPanelStripsPlanta).
//
// Este módulo **no** duplica reglas de negocio: solo expone helpers alineados y
// funciones de verificación para tests / informes.
// ═══════════════════════════════════════════════════════════════════════════

import { effAnchoPlanta } from "./roofPlanGeometry.js";
import { buildAnchoStripsPlanta, panelCountAcrossAnchoPlanta } from "./roofPanelStripsPlanta.js";

/**
 * Ancho en planta (m) usado para dibujar una zona en 2D (misma convención que layout).
 * @param {number} zonaAnchoM — ancho declarado en UI (total techo en planta para esa zona)
 * @param {"una_agua"|"dos_aguas"|string} tipoAguas
 */
export function resolveZonaPlantaAnchoM(zonaAnchoM, tipoAguas) {
  const z = { ancho: Number(zonaAnchoM) || 0 };
  const is2A = tipoAguas === "dos_aguas";
  return effAnchoPlanta(z, is2A);
}

/**
 * Columnas de panel en el ancho `w` de planta (m), alineado a `panelCountAcrossAnchoPlanta`.
 */
export function resolvePanelColumnsPlanta(wM, auM) {
  return panelCountAcrossAnchoPlanta(wM, auM);
}

/**
 * Cantidad de paneles en ancho para **una** corrida `calcPanelesTecho` con ese ancho (sin espesor).
 * Equivale a `calcPanelesTecho(..., largo, ancho).cantPaneles` respecto al conteo en ancho.
 */
export function calcCantPanelesAnchoSingleRun(anchoM, auM) {
  if (!(auM > 0) || !(anchoM > 0)) return 0;
  return Math.ceil(anchoM / auM);
}

/**
 * Número de franjas que dibuja `buildAnchoStripsPlanta` (debe coincidir con columnas declaradas).
 */
export function stripCountForPlantaWidth(wM, auM) {
  return buildAnchoStripsPlanta(wM, auM).length;
}

/**
 * true si franjas visibles y conteo simbolico coinciden con una corrida de techo.
 */
export function visualAnchoAlignsWithSingleCalcRun(anchoPlantaM, auM) {
  if (!(auM > 0) || !(anchoPlantaM > 0)) return true;
  const cols = panelCountAcrossAnchoPlanta(anchoPlantaM, auM);
  const strips = stripCountForPlantaWidth(anchoPlantaM, auM);
  const calcN = calcCantPanelesAnchoSingleRun(anchoPlantaM, auM);
  return cols === strips && cols === calcN;
}

/**
 * Modelo mínimo por zona para consumo de UI/tests (sin React).
 * @param {{ largo: number, ancho: number }} zona
 * @param {"una_agua"|"dos_aguas"|string} tipoAguas
 * @param {number} auM
 */
export function resolveRoofZoneVisualModel(zona, tipoAguas, auM) {
  const largo = Number(zona?.largo) || 0;
  const ancho = Number(zona?.ancho) || 0;
  const wPlanta = resolveZonaPlantaAnchoM(ancho, tipoAguas);
  const columns = resolvePanelColumnsPlanta(wPlanta, auM);
  const strips = buildAnchoStripsPlanta(wPlanta, auM);
  const is2A = tipoAguas === "dos_aguas";
  return {
    largoM: largo,
    anchoDeclaradoM: ancho,
    anchoPlantaM: wPlanta,
    tipoAguas,
    auM,
    panelColumnsPlanta: columns,
    stripCount: strips.length,
    strips,
    /** Coincide con `calcPanelesTecho` para **una** corrida con `ancho = anchoPlantaM` */
    expectedCantPanelesSingleCalcRun: calcCantPanelesAnchoSingleRun(wPlanta, auM),
    /** Tras `mergeZonaResults`, una zona dos aguas suma dos corridas con mitad de ancho → 2× columnas en planta */
    expectedCantPanelesZonaMergedDosAguas: is2A ? columns * 2 : columns,
    visualAlignsSingleSlope: visualAnchoAlignsWithSingleCalcRun(wPlanta, auM),
  };
}
