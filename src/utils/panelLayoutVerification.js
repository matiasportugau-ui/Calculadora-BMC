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

/**
 * Agrega resultados de verificación por zona para mostrar un estado global en multi-zona.
 *
 * @param {Record<number, ReturnType<verifyPanelLayout>>|null} verificationsByGi
 * @param {number} [expectedZones=0]
 */
export function aggregatePanelLayoutVerifications(verificationsByGi, expectedZones = 0) {
  const entries = Object.values(verificationsByGi || {});
  const known = entries.filter(Boolean);
  const total = Math.max(Number(expectedZones) || 0, known.length);
  const ok = known.filter((v) => v?.ok === true).length;
  const failed = known.filter((v) => v?.ok === false).length;
  const pending = Math.max(0, total - ok - failed);
  const allOk = total > 0 && failed === 0 && pending === 0;
  const hasFailures = failed > 0;
  return { total, ok, failed, pending, allOk, hasFailures };
}
