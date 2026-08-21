/**
 * Catalog ancho útil (m) for covering m² / material volume.
 * Truck row occupancy stays ROW_W = 1.2 in cargoPacking — do not use AU as bed width.
 *
 * Values match src/data/constants.js PANELS_* .au (ISODEC 1.12, ISOPANEL 1.14, …).
 */

export const ANCHO_UTIL_M = Object.freeze({
  ISODEC: 1.12,
  ISODEC_PIR: 1.12,
  ISODEC_EPS: 1.12,
  ISOPANEL: 1.14,
  ISOFRIG: 1.14,
  ISOFRIG_PIR: 1.14,
  ISOWALL: 1.1,
  ISOWALL_PIR: 1.1,
  ISOROOF: 1.0,
  ISOROOF_3G: 1.0,
  ISOROOF_PLUS: 1.0,
  ISOROOF_FOIL: 1.0,
  ISOROOF_COLONIAL: 1.0,
});

/** Fallback when tipo is unknown — not truck ROW_W. */
export const DEFAULT_ANCHO_UTIL_M = 1.12;

/**
 * @param {string} [tipo]
 * @returns {number} useful covering width (m)
 */
export function anchoUtilForTipo(tipo) {
  const key = String(tipo || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (!key) return DEFAULT_ANCHO_UTIL_M;
  if (ANCHO_UTIL_M[key] != null) return ANCHO_UTIL_M[key];
  if (key.startsWith("ISODEC")) return ANCHO_UTIL_M.ISODEC;
  if (key.startsWith("ISOPANEL")) return ANCHO_UTIL_M.ISOPANEL;
  if (key.startsWith("ISOFRIG")) return ANCHO_UTIL_M.ISOFRIG;
  if (key.startsWith("ISOWALL")) return ANCHO_UTIL_M.ISOWALL;
  if (key.startsWith("ISOROOF")) return ANCHO_UTIL_M.ISOROOF;
  return DEFAULT_ANCHO_UTIL_M;
}

/**
 * Covering m² and foam m³ (no pack air). Occupancy cuboid is L×ROW_W×H_pack elsewhere.
 * @param {{ tipo?: string, espesor?: number, longitud?: number, cantidad?: number, n?: number, len?: number, esp?: number }} p
 * @returns {{ au: number, m2: number, volumeM3: number, espesorMm: number, longitud: number, cantidad: number }}
 */
export function panelMaterialMetrics(p = {}) {
  const cantidad = Math.max(
    0,
    Math.floor(Number(p.cantidad != null ? p.cantidad : p.n) || 0),
  );
  const longitud = Math.max(0, Number(p.longitud != null ? p.longitud : p.len) || 0);
  const espesorMm = Math.max(0, Number(p.espesor != null ? p.espesor : p.esp) || 0);
  const au = anchoUtilForTipo(p.tipo);
  const m2 = cantidad * longitud * au;
  const volumeM3 = m2 * (espesorMm / 1000);
  return { au, m2, volumeM3, espesorMm, longitud, cantidad };
}
