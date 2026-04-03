// ═══════════════════════════════════════════════════════════════════════════
// roofZoneLayouts3d.js — Layout de zonas en 3D alineado a RoofBorderCanvas / RoofPreview
// (misma planta: zonasToPlantRectsWithAutoGap + frente coplanar para anexos laterales).
// ═══════════════════════════════════════════════════════════════════════════

import {
  getLateralAnnexRootBodyGi,
  isLateralAnnexZona,
  zonasToPlantRectsWithAutoGap,
} from "./roofLateralAnnexLayout.js";

/**
 * @param {Array<{ largo: number, ancho: number, preview?: object }>} validZonas
 * @param {"una_agua"|"dos_aguas"} tipoAguasStr
 * @returns {Array<{ z: object, gi: number, ancho: number, ox: number, oz: number, largo: number, slopeMark?: string }>}
 */
export function buildZoneLayoutsForRoof3d(validZonas, tipoAguasStr = "una_agua") {
  const plantRects = zonasToPlantRectsWithAutoGap(validZonas, tipoAguasStr);
  return plantRects.map((r) => {
    const rootGi = isLateralAnnexZona(r.z) ? getLateralAnnexRootBodyGi(validZonas, r.gi) : r.gi;
    const ref = plantRects.find((p) => p.gi === rootGi) ?? r;
    const oz = -(ref.y + ref.h);
    return {
      z: r.z,
      gi: r.gi,
      ancho: r.w,
      ox: r.x,
      oz,
      largo: r.h,
      slopeMark: r.z?.preview?.slopeMark,
    };
  });
}
