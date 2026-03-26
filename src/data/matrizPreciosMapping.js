// ═══════════════════════════════════════════════════════════════════════════
// matrizPreciosMapping.js — Mapeo SKU MATRIZ → path calculadora
// MATRIZ de COSTOS y VENTAS 2026 — misma planilla para costos y precios de venta
//
// Operativo col D (evitar path duplicado en CSV):
// - Isoroof Colonial 40 mm (simil teja / int. blanco) → ISOCOL40 (aliases IAGRO40COL / IAGCOL40); no FOIL 3G.
// - Cumbrera colonial 2,2 m (misma familia) → CUMROOFCOL o CUMCOL22 → cumbrera.ISOROOF_COLONIAL (no CUMROOF3M).
// - Gotero sup. cámara 30 mm → GSDECAM30; 50 mm → GSDECAM50.
// - Gotero lateral 40 mm → GL40; 50 mm → GL50.
// - Pared “ISODEC EPS” lista Bromyros → ISDEC100P … ISDEC250P (ISOPANEL queda ISDxxxEPS).
// - Isowall 80 mm → SKU IW80 en col D (tres filas con mismo path = error de planilla).
//
// Columnas (búsqueda por nombre en bmcDashboard.buildPlanillaDesdeMatriz):
//   - Costo/Costos (fallback col G) — con IVA → sin IVA / 1.22
//   - Venta BMC/consumidor (fallback col L) — con IVA → sin IVA / 1.22
//   - Venta Web (fallback col M) — con IVA → sin IVA / 1.22
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
  /** Isoroof Colonial 40 mm — SKU canónico en MATRIZ; aliases históricos IAGRO40COL / IAGCOL40 */
  ISOCOL40: "PANELS_TECHO.ISOROOF_COLONIAL.esp.40",
  IAGRO40COL: "PANELS_TECHO.ISOROOF_COLONIAL.esp.40",
  IAGCOL40: "PANELS_TECHO.ISOROOF_COLONIAL.esp.40",
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
  /** Pared ISODEC EPS (precio lista distinta a ISOPANEL) — usar col D en MATRIZ */
  ISDEC100P: "PANELS_PARED.ISODEC_EPS_PARED.esp.100",
  ISDEC150P: "PANELS_PARED.ISODEC_EPS_PARED.esp.150",
  ISDEC200P: "PANELS_PARED.ISODEC_EPS_PARED.esp.200",
  ISDEC250P: "PANELS_PARED.ISODEC_EPS_PARED.esp.250",
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
  GSDECAM30: "PERFIL_TECHO.gotero_superior.ISODEC_PIR.30",
  GSDECAM50: "PERFIL_TECHO.gotero_superior.ISODEC_PIR.50",
  GSDECAM80: "PERFIL_TECHO.gotero_superior.ISODEC_PIR.80",
  GL30: "PERFIL_TECHO.gotero_lateral.ISOROOF.30",
  GL40: "PERFIL_TECHO.gotero_lateral.ISOROOF.40",
  GL50: "PERFIL_TECHO.gotero_lateral.ISOROOF.50",
  GL80: "PERFIL_TECHO.gotero_lateral.ISOROOF.80",
  GLDCAM50: "PERFIL_TECHO.gotero_lateral_camara.ISOROOF.50",
  GLDCAM80: "PERFIL_TECHO.gotero_lateral_camara.ISOROOF.80",
  GFCGR30: "PERFIL_TECHO.gotero_frontal_greca.ISOROOF.30",

  // Babetas, cumbrera, canalón
  BBAS3G: "PERFIL_TECHO.babeta_adosar.ISOROOF._all",
  BBESUP: "PERFIL_TECHO.babeta_empotrar.ISOROOF._all",
  CUMROOF3M: "PERFIL_TECHO.cumbrera.ISOROOF._all",
  /** Cumbrera colonial 2,2 m — misma familia que panel Isoroof Colonial */
  CUMROOFCOL: "PERFIL_TECHO.cumbrera.ISOROOF_COLONIAL._all",
  CUMCOL22: "PERFIL_TECHO.cumbrera.ISOROOF_COLONIAL._all",
  CD30: "PERFIL_TECHO.canalon.ISOROOF.30",
  CD50: "PERFIL_TECHO.canalon.ISOROOF.50",
  CD80: "PERFIL_TECHO.canalon.ISOROOF.80",
  SOPCAN3M: "PERFIL_TECHO.soporte_canalon.ISOROOF._all",

  // Selladores
  CBUT: "SELLADORES.cinta_butilo",
  BROMPLAST: "SELLADORES.silicona",
  SIL300N: "SELLADORES.silicona_300_neutra",

  // Fijaciones
  CABROJ: "FIJACIONES.caballete",
  /** Presupuesto libre / catálogo — SKU col.D: confirmar en MATRIZ 2026 si difiere */
  ANCISOTER: "FIJACIONES.anclaje_isoroof_terracota",
  ANCISOGR: "FIJACIONES.anclaje_isoroof_gris",
  ANCBC18: "FIJACIONES.anclaje_chapa_bc18",
  ANCBC35: "FIJACIONES.anclaje_chapa_bc35",
  ANCUPLAT: "FIJACIONES.anclaje_kit_u_platea",
  REMPOP532: "FIJACIONES.remache_pop",
  REMPOP316: "FIJACIONES.remache_pop_316",
  THEX1234: "FIJACIONES.tornillo_exagonal_12_34",
  THEX121PM: "FIJACIONES.tornillo_exagonal_12_1_pm",
  THEX12212: "FIJACIONES.tornillo_exagonal_12_212_pm",
  TAG12X2: "FIJACIONES.tornillo_punta_aguja_12x2",
  TAG12X3: "FIJACIONES.tornillo_punta_aguja_12x3",
  THEXPU204: "FIJACIONES.tornillo_hex_pu_20mm_4in",
  T1PERF: "FIJACIONES.tornillo_t1",
  T2FACH: "FIJACIONES.tornillo_t2",
  TAGU14X5: "FIJACIONES.tornillo_aguja",
  ANC100MM: "FIJACIONES.anclaje_h",

  // Herramientas
  APLDX03: "HERRAMIENTAS.pistola_apl_dx03",

  // Servicios
  FLETEBRO: "SERVICIOS.flete",
};

/** Obtener path para un SKU de la MATRIZ (normalizado) */
export function getPathForMatrizSku(sku) {
  const n = normalizeSku(sku);
  return MATRIZ_SKU_TO_PATH[n] || MATRIZ_SKU_TO_PATH[sku];
}
