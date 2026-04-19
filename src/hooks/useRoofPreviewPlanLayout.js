import { useMemo } from "react";
import { buildRoofPlanEdges } from "../utils/roofPlanGeometry.js";

/**
 * Margen alrededor del bounding box del layout (metros).
 * Antes era fijo 2.8 m por lado → en techos chicos el dibujo ocupaba ~25–35 % del viewBox.
 * Ahora escala con el tamaño del plano (≈5.2 % del mayor lado), acotado para drag/snap cómodos.
 */
function viewBoxSlackMeters(spanM) {
  const s = Number(spanM);
  if (!Number.isFinite(s) || s <= 0) return 0.85;
  return Math.min(1.85, Math.max(0.22, s * 0.052));
}

/**
 * Planta 2D + `planEdges` compartidos entre `RoofPreview` y `RoofPreviewMetricsSidebar`.
 * @param {Array} zonas
 * @param {string} tipoAguas
 */
export function useRoofPreviewPlanLayout(zonas, tipoAguas, padOverride = null) {
  const tipoPlanta = tipoAguas === "dos_aguas" ? "dos_aguas" : "una_agua";
  const planEdges = useMemo(() => {
    if (!zonas?.length) return null;
    try {
      return buildRoofPlanEdges(zonas, tipoPlanta);
    } catch {
      return null;
    }
  }, [zonas, tipoPlanta]);

  const layout = useMemo(() => {
    const entries = planEdges?.rects ?? [];
    let curMinX = Infinity;
    let curMinY = Infinity;
    let curMaxX = -Infinity;
    let curMaxY = -Infinity;
    for (const r of entries) {
      curMinX = Math.min(curMinX, r.x);
      curMinY = Math.min(curMinY, r.y);
      curMaxX = Math.max(curMaxX, r.x + r.w);
      curMaxY = Math.max(curMaxY, r.y + r.h);
    }
    const pad = padOverride ?? 0.60;
    const cw = Math.max(0, curMaxX - curMinX);
    const ch = Math.max(0, curMaxY - curMinY);
    const slack = viewBoxSlackMeters(Math.max(cw, ch, 0.01));
    const totalArea = entries.reduce((s, r) => s + r.z.largo * r.z.ancho, 0);
    if (!entries.length) {
      return {
        entries: [],
        viewBox: "0 0 10 6",
        totalArea: 0,
        viewMetrics: null,
      };
    }
    const vbW = curMaxX - curMinX + 2 * (pad + slack);
    const vbH = curMaxY - curMinY + 2 * (pad + slack);
    const vbX = curMinX - pad - slack;
    const vbY = curMinY - pad - slack;
    const margin = pad * 0.35;
    return {
      entries,
      viewBox: `${vbX} ${vbY} ${vbW} ${vbH}`,
      totalArea,
      viewMetrics: { vbX, vbY, vbW, vbH, margin },
    };
  }, [planEdges, padOverride]);

  return { tipoPlanta, planEdges, layout };
}
