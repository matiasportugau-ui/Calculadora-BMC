// ═══════════════════════════════════════════════════════════════════════════
// panelLayoutVerification.js — Verificación cruzada plano↔BOM.
// Compara buildPanelLayout (posiciones SVG) con calcPanelesTecho (cotización).
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verifica que el layout del plano 2D sea consistente con el resultado BOM.
 * Ambos deben usar countPanels internamente para que tenga sentido.
 *
 * @param {ReturnType<import('./panelLayout').buildPanelLayout>} layout
 * @param {{ cantPaneles: number, areaTotal: number|string, anchoTotal: number }} bomResult
 * @param {number} largo — largoReal usado en calcPanelesTecho
 */
export function verifyPanelLayout(layout, bomResult, largo) {
  if (!layout || !bomResult) {
    return { ok: false, error: 'missing layout or bomResult' };
  }
  const layoutArea = +(layout.totalPanels * layout.au * largo).toFixed(2);
  const bomArea = Number(bomResult.areaTotal);
  const bomCount = Number(bomResult.cantPaneles);
  const bomAnchoTotal = Number(bomResult.anchoTotal);

  const panelCountMatch = layout.totalPanels === bomCount;
  const areaMatch = Math.abs(layoutArea - bomArea) < 0.01;       // tolerancia: .toFixed(2) en BOM
  const anchoTotalMatch = Math.abs(layout.anchoTotal - bomAnchoTotal) < 1e-6;

  const ok = panelCountMatch && areaMatch && anchoTotalMatch;

  return {
    ok,
    panelCountMatch,
    areaMatch,
    anchoTotalMatch,
    layoutCount: layout.totalPanels,
    bomCount,
    layoutArea,
    bomArea,
    delta: {
      panels: layout.totalPanels - bomCount,
      area: +(layoutArea - bomArea).toFixed(4),
      anchoM: +(layout.anchoTotal - bomAnchoTotal).toFixed(6),
    },
  };
}
