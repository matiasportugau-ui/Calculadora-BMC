/**
 * Secciones 2D reales de paneles de techo, para extrusión 3D (THREE.ExtrudeGeometry).
 *
 * Fuente: plano técnico BMC del perfil ISOROOF (docs/team/visual/roof-panel-3d-refs/
 * isoroof-cross-section-dimensioned.png, producto ISOROOF FOIL en bmcuruguay.com.uy) — cotas
 * reales publicadas por el fabricante, NO estimadas: ancho útil (au) 1000mm, nervadura 26mm de
 * ancho (tope) × 40mm de alto, paso entre nervaduras 72mm.
 *
 * Interpretación de ingeniería (no está en el plano, es una lectura razonable de la imagen):
 * onda trapezoidal uniforme — valle plano + subida + tope de nervadura (26mm) + bajada, repetido
 * cada 72mm. Ancho de subida/bajada (10mm cada uno) no está acotado en el plano; elegido para que
 * valle(26) + subida(10) + tope(26) + bajada(10) = 72mm exacto. Si aparece el archivo 3D fuente
 * real (ver spec §1.4 Opción D), reemplazar esta aproximación por la geometría exacta.
 */

const ISOROOF_RIB_PITCH_M = 0.072;
const ISOROOF_RIB_TOP_WIDTH_M = 0.026;
const ISOROOF_RIB_HEIGHT_M = 0.04;
const ISOROOF_SLOPE_WIDTH_M = 0.01; // estimado, no acotado en el plano — ver comentario arriba
const ISOROOF_VALLEY_WIDTH_M =
  ISOROOF_RIB_PITCH_M - ISOROOF_RIB_TOP_WIDTH_M - 2 * ISOROOF_SLOPE_WIDTH_M; // 0.026m

/**
 * Puntos 2D (x=ancho, y=alto) del perfil trapezoidal ISOROOF, repetido a lo largo de `widthM`.
 * Empieza y termina en y=0 (valle) para poder cerrar el shape con una base plana.
 * @param {number} widthM
 * @returns {Array<[number, number]>}
 */
export function buildIsoroofRibProfilePoints(widthM) {
  if (!(widthM > 0)) return [[0, 0], [0, 0]];
  const pts = [[0, 0]];
  let x = 0;
  const halfValley = ISOROOF_VALLEY_WIDTH_M / 2;
  x += halfValley;
  if (x >= widthM) return [[0, 0], [widthM, 0]];
  pts.push([x, 0]);
  while (x < widthM) {
    const xUp = Math.min(x + ISOROOF_SLOPE_WIDTH_M, widthM);
    pts.push([xUp, ISOROOF_RIB_HEIGHT_M * ((xUp - x) / ISOROOF_SLOPE_WIDTH_M)]);
    x = xUp;
    if (x >= widthM) break;

    const xTop = Math.min(x + ISOROOF_RIB_TOP_WIDTH_M, widthM);
    pts.push([xTop, ISOROOF_RIB_HEIGHT_M]);
    x = xTop;
    if (x >= widthM) break;

    const xDown = Math.min(x + ISOROOF_SLOPE_WIDTH_M, widthM);
    pts.push([xDown, ISOROOF_RIB_HEIGHT_M * (1 - (xDown - x) / ISOROOF_SLOPE_WIDTH_M)]);
    x = xDown;
    if (x >= widthM) break;

    const xValley = Math.min(x + ISOROOF_VALLEY_WIDTH_M, widthM);
    pts.push([xValley, 0]);
    x = xValley;
  }
  if (pts[pts.length - 1][0] < widthM) pts.push([widthM, 0]);
  return pts;
}

/** `fam` (PANELS_TECHO) → generador de perfil. Familias sin entrada usan el plano liso (fallback). */
const PROFILE_BUILDERS_BY_FAM = {
  ISOROOF: buildIsoroofRibProfilePoints,
};

/**
 * @param {string} fam - `PANELS_TECHO[familiaKey].fam`
 * @returns {((widthM: number) => Array<[number, number]>) | null}
 */
export function getRoofPanelProfileBuilder(fam) {
  return PROFILE_BUILDERS_BY_FAM[fam] ?? null;
}
