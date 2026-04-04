// ═══════════════════════════════════════════════════════════════════════════
// roof3dLateralStepInfill.js — Relleno cosmético del escalón frente entre cuerpo
// raíz más largo y extensión lateral más corta (misma fila en planta).
// No altera cotas ni layout; solo tapa la cara visible en el 3D referencial.
// ═══════════════════════════════════════════════════════════════════════════

import {
  getLateralAnnexRootBodyGi,
  isLateralAnnexZona,
} from "./roofLateralAnnexLayout.js";

const EPS = 1e-3;

/**
 * @param {object} annexLayout - layout 3D del anexo
 * @param {object} rootLayout - layout 3D del cuerpo raíz (mismo chain)
 * @returns {"izq"|"der"}
 */
function inferLateralSide(annexLayout, rootLayout) {
  const side = annexLayout.z?.preview?.lateralSide;
  if (side === "izq" || side === "der") return side;
  const mid = rootLayout.ox + rootLayout.ancho / 2;
  const ax = annexLayout.ox + annexLayout.ancho / 2;
  return ax < mid ? "izq" : "der";
}

/**
 * @param {Array<{ z: object, gi: number, ox: number, oz: number, ancho: number, largo: number }>} zoneLayouts
 * @param {Array<{ largo: number, ancho: number, preview?: object }>} validZonas
 * @param {number} theta - rad, misma pendiente base que la escena (positiva)
 * @returns {Array<{ key: string, seamX: number, positions: Float32Array, indices: Uint16Array }>}
 */
export function buildLateralStepInfillGeometries(zoneLayouts, validZonas, theta) {
  if (!zoneLayouts?.length || !validZonas?.length) return [];
  const byGi = new Map(zoneLayouts.map((L) => [L.gi, L]));
  const out = [];

  for (const annex of zoneLayouts) {
    if (!isLateralAnnexZona(annex.z)) continue;
    const rootGi = getLateralAnnexRootBodyGi(validZonas, annex.gi);
    const root = byGi.get(rootGi);
    if (!root || root.gi === annex.gi) continue;
    if (!(root.largo > annex.largo + EPS)) continue;
    if (!(root.oz > annex.oz + EPS)) continue;

    const side = inferLateralSide(annex, root);
    const seamX = side === "der" ? root.ox + root.ancho : root.ox;

    const zA = annex.oz;
    const zR = root.oz;
    const invertRoot = root.slopeMark === "along_largo_neg";
    const tanEff = Math.tan(invertRoot ? -theta : theta);
    const yTop = (zR - zA) * tanEff;

    // Plano x = seamX: triángulo entre línea de cumbrera del cuerpo principal
    // (aprox. lineal en y–z con pendiente tan θ) y el tramo de canaletas y=0 entre frentes.
    // v0: eave anexo (frente corto), v1: eave raíz (frente largo), v2: techo raíz sobre zA
    const positions = new Float32Array([
      seamX,
      0,
      zA,
      seamX,
      0,
      zR,
      seamX,
      yTop,
      zA,
    ]);
    const indices = new Uint16Array([0, 1, 2]);
    out.push({
      key: `step-${annex.gi}-${rootGi}`,
      seamX,
      positions,
      indices,
    });
  }

  return out;
}
