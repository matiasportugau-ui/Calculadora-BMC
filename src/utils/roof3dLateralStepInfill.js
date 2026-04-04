// ═══════════════════════════════════════════════════════════════════════════
// roof3dLateralStepInfill.js — (reservado) Relleno entre tramos en 3D referencial.
//
// Con layout coplanar global (roofZoneLayouts3d: py → Y,Z), las zonas comparten plano
// según planta; no se generan mallas “verticales” de escalón entre anexo y raíz.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {Array<{ z: object, gi: number, ox: number, oz: number, ancho: number, largo: number }>} zoneLayouts
 * @param {Array<{ largo: number, ancho: number, preview?: object }>} validZonas
 * @param {number} theta
 * @returns {Array<{ key: string, seamX: number, positions: Float32Array, indices: Uint16Array }>}
 */
export function buildLateralStepInfillGeometries(zoneLayouts, validZonas, theta) {
  void zoneLayouts;
  void validZonas;
  void theta;
  return [];
}
