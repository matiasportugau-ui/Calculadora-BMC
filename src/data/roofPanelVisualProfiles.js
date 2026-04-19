/**
 * Perfiles visuales para render 3D referencial del techo (texturas catálogo / Shopify).
 * Clave = familia en PANELS_TECHO (constants.js).
 */

import { ROOF_CATALOG_MAP_URL_BY_FAMILIA } from "./roofPanelCatalogMapUrls.js";

/**
 * @typedef {{
 *   mapUrl: string;
 *   normalMapUrl?: string | null;
 *   roughnessMapUrl?: string | null;
 *   roughness: number;
 *   metalness: number;
 *   thicknessMm: number
 * }} RoofPanelVisualProfile
 */

/** @type {Record<string, RoofPanelVisualProfile>} */
export const ROOF_PANEL_VISUAL_PROFILES = {
  ISODEC_EPS: {
    mapUrl: ROOF_CATALOG_MAP_URL_BY_FAMILIA.ISODEC_EPS,
    normalMapUrl: null,
    roughnessMapUrl: null,
    roughness: 0.62,
    metalness: 0.08,
    thicknessMm: 150,
  },
  ISODEC_PIR: {
    mapUrl: ROOF_CATALOG_MAP_URL_BY_FAMILIA.ISODEC_PIR,
    normalMapUrl: null,
    roughnessMapUrl: null,
    roughness: 0.58,
    metalness: 0.1,
    thicknessMm: 80,
  },
  ISOROOF_3G: {
    mapUrl: ROOF_CATALOG_MAP_URL_BY_FAMILIA.ISOROOF_3G,
    normalMapUrl: null,
    roughnessMapUrl: null,
    roughness: 0.55,
    metalness: 0.15,
    thicknessMm: 40,
  },
  ISOROOF_PLUS: {
    mapUrl: ROOF_CATALOG_MAP_URL_BY_FAMILIA.ISOROOF_PLUS,
    normalMapUrl: null,
    roughnessMapUrl: null,
    roughness: 0.48,
    metalness: 0.18,
    thicknessMm: 50,
  },
  ISOROOF_FOIL: {
    mapUrl: ROOF_CATALOG_MAP_URL_BY_FAMILIA.ISOROOF_FOIL,
    normalMapUrl: null,
    roughnessMapUrl: null,
    roughness: 0.42,
    metalness: 0.22,
    thicknessMm: 50,
  },
  ISOROOF_COLONIAL: {
    mapUrl: ROOF_CATALOG_MAP_URL_BY_FAMILIA.ISOROOF_COLONIAL,
    normalMapUrl: null,
    roughnessMapUrl: null,
    roughness: 0.68,
    metalness: 0.06,
    thicknessMm: 40,
  },
};

/**
 * @param {string} [familiaKey]
 * @param {number|string} [espesorMm]
 * @returns {RoofPanelVisualProfile & { thicknessMm: number }}
 */
export function getRoofPanelVisualProfile(familiaKey, espesorMm) {
  const base =
    (familiaKey && ROOF_PANEL_VISUAL_PROFILES[familiaKey]) ||
    ROOF_PANEL_VISUAL_PROFILES.ISODEC_EPS;
  const esp = Number(espesorMm);
  const thicknessMm = Number.isFinite(esp) && esp > 0 ? esp : base.thicknessMm;
  return { ...base, thicknessMm };
}
