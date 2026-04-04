// ═══════════════════════════════════════════════════════════════════════════
// roofZoneLayouts3d.js — Layout 3D coplanar con la planta (RoofPreview / RoofBorderCanvas)
//
// Cada rectángulo en planta (r.x, r.y, r.w, r.h) se apoya en el mismo plano inclinado:
//   Z ≈ py * cos(θ),  Y ≈ py * sin(θ)  (py = coordenada Y en planta hacia el frente)
// sin anclajes por eje ni “arrastre” del frente del cuerpo raíz: no se usa attachParent
// para posición; el no solapamiento es responsabilidad del layout 2D.
// ═══════════════════════════════════════════════════════════════════════════

import { zonasToPlantRectsWithAutoGap } from "./roofLateralAnnexLayout.js";

/**
 * @param {Array<{ largo: number, ancho: number, preview?: object }>} validZonas
 * @param {"una_agua"|"dos_aguas"} tipoAguasStr
 * @returns {Array<{ z: object, gi: number, ancho: number, ox: number, oy: number, oz: number, largo: number, slopeMark?: string }>}
 */
export function buildZoneLayoutsForRoof3d(validZonas, tipoAguasStr = "una_agua", theta = Math.PI / 12) {
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const plantRects = zonasToPlantRectsWithAutoGap(validZonas, tipoAguasStr);
  return plantRects.map((r) => {
    const pyFrente = r.y + r.h;
    return {
      z: r.z,
      gi: r.gi,
      ancho: r.w,
      ox: r.x,
      oy: r.y * sinT,
      oz: pyFrente * cosT,
      largo: r.h,
      slopeMark: r.z?.preview?.slopeMark,
    };
  });
}
