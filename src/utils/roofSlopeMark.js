/** Ciclo de sentido de pendiente visual (planta / 3D). Debe coincidir con RoofPreview + RoofZoneMesh. */
export const ROOF_SLOPE_MARKS = ["off", "along_largo_pos", "along_largo_neg"];

/**
 * @param {string | undefined} current
 * @returns {string}
 */
export function nextRoofSlopeMark(current) {
  const cur =
    current && ROOF_SLOPE_MARKS.includes(current) ? current : "off";
  const i = ROOF_SLOPE_MARKS.indexOf(cur);
  return ROOF_SLOPE_MARKS[(i + 1) % ROOF_SLOPE_MARKS.length];
}
