// ═══════════════════════════════════════════════════════════════════════════
// roofPrincipalZona.js — Techo principal (referencia presupuesto) y utilidades de
// layout en planta (`previewPositionForTramoApiladoFrente` sigue disponible para
// datos/proyectos que ya traigan preview apilado; la UI ya no ofrece “tramo abajo”).
// Ver docs/team/ux-feedback/ROOF-ZONAS-PRINCIPAL-Y-ENCUENTROS-TAXONOMY.md
// ═══════════════════════════════════════════════════════════════════════════

import { layoutZonasEnPlanta, ROOF_PLAN_GAP_M } from "./roofPlanGeometry.js";

/**
 * Índice de zona con mayor área en planta (largo × ancho declarados).
 * @param {Array<{ largo?: number, ancho?: number }>} zonas
 * @returns {number}
 */
export function defaultPrincipalZonaIndex(zonas = []) {
  if (!zonas.length) return 0;
  let best = 0;
  let bestA = -1;
  zonas.forEach((z, i) => {
    const L = Number(z?.largo) || 0;
    const W = Number(z?.ancho) || 0;
    const a = L * W;
    if (a > bestA) {
      bestA = a;
      best = i;
    }
  });
  return best;
}

/**
 * Posición `preview` para una nueva zona apilada **debajo** de `baseGi` en SVG
 * planta (borde inferior del rect base = encuentro horizontal con el tramo nuevo).
 * @param {object} p
 * @param {Array} p.zonas — mismas reglas que `layoutZonasEnPlanta`
 * @param {"una_agua"|"dos_aguas"} [p.tipoAguas]
 * @param {number} p.baseGi
 * @param {number} [p.gapM]
 * @returns {{ x: number, y: number }|null}
 */
export function previewPositionForTramoApiladoFrente({
  zonas,
  tipoAguas = "una_agua",
  baseGi,
  gapM = ROOF_PLAN_GAP_M,
}) {
  try {
    const rects = layoutZonasEnPlanta(zonas, tipoAguas, gapM);
    const R = rects.find((r) => r.gi === baseGi);
    if (!R) return null;
    return { x: R.x, y: R.y + R.h + gapM };
  } catch {
    return null;
  }
}
