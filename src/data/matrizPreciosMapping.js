// ═══════════════════════════════════════════════════════════════════════════
// matrizPreciosMapping.js — Mapeo SKU MATRIZ → path calculadora
// MATRIZ de COSTOS y VENTAS 2026
// Col G = Costo (con IVA) → sin IVA / 1.22
// Col L = Venta consumidor (con IVA) → sin IVA / 1.22
// Col M = Venta web (con IVA) → sin IVA / 1.22 (si existe)
// ═══════════════════════════════════════════════════════════════════════════

/** Normaliza SKU para match (uppercase, sin espacios, guiones opcionales) */
export function normalizeSku(sku) {
  return String(sku || "").trim().toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
}

/**
 * Mapeo: SKU en col D de MATRIZ → path base en calculadora.
 * Cada path puede recibir overrides: .costo, .venta, .web
 */
export const MATRIZ_SKU_TO_PATH = {
  // Paneles techo ISOROOF
  IAGRO30: "PANELS_TECHO.ISOROOF_FOIL.esp.30",
  IAGRO50: "PANELS_TECHO.ISOROOF_FOIL.esp.50",
  IROOF30: "PANELS_TECHO.ISOROOF_3G.esp.30",
  IROOF40: "PANELS_TECHO.ISOROOF_3G.esp.40",
  IROOF50: "PANELS_TECHO.ISOROOF_3G.esp.50",
  IROOF80: "PANELS_TECHO.ISOROOF_3G.esp.80",
  IROOF100: "PANELS_TECHO.ISOROOF_3G.esp.100",
  IROOF50PLS: "PANELS_TECHO.ISOROOF_PLUS.esp.50",
  IROOF80PLS: "PANELS_TECHO.ISOROOF_PLUS.esp.80",

  // Paneles techo ISODEC
  ISDEC100: "PANELS_TECHO.ISODEC_EPS.esp.100",
  ISDEC150: "PANELS_TECHO.ISODEC_EPS.esp.150",
  ISDEC200: "PANELS_TECHO.ISODEC_EPS.esp.200",
  ISDEC250: "PANELS_TECHO.ISODEC_EPS.esp.250",
  ISDPIR50: "PANELS_TECHO.ISODEC_PIR.esp.50",
  ISDPIR80: "PANELS_TECHO.ISODEC_PIR.esp.80",
  ISDPIR120: "PANELS_TECHO.ISODEC_PIR.esp.120",

  // Paneles pared
  ISD50EPS: "PANELS_PARED.ISOPANEL_EPS.esp.50",
  ISD100EPS: "PANELS_PARED.ISOPANEL_EPS.esp.100",
  ISD150EPS: "PANELS_PARED.ISOPANEL_EPS.esp.150",
  ISD200EPS: "PANELS_PARED.ISOPANEL_EPS.esp.200",
  ISD250EPS: "PANELS_PARED.ISOPANEL_EPS.esp.250",
  IW50: "PANELS_PARED.ISOWALL_PIR.esp.50",
  IW80: "PANELS_PARED.ISOWALL_PIR.esp.80",
  IW100: "PANELS_PARED.ISOWALL_PIR.esp.100",

  // Goteros
  GFS30: "PERFIL_TECHO.gotero_frontal.ISOROOF.30",
  GFS50: "PERFIL_TECHO.gotero_frontal.ISOROOF.50",
  GFS80: "PERFIL_TECHO.gotero_frontal.ISOROOF.80",
  GFSUP30: "PERFIL_TECHO.gotero_superior.ISOROOF.30",
  GFSUP50: "PERFIL_TECHO.gotero_superior.ISOROOF.50",
  GFSUP80: "PERFIL_TECHO.gotero_superior.ISOROOF.80",
  GSDECAM30: "PERFIL_TECHO.gotero_superior.ISODEC_PIR.50",
  GSDECAM50: "PERFIL_TECHO.gotero_superior.ISODEC_PIR.50",
  GSDECAM80: "PERFIL_TECHO.gotero_superior.ISODEC_PIR.80",
  GL30: "PERFIL_TECHO.gotero_lateral.ISOROOF.30",
  GL40: "PERFIL_TECHO.gotero_lateral.ISOROOF.50",
  GL50: "PERFIL_TECHO.gotero_lateral.ISOROOF.50",
  GL80: "PERFIL_TECHO.gotero_lateral.ISOROOF.80",
  GLDCAM50: "PERFIL_TECHO.gotero_lateral_camara.ISOROOF.50",
  GLDCAM80: "PERFIL_TECHO.gotero_lateral_camara.ISOROOF.80",
  GFCGR30: "PERFIL_TECHO.gotero_frontal_greca.ISOROOF.30",

  // Babetas, cumbrera, canalón
  BBAS3G: "PERFIL_TECHO.babeta_adosar.ISOROOF._all",
  BBESUP: "PERFIL_TECHO.babeta_empotrar.ISOROOF._all",
  CUMROOF3M: "PERFIL_TECHO.cumbrera.ISOROOF._all",
  CD30: "PERFIL_TECHO.canalon.ISOROOF.30",
  CD50: "PERFIL_TECHO.canalon.ISOROOF.50",
  CD80: "PERFIL_TECHO.canalon.ISOROOF.80",
  SOPCAN3M: "PERFIL_TECHO.soporte_canalon.ISOROOF._all",

  // Selladores
  CBUT: "SELLADORES.cinta_butilo",
  BROMPLAST: "SELLADORES.silicona",

  // Fijaciones
  CABROJ: "FIJACIONES.caballete",

  // Servicios
  FLETEBRO: "SERVICIOS.flete",
};

/** Obtener path para un SKU de la MATRIZ (normalizado) */
export function getPathForMatrizSku(sku) {
  const n = normalizeSku(sku);
  return MATRIZ_SKU_TO_PATH[n] || MATRIZ_SKU_TO_PATH[sku];
}
