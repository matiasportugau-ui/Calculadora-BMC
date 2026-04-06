// ═══════════════════════════════════════════════════════════════════════════
// roofPanelStripsPlanta.js — Franjas de panel en el ancho en planta (m)
// Misma regla que RoofPreview (PanelRoofVisualization) y calcPanelesTecho / au.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Canonical panel count across a given width.
 * Used by both calcPanelesTecho (BOM) and buildPanelLayout (plano) to guarantee consistency.
 * The 1e-9 epsilon prevents IEEE-754 rounding from adding a spurious extra panel
 * on exact multiples (e.g. 3.36 / 1.12 = 3.0000000000000004 without epsilon).
 */
export function countPanels(ancho, au) {
  if (!(au > 0) || !(ancho > 0)) return 0;
  return Math.max(1, Math.ceil(ancho / au - 1e-9));
}

/**
 * Cantidad de paneles en ancho de planta (≈ ceil(w/au)), alineada a `calcPanelesTecho`.
 * @param {number} w
 * @param {number} au
 */
export function panelCountAcrossAnchoPlanta(w, au) {
  return countPanels(w, au);
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
