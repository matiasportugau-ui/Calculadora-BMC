/**
 * Secciones 2D reales de paneles de techo, para extrusión 3D (THREE.ExtrudeGeometry).
 *
 * Fuente: plano técnico BMC del perfil ISOROOF (docs/team/visual/roof-panel-3d-refs/
 * isoroof-cross-section-dimensioned.png, producto ISOROOF FOIL en bmcuruguay.com.uy) — cotas
 * reales publicadas por el fabricante.
 *
 * CORREGIDO 2026-07-11 (feedback directo sobre el plano): el ISOROOF NO tiene corrugación
 * densa repetida cada 72mm. Mirando el plano con cuidado (zoom sobre la nervadura central):
 * "72" es el ANCHO DE LA BASE de la nervadura central (no un paso de repetición), "26" es
 * el ancho del tope, "40" el alto. El panel real tiene solo 3 nervios ESTRUCTURALES
 * trapezoidales por módulo au=1.0m (se ve el núcleo de espuma amarillo asomando debajo de
 * cada uno, señal de que atraviesan todo el espesor): uno en cada borde — cada uno es
 * literalmente MEDIO trapezoide, cortado justo por su eje central, porque la otra mitad la
 * aporta el panel vecino al instalarse en fila — y uno completo en el centro del panel.
 * Entre esos 3 nervios el resto del ancho es plano (hay ondulaciones finas y poco profundas
 * en el plano real, puramente cosméticas/de rigidez superficial, que se omiten acá por
 * simplicidad — no tienen núcleo debajo, no son estructurales).
 */

const ISOROOF_RIB_BASE_WIDTH_M = 0.072;
const ISOROOF_RIB_TOP_WIDTH_M = 0.026;
const ISOROOF_RIB_HEIGHT_M = 0.04;

/**
 * Puntos 2D (x=ancho, y=alto) del perfil real ISOROOF: 3 nervios trapezoidales por franja
 * de `widthM` (≈ au) — medio nervio en cada borde (compartido con el panel vecino) + uno
 * completo al centro — con tramos planos entre ellos. A diferencia del perfil de borde/perfil
 * (Sección 2), el primer y último punto NO están en y=0: el borde de la franja cae justo
 * sobre el tope del medio-nervio (y=height), tal como en el plano real.
 * @param {number} widthM
 * @returns {Array<[number, number]>}
 */
export function buildIsoroofRibProfilePoints(widthM) {
  if (!(widthM > 0)) return [[0, 0], [0, 0]];
  const baseHalf = ISOROOF_RIB_BASE_WIDTH_M / 2;
  const topHalf = ISOROOF_RIB_TOP_WIDTH_M / 2;
  const h = ISOROOF_RIB_HEIGHT_M;
  const mid = widthM / 2;

  // Franja demasiado angosta para el nervio central completo (última franja parcial muy
  // chica): devolver plano en vez de geometría degenerada/solapada.
  if (widthM < ISOROOF_RIB_BASE_WIDTH_M * 1.5) return [[0, 0], [widthM, 0]];

  return [
    // medio nervio de borde izquierdo — arranca directo en el tope (mitad visible)
    [0, h],
    [topHalf, h],
    [baseHalf, 0],
    // tramo plano hasta el nervio central
    [mid - baseHalf, 0],
    // nervio central completo
    [mid - topHalf, h],
    [mid + topHalf, h],
    [mid + baseHalf, 0],
    // tramo plano hasta el borde derecho
    [widthM - baseHalf, 0],
    // medio nervio de borde derecho — termina en el tope (mitad visible), simétrico al izq.
    [widthM - topHalf, h],
    [widthM, h],
  ];
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
