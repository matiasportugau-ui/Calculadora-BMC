import { useMemo } from "react";
import { buildRoofPlanEdges } from "../utils/roofPlanGeometry.js";

/** Igual que `RoofPreview.jsx`: margen alrededor del layout en fila. */
const VIEWBOX_SLACK_M = 2.8;

/**
 * Planta 2D + `planEdges` compartidos entre `RoofPreview` y `RoofPreviewMetricsSidebar`.
 * @param {Array} zonas
 * @param {string} tipoAguas
 */
export function useRoofPreviewPlanLayout(zonas, tipoAguas) {
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
    const pad = 0.45;
    const slack = VIEWBOX_SLACK_M;
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
  }, [planEdges]);

  return { tipoPlanta, planEdges, layout };
}
