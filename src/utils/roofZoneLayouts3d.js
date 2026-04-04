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
export function buildZoneLayoutsForRoof3d(validZonas, tipoAguasStr = "una_agua", theta = Math.PI / 12) {
  const cosT = Math.cos(theta);
  const plantRects = zonasToPlantRectsWithAutoGap(validZonas, tipoAguasStr);
  return plantRects.map((r) => {
    const rootGi = isLateralAnnexZona(r.z) ? getLateralAnnexRootBodyGi(validZonas, r.gi) : r.gi;
    const ref = plantRects.find((p) => p.gi === rootGi) ?? r;
    // Fondo-aligned: zones sharing the same plan ref.y have their fondo at the same 3D z.
    // fondo_z = oz - r.h*cosT = -ref.y*cosT  (for r.y=0: fondo at z=0 for all zones in chain)
    const oz = (r.h - ref.y) * cosT;
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
