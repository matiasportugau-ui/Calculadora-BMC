// ═══════════════════════════════════════════════════════════════════════════
// roofPanelStripsPlanta.js — Franjas de panel en el ancho en planta (m)
// Misma regla que RoofPreview (PanelRoofVisualization) y calcPanelesTecho / au.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cantidad de paneles en ancho de planta (≈ ceil(w/au)), alineada a `calcPanelesTecho`.
 * @param {number} w
 * @param {number} au
 */
export function panelCountAcrossAnchoPlanta(w, au) {
  if (!(au > 0) || !(w > 0)) return 0;
  return Math.max(1, Math.ceil(w / au - 1e-9));
}

/**
 * Descompone el ancho en planta en franjas de ancho útil `au` (la última puede ser parcial).
 * @param {number} anchoM
 * @param {number} auM
 * @returns {Array<{ x0: number; width: number; idx: number }>}
 */
export function buildAnchoStripsPlanta(anchoM, auM) {
  const strips = [];
  if (!(auM > 0) || !(anchoM > 0)) return strips;
  let x = 0;
  let idx = 0;
  while (x < anchoM - 1e-9) {
    const width = Math.min(auM, anchoM - x);
    strips.push({ x0: x, width, idx });
    x += width;
    idx += 1;
  }
  return strips;
}
